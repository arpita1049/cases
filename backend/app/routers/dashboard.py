"""
Dashboard router: summary stats, chart data, attention panel, overlap panel.
"""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db
from ..models import Case, OverlapAlert, Bureau, User, CaseStatus, UserRole, ReviewStatus
from ..schemas import DashboardStats, CaseOut, OverlapAlertOut
from ..routers.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _base_case_query(db: Session, current_user: User):
    """Filter cases by role."""
    q = db.query(Case)
    if current_user.role == UserRole.BUREAU_OFFICER:
        q = q.filter(Case.bureau_id == current_user.bureau_id)
    elif current_user.role == UserRole.REGIONAL_OFFICIAL and current_user.region:
        q = q.join(Case.institution).filter(
            Case.institution.has(region=current_user.region)
        )
    return q


@router.get("", response_model=DashboardStats)
async def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    base_q = _base_case_query(db, current_user)

    total_cases = base_q.count()
    pending_cases = base_q.filter(
        Case.status.in_([CaseStatus.PENDING, CaseStatus.UNDER_PROCESS])
    ).count()
    overdue_cases = base_q.filter(
        Case.status.in_([CaseStatus.OVERDUE, CaseStatus.ESCALATED])
    ).count()

    # Overlap alerts count (pending review)
    overlap_q = db.query(OverlapAlert).filter(OverlapAlert.review_status == ReviewStatus.PENDING)
    if current_user.role == UserRole.BUREAU_OFFICER:
        overlap_q = overlap_q.join(Case, (OverlapAlert.case_a_id == Case.id) | (OverlapAlert.case_b_id == Case.id))\
            .filter(Case.bureau_id == current_user.bureau_id)
    overlap_count = overlap_q.count()

    # Cases by status
    status_data = db.query(Case.status, func.count(Case.id)).group_by(Case.status).all()
    cases_by_status = [{"status": s.value, "count": cnt} for s, cnt in status_data]

    # Cases by Bureau
    bureau_data = (
        db.query(Bureau.id, Bureau.code, Bureau.name, func.count(Case.id))
        .join(Case, Case.bureau_id == Bureau.id)
        .group_by(Bureau.id)
        .all()
    )
    cases_by_bureau = [{"id": bid, "code": code, "name": name, "count": cnt} for bid, code, name, cnt in bureau_data]

    # Needs attention: overdue or near-deadline cases
    attention_cases = (
        _base_case_query(db, current_user)
        .options(joinedload(Case.institution), joinedload(Case.bureau), joinedload(Case.officer))
        .filter(Case.status.in_([CaseStatus.OVERDUE, CaseStatus.ESCALATED, CaseStatus.PENDING, CaseStatus.UNDER_PROCESS]))
        .order_by(Case.due_date.asc().nullslast())
        .limit(5)
        .all()
    )

    # Recent overlap alerts
    overlap_alerts = (
        db.query(OverlapAlert)
        .options(
            joinedload(OverlapAlert.case_a).joinedload(Case.institution),
            joinedload(OverlapAlert.case_a).joinedload(Case.bureau),
            joinedload(OverlapAlert.case_b).joinedload(Case.institution),
            joinedload(OverlapAlert.case_b).joinedload(Case.bureau),
        )
        .filter(OverlapAlert.review_status == ReviewStatus.PENDING)
        .order_by(OverlapAlert.created_at.desc())
        .limit(3)
        .all()
    )

    return DashboardStats(
        total_cases=total_cases,
        pending_cases=pending_cases,
        overdue_cases=overdue_cases,
        overlap_alerts=overlap_count,
        cases_by_status=cases_by_status,
        cases_by_bureau=cases_by_bureau,
        needs_attention=[CaseOut.model_validate(c) for c in attention_cases],
        recent_overlap_alerts=[OverlapAlertOut.model_validate(a) for a in overlap_alerts],
    )
