"""
Overlap Detection router.
Rule-based matching. NEVER auto-merges, auto-closes, or blocks any case.
All alerts are flagged for human review only.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from ..database import get_db
from ..models import Case, OverlapAlert, AuditLog, User, UserRole, ReviewStatus, MatchLevel
from ..schemas import OverlapAlertOut, ReviewAlertRequest
from ..routers.auth import get_current_user

router = APIRouter(prefix="/overlaps", tags=["Overlap Detection"])


@router.get("", response_model=list[OverlapAlertOut])
async def list_overlaps(
    review_status: Optional[str] = Query(None),
    match_level: Optional[str] = Query(None),
    institution_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OverlapAlert).options(
        joinedload(OverlapAlert.case_a).joinedload(Case.institution),
        joinedload(OverlapAlert.case_a).joinedload(Case.bureau),
        joinedload(OverlapAlert.case_b).joinedload(Case.institution),
        joinedload(OverlapAlert.case_b).joinedload(Case.bureau),
    )

    if review_status:
        q = q.filter(OverlapAlert.review_status == review_status)
    if match_level:
        q = q.filter(OverlapAlert.match_level == match_level)
    if institution_id:
        q = q.join(Case, (OverlapAlert.case_a_id == Case.id) | (OverlapAlert.case_b_id == Case.id))\
            .filter(Case.institution_id == institution_id)

    # Bureau officer: only see overlaps involving their bureau
    if current_user.role == UserRole.BUREAU_OFFICER:
        q = q.join(Case, (OverlapAlert.case_a_id == Case.id) | (OverlapAlert.case_b_id == Case.id))\
            .filter(Case.bureau_id == current_user.bureau_id)

    alerts = q.order_by(OverlapAlert.created_at.desc()).all()
    return [OverlapAlertOut.model_validate(a) for a in alerts]


@router.get("/{alert_id}", response_model=OverlapAlertOut)
async def get_overlap(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(OverlapAlert).options(
        joinedload(OverlapAlert.case_a).joinedload(Case.institution),
        joinedload(OverlapAlert.case_a).joinedload(Case.bureau),
        joinedload(OverlapAlert.case_a).joinedload(Case.officer),
        joinedload(OverlapAlert.case_b).joinedload(Case.institution),
        joinedload(OverlapAlert.case_b).joinedload(Case.bureau),
        joinedload(OverlapAlert.case_b).joinedload(Case.officer),
    ).filter(OverlapAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Overlap alert not found")
    return OverlapAlertOut.model_validate(alert)


@router.patch("/{alert_id}/review", response_model=OverlapAlertOut)
async def review_overlap(
    alert_id: int,
    request: Request,
    body: ReviewAlertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark an overlap alert as Confirmed Related, Dismissed, or Coordinating.
    IMPORTANT: This NEVER merges, closes, or affects the underlying cases.
    """
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access")

    alert = db.query(OverlapAlert).filter(OverlapAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Overlap alert not found")

    from datetime import datetime
    alert.review_status = body.review_status
    alert.reviewed_by = current_user.id
    alert.reviewed_at = datetime.utcnow()
    alert.review_notes = body.review_notes

    db.add(AuditLog(
        user_id=current_user.id,
        action="OVERLAP_ALERT_REVIEWED",
        entity_type="overlap_alert",
        entity_id=alert_id,
        details=f'{{"review_status": "{body.review_status}", "notes": "{body.review_notes}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(alert)
    return OverlapAlertOut.model_validate(alert)


@router.post("/detect", status_code=202)
async def run_overlap_detection(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Re-runs overlap detection rules on all active cases.
    Rule 1: Same AICTE Permanent ID, different Bureau, both active.
    Rule 2: Same category + same institution.
    Rule 3: Shared reference number prefix.
    Does NOT auto-merge or auto-close any case.
    """
    if current_user.role not in [UserRole.ADMINISTRATOR, UserRole.BUREAU_OFFICER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from datetime import datetime
    from collections import defaultdict

    active_statuses = ["Pending", "Under Process", "Overdue", "Escalated"]
    active_cases = db.query(Case).filter(Case.status.in_(active_statuses)).all()

    # Group by institution
    by_inst = defaultdict(list)
    for c in active_cases:
        by_inst[c.institution_id].append(c)

    new_alerts = 0
    for inst_id, cases in by_inst.items():
        if len(cases) < 2:
            continue
        for i in range(len(cases)):
            for j in range(i + 1, len(cases)):
                ca, cb = cases[i], cases[j]
                if ca.bureau_id == cb.bureau_id:
                    continue  # Same bureau – not an overlap

                # Check if alert already exists
                exists = db.query(OverlapAlert).filter(
                    or_(
                        (OverlapAlert.case_a_id == ca.id) & (OverlapAlert.case_b_id == cb.id),
                        (OverlapAlert.case_a_id == cb.id) & (OverlapAlert.case_b_id == ca.id),
                    )
                ).first()
                if exists:
                    continue

                # Rule 1: same institution, different bureau
                rules = ["same_institution_id", "multiple_active_bureaus"]
                reason = "Both cases involve the same institution and are active in different Bureaus simultaneously."

                # Rule 2: same category
                if ca.category == cb.category:
                    rules.append("same_category")
                    reason += " Additionally, both cases share the same complaint category."

                # Rule 3: shared reference prefix
                if ca.reference_number and cb.reference_number:
                    prefix_a = ca.reference_number.split("-")[0]
                    prefix_b = cb.reference_number.split("-")[0]
                    if prefix_a == prefix_b:
                        rules.append("shared_reference_prefix")
                        reason += " Shared reference number prefix detected."

                score = 0.5 + (0.15 * len(rules))
                level = MatchLevel.LOW if score < 0.6 else MatchLevel.MEDIUM if score < 0.8 else MatchLevel.HIGH

                import json
                alert = OverlapAlert(
                    case_a_id=ca.id,
                    case_b_id=cb.id,
                    match_level=level,
                    reason=reason,
                    match_rules=json.dumps(rules),
                    similarity_score=round(min(score, 1.0), 2),
                    review_status=ReviewStatus.PENDING,
                )
                db.add(alert)
                new_alerts += 1

    db.add(AuditLog(
        user_id=current_user.id,
        action="OVERLAP_DETECTION_RUN",
        entity_type="system",
        details=f'{{"new_alerts_created": {new_alerts}}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    return {"message": f"Detection complete. {new_alerts} new alert(s) created.", "new_alerts": new_alerts}
