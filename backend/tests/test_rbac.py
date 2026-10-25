"""
Unit & integration tests for Role-Based Access Control (Requirement 8).
Verifies strict 403 Forbidden enforcement on backend API endpoints.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Case, Institution, Bureau, OverlapAlert, UserRole, CaseStatus, ActionType
from app.auth import create_access_token

client = TestClient(app)


def get_token_for(username: str) -> str:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise ValueError(f"User {username} not found in DB")
        return create_access_token(data={"sub": str(user.id)})
    finally:
        db.close()


def test_rbac_administrator_permissions():
    """Administrator has full access to settings, user management, and audit log."""
    token = get_token_for("admin")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Can access users list
    res = client.get("/api/settings/users", headers=headers)
    assert res.status_code == 200, f"Admin users failed: {res.text}"

    # 2. Can access deadline rules
    res = client.get("/api/settings/deadline-rules", headers=headers)
    assert res.status_code == 200, f"Admin rules failed: {res.text}"

    # 3. Can access audit log
    res = client.get("/api/settings/audit-log", headers=headers)
    assert res.status_code == 200, f"Admin audit failed: {res.text}"


def test_rbac_bureau_officer_restrictions():
    """
    Bureau Officer:
    - 403 on settings/users
    - 403 on settings/deadline-rules
    - 403 on settings/audit-log
    - Can view own bureau case
    - Can view other bureau case ONLY if linked in active overlap
    - 403 on viewing other bureau case NOT linked in overlap
    - 403 on mutating other bureau case
    """
    token = get_token_for("pgrc_off1")  # PGRC Bureau
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Blocked from admin settings
    assert client.get("/api/settings/users", headers=headers).status_code == 403
    assert client.get("/api/settings/deadline-rules", headers=headers).status_code == 403
    assert client.get("/api/settings/audit-log", headers=headers).status_code == 403

    db = SessionLocal()
    try:
        pgrc_user = db.query(User).filter(User.username == "pgrc_off1").first()
        pgrc_bureau_id = pgrc_user.bureau_id

        # Find own bureau case
        own_case = db.query(Case).filter(Case.bureau_id == pgrc_bureau_id).first()
        assert own_case is not None

        # Find an overlap-linked foreign case (ABC Institute RB case)
        overlap = db.query(OverlapAlert).filter(
            (OverlapAlert.case_a.has(bureau_id=pgrc_bureau_id)) |
            (OverlapAlert.case_b.has(bureau_id=pgrc_bureau_id))
        ).first()
        assert overlap is not None
        linked_case_id = overlap.case_b_id if overlap.case_a.bureau_id == pgrc_bureau_id else overlap.case_a_id

        # Find an unlinked foreign case
        unlinked_case = db.query(Case).filter(
            Case.bureau_id != pgrc_bureau_id,
            Case.id != linked_case_id,
            ~Case.id.in_(db.query(OverlapAlert.case_a_id)),
            ~Case.id.in_(db.query(OverlapAlert.case_b_id))
        ).first()

        # Test view own case: 200 OK
        res = client.get(f"/api/cases/{own_case.id}", headers=headers)
        assert res.status_code == 200

        # Test view overlap-linked foreign case: 200 OK (cross-bureau awareness)
        res = client.get(f"/api/cases/{linked_case_id}", headers=headers)
        assert res.status_code == 200

        # Test view unlinked foreign case: 403 Forbidden
        if unlinked_case:
            res = client.get(f"/api/cases/{unlinked_case.id}", headers=headers)
            assert res.status_code == 403

        # Test mutating foreign case (even if linked): 403 Forbidden
        res = client.patch(f"/api/cases/{linked_case_id}", headers=headers, json={"description": "Hacked"})
        assert res.status_code == 403
        res = client.post(f"/api/cases/{linked_case_id}/actions", headers=headers, json={"action_type": "Remark Added", "remarks": "Unauthorized action"})
        assert res.status_code == 403

    finally:
        db.close()


def test_rbac_regional_official_restrictions():
    """
    Regional Official:
    - 403 on settings/users
    - Can view case in their assigned region
    - 403 on case outside their assigned region
    - 403 on mutating case outside their assigned region
    """
    token = get_token_for("north_ro")  # Region North
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Blocked from settings
    assert client.get("/api/settings/users", headers=headers).status_code == 403

    db = SessionLocal()
    try:
        north_case = db.query(Case).join(Case.institution).filter(Institution.region == "North").first()
        south_case = db.query(Case).join(Case.institution).filter(Institution.region == "South").first()

        assert north_case is not None, "Need at least one North region case in test seed"
        assert south_case is not None, "Need at least one South region case in test seed"

        # Can view North case: 200 OK
        res = client.get(f"/api/cases/{north_case.id}", headers=headers)
        assert res.status_code == 200

        # Forbidden on South case: 403 Forbidden
        res = client.get(f"/api/cases/{south_case.id}", headers=headers)
        assert res.status_code == 403

        # Forbidden on mutating South case: 403 Forbidden
        res = client.patch(f"/api/cases/{south_case.id}", headers=headers, json={"description": "Unauthorized"})
        assert res.status_code == 403

    finally:
        db.close()


def test_rbac_senior_management_read_only():
    """
    Senior Management:
    - Can view cases across all bureaus (200 OK)
    - Can view dashboards and reports (200 OK)
    - 403 Forbidden on create case
    - 403 Forbidden on update case
    - 403 Forbidden on add action / escalate / transfer
    - 403 Forbidden on bulk import
    """
    token = get_token_for("director")
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        case = db.query(Case).first()
        assert case is not None

        # 1. Can view case
        res = client.get(f"/api/cases/{case.id}", headers=headers)
        assert res.status_code == 200

        # 2. Can view dashboard
        res = client.get("/api/dashboard", headers=headers)
        assert res.status_code == 200

        # 3. Can view reports
        res = client.get("/api/reports/summary", headers=headers)
        assert res.status_code == 200

        # 4. 403 on mutate case
        res = client.patch(f"/api/cases/{case.id}", headers=headers, json={"description": "Read-only breach attempt"})
        assert res.status_code == 403

        # 5. 403 on add action
        res = client.post(f"/api/cases/{case.id}/actions", headers=headers, json={"action_type": "Remark Added", "remarks": "Read-only test"})
        assert res.status_code == 403

        # 6. 403 on create case
        res = client.post("/api/cases", headers=headers, json={
            "case_code": "TEST-BREACH-01",
            "institution_id": case.institution_id,
            "bureau_id": case.bureau_id,
            "category": "Test",
            "received_date": "2026-01-01T00:00:00",
        })
        assert res.status_code == 403

        # 7. 403 on bulk import preview
        res = client.post("/api/cases/bulk-import/preview", headers=headers, json={"csv_text": "case_code\nTEST-01"})
        assert res.status_code == 403

    finally:
        db.close()


if __name__ == "__main__":
    print("Running RBAC Test Suite...")
    test_rbac_administrator_permissions()
    print("PASS: Administrator permissions")
    test_rbac_bureau_officer_restrictions()
    print("PASS: Bureau Officer restrictions")
    test_rbac_regional_official_restrictions()
    print("PASS: Regional Official restrictions")
    test_rbac_senior_management_read_only()
    print("PASS: Senior Management read-only enforcement")
    print("\nALL RBAC ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
