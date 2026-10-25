"""
Cases router: CRUD + actions + filtering.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from ..database import get_db
from ..models import Case, CaseAction, AuditLog, Notification, User, OverlapAlert, UserRole, CaseStatus, ActionType
from ..schemas import (
    CaseOut, CaseCreate, CaseUpdate, CaseActionOut, AddActionRequest,
    PaginatedCases
)
from ..routers.auth import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])


def _case_query(db: Session, current_user: User):
    """Base query filtered by role."""
    q = db.query(Case).options(
        joinedload(Case.institution),
        joinedload(Case.bureau),
        joinedload(Case.officer),
    )
    if current_user.role == UserRole.BUREAU_OFFICER:
        # Own bureau cases + related overlap cases (read-only handled in frontend)
        q = q.filter(Case.bureau_id == current_user.bureau_id)
    elif current_user.role == UserRole.REGIONAL_OFFICIAL:
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _case_query(db, current_user)

    if search:
        q = q.filter(or_(
            Case.case_code.ilike(f"%{search}%"),
            Case.category.ilike(f"%{search}%"),
            Case.description.ilike(f"%{search}%"),
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

    total = q.count()
    items = q.order_by(Case.received_date.desc()).offset((page - 1) * per_page).limit(per_page).all()

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
        raise HTTPException(status_code=403, detail="Read-only access")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

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
        raise HTTPException(status_code=403, detail="Read-only access")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    old_status = case.status

    if body.new_status and body.new_status != case.status:
        case.status = body.new_status
        case.updated_at = datetime.utcnow()
        if body.new_status == CaseStatus.DISPOSED:
            case.closed_date = datetime.utcnow()

    action = CaseAction(
        case_id=case_id,
        user_id=current_user.id,
        bureau_id=current_user.bureau_id or case.bureau_id,
        action_type=body.action_type,
        remarks=body.remarks,
        previous_status=old_status if body.new_status else None,
        new_status=body.new_status,
        transferred_to_bureau_id=body.transferred_to_bureau_id,
        timestamp=datetime.utcnow(),
    )
    db.add(action)

    db.add(AuditLog(
        user_id=current_user.id,
        action=f"CASE_ACTION_{body.action_type.value.upper().replace(' ', '_')}",
        entity_type="case",
        entity_id=case_id,
        details=f'{{"action_type": "{body.action_type}", "new_status": "{body.new_status}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(action)
    return CaseActionOut.model_validate(action)
