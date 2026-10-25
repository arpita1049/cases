"""
Institutions router: list, search, and institution profiles with consolidated complaint history.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct

from ..database import get_db
from ..models import Institution, Case, OverlapAlert, User, CaseStatus, UserRole
from ..schemas import InstitutionOut, InstitutionSummary, PaginatedInstitutions, CaseOut
from ..routers.auth import get_current_user

router = APIRouter(prefix="/institutions", tags=["Institutions"])


@router.get("", response_model=PaginatedInstitutions)
async def list_institutions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    institution_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Institution)
    if search:
        q = q.filter(
            Institution.name.ilike(f"%{search}%") |
            Institution.aicte_permanent_id.ilike(f"%{search}%")
        )
    if region:
        q = q.filter(Institution.region == region)
    if institution_type:
        q = q.filter(Institution.institution_type == institution_type)

    # Regional Official: restrict to own region
    if current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        q = q.filter(Institution.region == current_user.region)

    total = q.count()
    items = q.order_by(Institution.name).offset((page - 1) * per_page).limit(per_page).all()

    return PaginatedInstitutions(
        total=total, page=page, per_page=per_page,
        items=[InstitutionOut.model_validate(i) for i in items]
    )


@router.get("/{institution_id}", response_model=InstitutionSummary)
async def get_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    cases = db.query(Case).filter(Case.institution_id == institution_id).all()
    open_statuses = {CaseStatus.PENDING, CaseStatus.UNDER_PROCESS, CaseStatus.OVERDUE, CaseStatus.ESCALATED}
    open_cases = sum(1 for c in cases if c.status in open_statuses)
    bureaus_involved = len(set(c.bureau_id for c in cases))

    # Count active (pending) overlap alerts
    active_overlaps = db.query(OverlapAlert).join(
        Case, (OverlapAlert.case_a_id == Case.id) | (OverlapAlert.case_b_id == Case.id)
    ).filter(
        Case.institution_id == institution_id,
        OverlapAlert.review_status == "Pending"
    ).count()

    return InstitutionSummary(
        **InstitutionOut.model_validate(inst).model_dump(),
        total_cases=len(cases),
        open_cases=open_cases,
        bureaus_involved=bureaus_involved,
        active_overlap_alerts=active_overlaps,
    )


@router.get("/{institution_id}/cases", response_model=list[CaseOut])
async def get_institution_cases(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all cases for an institution across ALL bureaus (consolidated view)."""
    cases = db.query(Case).options(
        joinedload(Case.bureau),
        joinedload(Case.officer),
        joinedload(Case.institution),
    ).filter(Case.institution_id == institution_id).order_by(Case.received_date.desc()).all()
    return [CaseOut.model_validate(c) for c in cases]
