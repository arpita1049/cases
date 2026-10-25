"""
Analytics & Reports router.
"""

from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Case, Institution, Bureau, User, CaseStatus, OverlapAlert, UserRole
from ..routers.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
async def reports_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    bureau_id: Optional[int] = Query(None),
    region: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Case)
    if bureau_id:
        q = q.filter(Case.bureau_id == bureau_id)
    if region:
        q = q.join(Case.institution).filter(Case.institution.has(region=region))
    if date_from:
        q = q.filter(Case.received_date >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Case.received_date <= datetime.fromisoformat(date_to))

    total = q.count()
    by_status = {s.value: 0 for s in CaseStatus}
    for status, cnt in db.query(Case.status, func.count(Case.id)).group_by(Case.status).all():
        by_status[status.value] = cnt

    disposed = by_status.get("Disposed", 0)
    disposal_rate = round((disposed / total * 100), 1) if total > 0 else 0

    # Ageing buckets (days since received)
    now = datetime.utcnow()
    all_cases = q.all()
    ageing = {"0-15": 0, "16-30": 0, "31-60": 0, "60+": 0}
    for c in all_cases:
        if c.status == CaseStatus.DISPOSED:
            continue
        age = (now - c.received_date).days
        if age <= 15:
            ageing["0-15"] += 1
        elif age <= 30:
            ageing["16-30"] += 1
        elif age <= 60:
            ageing["31-60"] += 1
        else:
            ageing["60+"] += 1

    return {
        "total_cases": total,
        "by_status": by_status,
        "disposal_rate_pct": disposal_rate,
        "ageing_distribution": ageing,
    }


@router.get("/monthly")
async def monthly_complaints(
    year: int = Query(datetime.utcnow().year),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly complaint intake for the given year."""
    # SQLite strftime for month
    monthly = (
        db.query(
            func.strftime("%m", Case.received_date).label("month"),
            func.count(Case.id).label("count"),
        )
        .filter(func.strftime("%Y", Case.received_date) == str(year))
        .group_by(func.strftime("%m", Case.received_date))
        .all()
    )
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    result = {m: 0 for m in month_names}
    for row in monthly:
        idx = int(row.month) - 1
        result[month_names[idx]] = row.count
    return result


@router.get("/workload")
async def department_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Open cases per Bureau/Cell."""
    open_statuses = [CaseStatus.PENDING, CaseStatus.UNDER_PROCESS, CaseStatus.OVERDUE, CaseStatus.ESCALATED]
    data = (
        db.query(Bureau.code, Bureau.name, func.count(Case.id))
        .join(Case, Case.bureau_id == Bureau.id)
        .filter(Case.status.in_(open_statuses))
        .group_by(Bureau.id)
        .all()
    )
    return [{"code": code, "name": name, "open_cases": cnt} for code, name, cnt in data]


@router.get("/overlap-report")
async def overlap_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..schemas import OverlapAlertOut
    from sqlalchemy.orm import joinedload
    alerts = db.query(OverlapAlert).options(
        joinedload(OverlapAlert.case_a).joinedload(Case.institution),
        joinedload(OverlapAlert.case_a).joinedload(Case.bureau),
        joinedload(OverlapAlert.case_b).joinedload(Case.institution),
        joinedload(OverlapAlert.case_b).joinedload(Case.bureau),
    ).all()
    return [OverlapAlertOut.model_validate(a) for a in alerts]
