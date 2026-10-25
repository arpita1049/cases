import csv
import io
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from ..database import get_db
from ..models import Case, CaseAction, AuditLog, Notification, User, Bureau, OverlapAlert, Institution, DeadlineRule, UserRole, CaseStatus, ActionType
from ..schemas import (
    CaseOut, CaseCreate, CaseUpdate, CaseActionOut, AddActionRequest,
    PaginatedCases, BulkPreviewResponse, BulkImportRowPreview, BulkImportConfirmRequest
)
from ..routers.auth import get_current_user
from ..overlap_engine import sync_overlap_alerts_for_case

router = APIRouter(prefix="/cases", tags=["Cases"])


def _case_query(db: Session, current_user: User):
    """Base query filtered by role."""
    q = db.query(Case).options(
        joinedload(Case.institution),
        joinedload(Case.bureau),
        joinedload(Case.officer),
    )
    if current_user.role == UserRole.BUREAU_OFFICER:
        # Own bureau cases + cases linked through overlap alerts involving their bureau
        overlap_cases_a = db.query(OverlapAlert.case_a_id).join(Case, OverlapAlert.case_b_id == Case.id).filter(Case.bureau_id == current_user.bureau_id)
        overlap_cases_b = db.query(OverlapAlert.case_b_id).join(Case, OverlapAlert.case_a_id == Case.id).filter(Case.bureau_id == current_user.bureau_id)
        q = q.filter(
            or_(
                Case.bureau_id == current_user.bureau_id,
                Case.id.in_(overlap_cases_a),
                Case.id.in_(overlap_cases_b),
            )
        )
    elif current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        q = q.join(Case.institution).filter(
            Case.institution.has(region=current_user.region)
        )
    # Administrator and Senior Management see all
    return q


@router.get("", response_model=PaginatedCases)
async def list_cases(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    institution_id: Optional[int] = Query(None),
    bureau_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("received_date"),
    sort_order: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _case_query(db, current_user)

    if search:
        q = q.filter(or_(
            Case.case_code.ilike(f"%{search}%"),
            Case.category.ilike(f"%{search}%"),
            Case.description.ilike(f"%{search}%"),
            Case.complainant_name.ilike(f"%{search}%"),
            Case.institution.has(Institution.name.ilike(f"%{search}%")),
            Case.institution.has(Institution.aicte_permanent_id.ilike(f"%{search}%")),
        ))
    if institution_id:
        q = q.filter(Case.institution_id == institution_id)
    if bureau_id:
        q = q.filter(Case.bureau_id == bureau_id)
    if status:
        q = q.filter(Case.status == status)
    if category:
        q = q.filter(Case.category.ilike(f"%{category}%"))
    if date_from:
        q = q.filter(Case.received_date >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Case.received_date <= datetime.fromisoformat(date_to))
    if region:
        q = q.join(Case.institution).filter(
            Case.institution.has(region=region)
        )

    # Sorting
    descending = (sort_order or "desc").lower() == "desc"
    order_col = None
    if sort_by == "case_code":
        order_col = Case.case_code.desc() if descending else Case.case_code.asc()
    elif sort_by == "category":
        order_col = Case.category.desc() if descending else Case.category.asc()
    elif sort_by == "status":
        order_col = Case.status.desc() if descending else Case.status.asc()
    elif sort_by == "due_date":
        order_col = Case.due_date.desc() if descending else Case.due_date.asc()
    elif sort_by == "institution":
        q = q.outerjoin(Institution, Case.institution_id == Institution.id)
        order_col = Institution.name.desc() if descending else Institution.name.asc()
    elif sort_by == "bureau":
        q = q.outerjoin(Bureau, Case.bureau_id == Bureau.id)
        order_col = Bureau.code.desc() if descending else Bureau.code.asc()
    else:
        order_col = Case.received_date.desc() if descending else Case.received_date.asc()

    total = q.count()
    items = q.order_by(order_col).offset((page - 1) * per_page).limit(per_page).all()

    return PaginatedCases(total=total, page=page, per_page=per_page,
                          items=[CaseOut.model_validate(c) for c in items])


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(Case).options(
        joinedload(Case.institution),
        joinedload(Case.bureau),
        joinedload(Case.officer),
    ).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Backend RBAC enforcement (Requirement 8)
    if current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        if not case.institution or case.institution.region != current_user.region:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view cases outside your region")
    elif current_user.role == UserRole.BUREAU_OFFICER:
        if case.bureau_id != current_user.bureau_id:
            # Bureau Officer can only view other bureau cases if linked via an overlap alert
            overlap_linked = db.query(OverlapAlert).filter(
                or_(
                    (OverlapAlert.case_a_id == case.id) & OverlapAlert.case_b.has(bureau_id=current_user.bureau_id),
                    (OverlapAlert.case_b_id == case.id) & OverlapAlert.case_a.has(bureau_id=current_user.bureau_id),
                )
            ).first()
            if not overlap_linked:
                raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view cases from other bureaus without an active overlap link")

    return CaseOut.model_validate(case)


@router.post("", response_model=CaseOut, status_code=201)
async def create_case(
    request: Request,
    body: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access")

    case = Case(**body.model_dump())
    db.add(case)
    db.flush()

    # Initial action
    db.add(CaseAction(
        case_id=case.id,
        user_id=current_user.id,
        bureau_id=case.bureau_id,
        action_type=ActionType.CREATED,
        remarks="Case created.",
        timestamp=datetime.utcnow(),
    ))

    # Audit
    db.add(AuditLog(
        user_id=current_user.id,
        action="CASE_CREATED",
        entity_type="case",
        entity_id=case.id,
        details=f'{{"case_code": "{case.case_code}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(case)

    # Automatic cross-bureau overlap detection on creation (Requirement 2)
    sync_overlap_alerts_for_case(db, case.id)

    return CaseOut.model_validate(case)


@router.patch("/{case_id}", response_model=CaseOut)
async def update_case(
    case_id: int,
    request: Request,
    body: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access: Senior Management cannot modify cases")

    case = db.query(Case).options(joinedload(Case.institution)).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        if not case.institution or case.institution.region != current_user.region:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot modify cases outside your region")
    elif current_user.role == UserRole.BUREAU_OFFICER:
        if case.bureau_id != current_user.bureau_id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot modify cases belonging to another bureau")

    old_status = case.status
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(case, field, value)
    case.updated_at = datetime.utcnow()

    db.add(AuditLog(
        user_id=current_user.id,
        action="CASE_UPDATED",
        entity_type="case",
        entity_id=case.id,
        details=f'{{"case_code": "{case.case_code}", "changes": {body.model_dump(exclude_none=True)}}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(case)

    # Automatic cross-bureau overlap detection on edit (Requirement 2)
    sync_overlap_alerts_for_case(db, case.id)

    return CaseOut.model_validate(case)


@router.get("/{case_id}/actions", response_model=list[CaseActionOut])
async def get_case_actions(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actions = (
        db.query(CaseAction)
        .options(joinedload(CaseAction.user), joinedload(CaseAction.bureau))
        .filter(CaseAction.case_id == case_id)
        .order_by(CaseAction.timestamp)
        .all()
    )
    return [CaseActionOut.model_validate(a) for a in actions]


@router.post("/{case_id}/actions", response_model=CaseActionOut, status_code=201)
async def add_case_action(
    case_id: int,
    request: Request,
    body: AddActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access: Senior Management cannot perform actions")

    case = db.query(Case).options(joinedload(Case.bureau), joinedload(Case.institution)).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        if not case.institution or case.institution.region != current_user.region:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot take actions on cases outside your region")
    elif current_user.role == UserRole.BUREAU_OFFICER:
        if case.bureau_id != current_user.bureau_id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot take actions on cases belonging to another bureau")

    old_status = case.status

    if body.new_status and body.new_status != case.status:
        case.status = body.new_status
        case.updated_at = datetime.utcnow()
        if body.new_status == CaseStatus.DISPOSED:
            case.closed_date = datetime.utcnow()

    # Requirement 7: Transfer to another Bureau/Cell
    if body.action_type == ActionType.TRANSFERRED and body.transferred_to_bureau_id:
        target_bureau = db.query(Bureau).filter(Bureau.id == body.transferred_to_bureau_id).first()
        if not target_bureau:
            raise HTTPException(status_code=400, detail="Invalid target bureau for transfer")
        old_bureau_code = case.bureau.code if case.bureau else f"Bureau {case.bureau_id}"
        case.bureau_id = body.transferred_to_bureau_id
        case.updated_at = datetime.utcnow()

        # Notify officers in destination bureau
        dest_officers = db.query(User).filter(User.bureau_id == body.transferred_to_bureau_id, User.is_active == True).all()
        for off in dest_officers:
            db.add(Notification(
                user_id=off.id,
                case_id=case.id,
                notification_type="transfer",
                title=f"Case Transferred to Your Bureau: {case.case_code}",
                message=f"Case {case.case_code} was transferred from {old_bureau_code} to {target_bureau.code} by {current_user.full_name}. Remarks: {body.remarks or 'Transferred for jurisdiction'}",
                is_read=False,
                created_at=datetime.utcnow(),
            ))

    # Requirement 6: Escalation action
    if body.action_type == ActionType.ESCALATED:
        case.status = CaseStatus.ESCALATED
        case.updated_at = datetime.utcnow()

        # Notify Bureau Head / Senior Management
        mgmt_users = db.query(User).filter(
            or_(User.role == UserRole.SENIOR_MANAGEMENT, User.role == UserRole.ADMINISTRATOR),
            User.is_active == True,
        ).all()
        for mgmt in mgmt_users:
            db.add(Notification(
                user_id=mgmt.id,
                case_id=case.id,
                notification_type="transfer",
                title=f"Case Escalated: {case.case_code}",
                message=f"Case {case.case_code} was escalated by {current_user.full_name}. Reason: {body.remarks or 'Requires management review'}",
                is_read=False,
                created_at=datetime.utcnow(),
            ))

    action = CaseAction(
        case_id=case_id,
        user_id=current_user.id,
        bureau_id=current_user.bureau_id or case.bureau_id,
        action_type=body.action_type,
        remarks=body.remarks,
        previous_status=old_status if body.new_status else None,
        new_status=body.new_status or (CaseStatus.ESCALATED if body.action_type == ActionType.ESCALATED else None),
        transferred_to_bureau_id=body.transferred_to_bureau_id,
        timestamp=datetime.utcnow(),
    )
    db.add(action)

    db.add(AuditLog(
        user_id=current_user.id,
        action=f"CASE_ACTION_{body.action_type.value.upper().replace(' ', '_')}",
        entity_type="case",
        entity_id=case_id,
        details=f'{{"action_type": "{body.action_type}", "new_status": "{body.new_status}", "transferred_to": "{body.transferred_to_bureau_id}", "remarks": "{body.remarks}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(action)

    # Sync overlap if bureau changed
    sync_overlap_alerts_for_case(db, case_id)

    return CaseActionOut.model_validate(action)


# ── Bulk Import (Requirement 9) ───────────────────────────────────────────────

@router.post("/bulk-import/preview", response_model=BulkPreviewResponse)
async def preview_bulk_import(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate CSV rows for bulk case import.
    Returns preview of valid vs invalid rows with clear error reasons.
    """
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access: Senior Management cannot import cases")

    content_type = request.headers.get("content-type", "")
    csv_text = ""
    if "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if file_obj and hasattr(file_obj, "read"):
            content = await file_obj.read()
            csv_text = content.decode("utf-8-sig", errors="replace")
        elif "csv_text" in form:
            csv_text = str(form.get("csv_text"))
    else:
        body = await request.json()
        csv_text = body.get("csv_text", "")

    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="CSV content or file is empty")

    reader = csv.DictReader(io.StringIO(csv_text))
    rows_preview = []
    total = 0
    valid_count = 0
    invalid_count = 0

    institutions_by_pid = {inst.aicte_permanent_id.strip(): inst for inst in db.query(Institution).all()}
    bureaus_by_code = {b.code.strip().upper(): b for b in db.query(Bureau).all()}
    existing_case_codes = {c.case_code for c in db.query(Case.case_code).all()}

    for idx, row in enumerate(reader, start=1):
        total += 1
        errors = []
        cleaned = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}

        case_code = cleaned.get("case_code", "")
        aicte_id = cleaned.get("aicte_permanent_id", "")
        bureau_code = cleaned.get("bureau_code", "").upper()
        category = cleaned.get("category", "")
        description = cleaned.get("description", "")
        source = cleaned.get("source", "Portal")
        reference_number = cleaned.get("reference_number", "")
        complainant_name = cleaned.get("complainant_name", "")

        if not case_code:
            errors.append("Missing required field: case_code")
        elif case_code in existing_case_codes:
            errors.append(f"Case code '{case_code}' already exists in system")

        inst = None
        if not aicte_id:
            errors.append("Missing required field: aicte_permanent_id")
        elif aicte_id not in institutions_by_pid:
            errors.append(f"Institution with AICTE ID '{aicte_id}' not found")
        else:
            inst = institutions_by_pid[aicte_id]
            if current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region and inst.region != current_user.region:
                errors.append(f"Institution '{aicte_id}' is outside your region ({current_user.region})")

        bureau = None
        if not bureau_code:
            errors.append("Missing required field: bureau_code")
        elif bureau_code not in bureaus_by_code:
            errors.append(f"Bureau code '{bureau_code}' not recognized")
        else:
            bureau = bureaus_by_code[bureau_code]
            if current_user.role == UserRole.BUREAU_OFFICER and bureau.id != current_user.bureau_id:
                errors.append(f"Cannot import for {bureau_code}: You may only import cases for your own bureau")

        if not category:
            errors.append("Missing required field: category")
        if not description:
            errors.append("Missing required field: description")

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        row_data = {
            "case_code": case_code,
            "aicte_permanent_id": aicte_id,
            "institution_id": inst.id if inst else None,
            "institution_name": inst.name if inst else None,
            "bureau_code": bureau_code,
            "bureau_id": bureau.id if bureau else None,
            "category": category,
            "description": description,
            "source": source,
            "reference_number": reference_number,
            "complainant_name": complainant_name,
        }
        rows_preview.append(BulkImportRowPreview(
            row_num=idx,
            valid=is_valid,
            data=row_data,
            errors=errors,
        ))

    return BulkPreviewResponse(
        total_rows=total,
        valid_count=valid_count,
        invalid_count=invalid_count,
        rows=rows_preview,
    )


@router.post("/bulk-import/confirm")
async def confirm_bulk_import(
    request: Request,
    body: BulkImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk-insert validated case rows.
    Automatically assigns due dates based on configured deadline rules,
    logs actions to the audit trail, and synchronizes overlap detection.
    """
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access: Senior Management cannot import cases")

    imported = 0
    now = datetime.utcnow()
    for item in body.cases:
        inst_id = item.get("institution_id")
        bureau_id = item.get("bureau_id")
        case_code = item.get("case_code")
        category = item.get("category")
        description = item.get("description")
        source = item.get("source", "Portal")
        reference_number = item.get("reference_number")
        complainant_name = item.get("complainant_name")

        if not (inst_id and bureau_id and case_code and category):
            continue

        if db.query(Case).filter(Case.case_code == case_code).first():
            continue

        rule = (
            db.query(DeadlineRule)
            .filter(
                DeadlineRule.is_active == True,
                or_(DeadlineRule.bureau_id == bureau_id, DeadlineRule.bureau_id == None),
                or_(DeadlineRule.category == category, DeadlineRule.category == None),
            )
            .first()
        )
        days = rule.days_to_resolve if rule else 30
        due_date = now + timedelta(days=days)

        new_case = Case(
            case_code=case_code,
            institution_id=inst_id,
            bureau_id=bureau_id,
            category=category,
            description=description,
            status=CaseStatus.PENDING,
            source=source,
            reference_number=reference_number,
            complainant_name=complainant_name,
            received_date=now,
            due_date=due_date,
            created_at=now,
            updated_at=now,
        )
        db.add(new_case)
        db.flush()

        db.add(CaseAction(
            case_id=new_case.id,
            user_id=current_user.id,
            bureau_id=bureau_id,
            action_type=ActionType.CREATED,
            remarks="Case created via bulk CSV import",
            new_status=CaseStatus.PENDING,
            timestamp=now,
        ))

        db.add(AuditLog(
            user_id=current_user.id,
            action="CASE_BULK_IMPORTED",
            entity_type="case",
            entity_id=new_case.id,
            details=f'{{"case_code": "{case_code}", "institution_id": {inst_id}, "bureau_id": {bureau_id}}}',
            ip_address=request.client.host if request.client else "unknown",
        ))

        db.flush()
        sync_overlap_alerts_for_case(db, new_case.id)
        imported += 1

    db.commit()
    return {"message": f"Successfully imported {imported} cases", "imported_count": imported}
