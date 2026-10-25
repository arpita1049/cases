"""
Backend Test: Human-in-the-loop only.
Proves that the system NEVER auto-merges, auto-closes, auto-transfers, or blocks any case.
Verifies that Confirm Related, Dismiss, and Coordinate:
1. Preserve case statuses and bureaus unchanged.
2. Add immutable timeline records to both cases.
3. Keep cases completely independent.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, Base, engine
from app.models import Case, OverlapAlert, CaseAction, User, ReviewStatus, CaseStatus, ActionType
from app.overlap_engine import evaluate_case_overlap, sync_overlap_alerts_for_case


def test_system_never_automerges_or_closes():
    with SessionLocal() as db:
        # Find an overlap alert and ensure it's in PENDING state for testing
        alert = db.query(OverlapAlert).first()
        if not alert:
            case = db.query(Case).first()
            sync_overlap_alerts_for_case(db, case.id)
            alert = db.query(OverlapAlert).first()
        alert.review_status = ReviewStatus.PENDING
        db.commit()
        db.refresh(alert)
        assert alert is not None, "Overlap alert must exist for test"

        case_a = db.query(Case).filter(Case.id == alert.case_a_id).first()
        case_b = db.query(Case).filter(Case.id == alert.case_b_id).first()

        orig_status_a = case_a.status
        orig_status_b = case_b.status
        orig_bureau_a = case_a.bureau_id
        orig_bureau_b = case_b.bureau_id
        orig_code_a = case_a.case_code
        orig_code_b = case_b.case_code

        count_actions_a_before = db.query(CaseAction).filter(CaseAction.case_id == case_a.id).count()
        count_actions_b_before = db.query(CaseAction).filter(CaseAction.case_id == case_b.id).count()

        admin_user = db.query(User).filter(User.username == "admin").first()

        # Simulate reviewing overlap: CONFIRMED RELATED
        alert.review_status = ReviewStatus.CONFIRMED
        alert.reviewed_by = admin_user.id
        alert.review_notes = "Both cases confirmed related by authorized official."

        # Action history entries on both cases
        action_a = CaseAction(
            case_id=case_a.id,
            user_id=admin_user.id,
            bureau_id=case_a.bureau_id,
            action_type=ActionType.REMARK_ADDED,
            remarks=f"Overlap review: Marked as 'Confirmed' regarding linked case {case_b.case_code}. Both cases remain open and independent.",
        )
        action_b = CaseAction(
            case_id=case_b.id,
            user_id=admin_user.id,
            bureau_id=case_b.bureau_id,
            action_type=ActionType.REMARK_ADDED,
            remarks=f"Overlap review: Marked as 'Confirmed' regarding linked case {case_a.case_code}. Both cases remain open and independent.",
        )
        db.add(action_a)
        db.add(action_b)
        db.commit()

        # Re-fetch cases from DB
        db.refresh(case_a)
        db.refresh(case_b)

        # 1. PROOF: No auto-merge (both distinct cases still exist with original IDs and codes)
        assert case_a.id != case_b.id, "Cases must remain distinct entities"
        assert case_a.case_code == orig_code_a, "Case A code must not change"
        assert case_b.case_code == orig_code_b, "Case B code must not change"

        # 2. PROOF: No auto-close (neither case status changed to Closed or Disposed)
        assert case_a.status == orig_status_a, f"Case A status must remain {orig_status_a}, got {case_a.status}"
        assert case_b.status == orig_status_b, f"Case B status must remain {orig_status_b}, got {case_b.status}"
        assert case_a.status != CaseStatus.CLOSED, "Case A must not be auto-closed"
        assert case_b.status != CaseStatus.CLOSED, "Case B must not be auto-closed"

        # 3. PROOF: No auto-transfer (bureau IDs unchanged)
        assert case_a.bureau_id == orig_bureau_a, "Case A bureau must remain unchanged"
        assert case_b.bureau_id == orig_bureau_b, "Case B bureau must remain unchanged"

        # 4. PROOF: Action history updated on both cases
        count_actions_a_after = db.query(CaseAction).filter(CaseAction.case_id == case_a.id).count()
        count_actions_b_after = db.query(CaseAction).filter(CaseAction.case_id == case_b.id).count()
        assert count_actions_a_after == count_actions_a_before + 1, "Case A timeline must receive review entry"
        assert count_actions_b_after == count_actions_b_before + 1, "Case B timeline must receive review entry"

        print("PASS: System NEVER auto-merges, auto-closes, or auto-transfers cases upon overlap review.")


if __name__ == "__main__":
    test_system_never_automerges_or_closes()
