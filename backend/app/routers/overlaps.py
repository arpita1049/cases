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
    case_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OverlapAlert).options(
        joinedload(OverlapAlert.case_a).joinedload(Case.institution),
        joinedload(OverlapAlert.case_a).joinedload(Case.bureau),
        joinedload(OverlapAlert.case_b).joinedload(Case.institution),
        joinedload(OverlapAlert.case_b).joinedload(Case.bureau),
    )

    if case_id:
        q = q.filter((OverlapAlert.case_a_id == case_id) | (OverlapAlert.case_b_id == case_id))
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
    IMPORTANT: This NEVER merges, closes, or affects the status of underlying cases.
    It writes an immutable audit record to both cases' action histories.
    """
    if current_user.role == UserRole.SENIOR_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Read-only access")

    alert = db.query(OverlapAlert).filter(OverlapAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Overlap alert not found")

    from datetime import datetime
    from ..models import CaseAction, ActionType
    
    alert.review_status = body.review_status
    alert.reviewed_by = current_user.id
    alert.reviewed_at = datetime.utcnow()
    alert.review_notes = body.review_notes

    # Fetch both cases to log action history in both timelines
    case_a = db.query(Case).options(joinedload(Case.bureau)).filter(Case.id == alert.case_a_id).first()
    case_b = db.query(Case).options(joinedload(Case.bureau)).filter(Case.id == alert.case_b_id).first()

    status_label = body.review_status.value
    notes_str = f" Notes: {body.review_notes}" if body.review_notes else ""

    if case_a and case_b:
        action_a = CaseAction(
            case_id=case_a.id,
            user_id=current_user.id,
            bureau_id=current_user.bureau_id or case_a.bureau_id,
            action_type=ActionType.REMARK_ADDED,
            remarks=f"Overlap review: Marked as '{status_label}' regarding linked case {case_b.case_code} ({case_b.bureau.code if case_b.bureau else 'Cell'}). Case remains open and independent.{notes_str}",
            timestamp=datetime.utcnow(),
        )
        action_b = CaseAction(
            case_id=case_b.id,
            user_id=current_user.id,
            bureau_id=current_user.bureau_id or case_b.bureau_id,
            action_type=ActionType.REMARK_ADDED,
            remarks=f"Overlap review: Marked as '{status_label}' regarding linked case {case_a.case_code} ({case_a.bureau.code if case_a.bureau else 'Cell'}). Case remains open and independent.{notes_str}",
            timestamp=datetime.utcnow(),
        )
        db.add(action_a)
        db.add(action_b)

    db.add(AuditLog(
        user_id=current_user.id,
        action="OVERLAP_ALERT_REVIEWED",
        entity_type="overlap_alert",
        entity_id=alert_id,
        details=f'{{"review_status": "{body.review_status}", "case_a_id": {alert.case_a_id}, "case_b_id": {alert.case_b_id}, "notes": "{body.review_notes}"}}',
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
    Uses tiered matching (Level 1, 2, 3 including TF-IDF description similarity).
    Enforces no false duplicate labelling: same institution alone produces at most LOW.
    NEVER auto-merges or auto-closes any case.
    """
    if current_user.role not in [UserRole.ADMINISTRATOR, UserRole.BUREAU_OFFICER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    import json
    from datetime import datetime
    from collections import defaultdict
    from ..overlap_engine import evaluate_case_overlap, ACTIVE_STATUSES

    active_cases = db.query(Case).options(
        joinedload(Case.institution),
        joinedload(Case.bureau)
    ).filter(Case.status.in_(ACTIVE_STATUSES)).all()

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
                    continue  # Same bureau

                # Check if alert already exists
                exists = db.query(OverlapAlert).filter(
                    or_(
                        (OverlapAlert.case_a_id == ca.id) & (OverlapAlert.case_b_id == cb.id),
                        (OverlapAlert.case_a_id == cb.id) & (OverlapAlert.case_b_id == ca.id),
                    )
                ).first()
                if exists:
                    continue

                eval_result = evaluate_case_overlap(ca, cb)
                if not eval_result:
                    continue

                level, reason, rules, score = eval_result

                alert = OverlapAlert(
                    case_a_id=ca.id,
                    case_b_id=cb.id,
                    match_level=level,
                    reason=reason,
                    match_rules=json.dumps(rules),
                    similarity_score=score,
                    review_status=ReviewStatus.PENDING,
                    created_at=datetime.utcnow(),
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
