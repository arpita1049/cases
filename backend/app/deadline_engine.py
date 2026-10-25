"""
Proactive Deadline & Escalation Engine.
Computes for every case: on track, approaching deadline, overdue.
Reads configurable deadline rules per category and bureau.
Regenerates deadline and overdue alerts without duplicating existing ones.
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from .models import Case, DeadlineRule, Notification, User, CaseStatus, UserRole


def get_rule_for_case(db: Session, bureau_id: Optional[int], category: Optional[str]) -> Tuple[int, int]:
    """
    Finds the most specific active deadline rule.
    Hierarchy:
    1. Matching bureau AND matching category
    2. Matching category (global bureau)
    3. Matching bureau (all categories)
    4. Global fallback
    Returns (days_to_resolve, warn_before_days).
    """
    rules = db.query(DeadlineRule).filter(DeadlineRule.is_active == True).all()

    # Match 1: bureau and category
    for r in rules:
        if r.bureau_id == bureau_id and r.category and category and r.category.strip().lower() == category.strip().lower():
            return r.days_to_resolve, r.warn_before_days

    # Match 2: category only
    for r in rules:
        if r.bureau_id is None and r.category and category and r.category.strip().lower() == category.strip().lower():
            return r.days_to_resolve, r.warn_before_days

    # Match 3: bureau only
    for r in rules:
        if r.bureau_id == bureau_id and (not r.category or r.category.strip() == ""):
            return r.days_to_resolve, r.warn_before_days

    # Match 4: global default rule
    for r in rules:
        if r.bureau_id is None and (not r.category or r.category.strip() == ""):
            return r.days_to_resolve, r.warn_before_days

    return 30, 3  # Fallback default


def regenerate_deadline_alerts(db: Session) -> dict:
    """
    Evaluates all active cases against deadline rules and generates notifications.
    Ensures NO duplicate notifications are created.
    Updates case status to Overdue if due_date has elapsed.
    """
    now = datetime.utcnow()
    active_statuses = [
        CaseStatus.PENDING,
        CaseStatus.UNDER_PROCESS,
        CaseStatus.ACTION_INITIATED,
        CaseStatus.OVERDUE,
        CaseStatus.ESCALATED,
    ]

    cases = db.query(Case).filter(Case.status.in_(active_statuses)).all()
    created_deadline = 0
    created_overdue = 0

    for case in cases:
        days_to_resolve, warn_before = get_rule_for_case(db, case.bureau_id, case.category)

        # If due_date is missing, compute it from received_date + days_to_resolve
        if not case.due_date and case.received_date:
            case.due_date = case.received_date + timedelta(days=days_to_resolve)

        if not case.due_date:
            continue

        days_remaining = (case.due_date - now).total_seconds() / 86400.0

        # Target recipients: assigned officer, bureau officers, administrators
        recipients = (
            db.query(User)
            .filter(
                or_(
                    User.bureau_id == case.bureau_id,
                    User.role == UserRole.ADMINISTRATOR,
                    User.id == case.officer_id,
                ),
                User.is_active == True,
            )
            .all()
        )

        if days_remaining < 0:
            # Overdue
            if case.status in [CaseStatus.PENDING, CaseStatus.UNDER_PROCESS, CaseStatus.ACTION_INITIATED]:
                case.status = CaseStatus.OVERDUE

            # Check if overdue alert already exists for this case
            existing = (
                db.query(Notification)
                .filter(
                    Notification.case_id == case.id,
                    Notification.notification_type == "overdue",
                )
                .first()
            )
            if not existing:
                for u in recipients:
                    db.add(Notification(
                        user_id=u.id,
                        case_id=case.id,
                        notification_type="overdue",
                        title=f"Overdue Alert: {case.case_code}",
                        message=f"Case {case.case_code} ({case.category}) was due on {case.due_date.strftime('%d-%b-%Y')} and is overdue.",
                        is_read=False,
                        created_at=now,
                    ))
                created_overdue += 1

        elif days_remaining <= warn_before:
            # Approaching deadline
            existing = (
                db.query(Notification)
                .filter(
                    Notification.case_id == case.id,
                    Notification.notification_type == "deadline",
                )
                .first()
            )
            if not existing:
                days_int = max(1, int(round(days_remaining)))
                for u in recipients:
                    db.add(Notification(
                        user_id=u.id,
                        case_id=case.id,
                        notification_type="deadline",
                        title=f"Approaching Deadline: {case.case_code}",
                        message=f"Case {case.case_code} is due in {days_int} day(s) on {case.due_date.strftime('%d-%b-%Y')}. Action required.",
                        is_read=False,
                        created_at=now,
                    ))
                created_deadline += 1

    db.commit()
    return {"new_overdue_alerts": created_overdue, "new_deadline_alerts": created_deadline}
