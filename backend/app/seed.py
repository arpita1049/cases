"""
Database seed script with clearly labelled SYNTHETIC demo data.
~15 institutions, ~60 cases, action histories, overlap alerts.

??  ALL DATA IS SYNTHETIC AND FOR DEMONSTRATION PURPOSES ONLY.
    These figures do NOT represent official AICTE statistics.
"""

from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from .models import (
    Bureau, User, Institution, Case, CaseAction, OverlapAlert,
    Notification, DeadlineRule, AuditLog,
    CaseStatus, MatchLevel, ReviewStatus, UserRole, ActionType
)
from .auth import get_password_hash

# ?? Demo seed data ????????????????????????????????????????????????????????????

BUREAUS = [
    {"code": "PGRC",  "name": "Public Grievance Redressal Cell",
     "description": "Handles student and faculty grievances from external portals like CPGRAMS."},
    {"code": "RB",    "name": "Regulation Bureau",
     "description": "Oversees compliance with AICTE regulations for approved institutions."},
    {"code": "EOA",   "name": "Extension of Approval Cell",
     "description": "Processes annual approval renewals for technical institutions."},
    {"code": "FDB",   "name": "Faculty Development Bureau",
     "description": "Manages complaints related to faculty qualifications and training."},
    {"code": "IPC",   "name": "Infrastructure & Planning Cell",
     "description": "Handles issues related to physical infrastructure compliance."},
    {"code": "LEGAL", "name": "Legal Cell",
     "description": "Handles legal notices, court orders, and associated complaints."},
]

USERS = [
    # Administrators
    {"username": "admin",      "email": "admin@aicte.gov.in",
     "full_name": "System Administrator", "password": "admin123",
     "role": UserRole.ADMINISTRATOR, "bureau_code": None, "region": None},
    # Bureau Officers
    {"username": "pgrc_off1",  "email": "rajesh.kumar@aicte.gov.in",
     "full_name": "Rajesh Kumar",         "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "PGRC", "region": None},
    {"username": "rb_off1",    "email": "priya.sharma@aicte.gov.in",
     "full_name": "Priya Sharma",         "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "RB",   "region": None},
    {"username": "eoa_off1",   "email": "suresh.nair@aicte.gov.in",
     "full_name": "Suresh Nair",          "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "EOA",  "region": None},
    {"username": "fdb_off1",   "email": "anita.rao@aicte.gov.in",
     "full_name": "Anita Rao",            "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "FDB",  "region": None},
    {"username": "ipc_off1",   "email": "vikram.singh@aicte.gov.in",
     "full_name": "Vikram Singh",         "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "IPC",  "region": None},
    {"username": "legal_off1", "email": "kavita.mehta@aicte.gov.in",
     "full_name": "Kavita Mehta",         "password": "demo123",
     "role": UserRole.BUREAU_OFFICER, "bureau_code": "LEGAL","region": None},
    # Regional Officials
    {"username": "north_ro",   "email": "deepak.gupta@aicte.gov.in",
     "full_name": "Deepak Gupta",         "password": "demo123",
     "role": UserRole.REGIONAL_OFFICIAL, "bureau_code": None, "region": "North"},
    {"username": "south_ro",   "email": "lakshmi.iyer@aicte.gov.in",
     "full_name": "Lakshmi Iyer",         "password": "demo123",
     "role": UserRole.REGIONAL_OFFICIAL, "bureau_code": None, "region": "South"},
    {"username": "west_ro",    "email": "manish.patel@aicte.gov.in",
     "full_name": "Manish Patel",         "password": "demo123",
     "role": UserRole.REGIONAL_OFFICIAL, "bureau_code": None, "region": "West"},
    # Senior Management
    {"username": "director",   "email": "director@aicte.gov.in",
     "full_name": "Dr. Arun Mishra",      "password": "demo123",
     "role": UserRole.SENIOR_MANAGEMENT, "bureau_code": None, "region": None},
]

INSTITUTIONS = [
    # The key demo institution ? both PGRC and RB cases trigger overlap
    {"aicte_permanent_id": "AICTE-12345", "name": "ABC Institute of Technology",
     "address": "123, Tech Road, Sector 5", "city": "Noida", "state": "Uttar Pradesh",
     "region": "North", "institution_type": "Engineering"},
    # Other institutions
    {"aicte_permanent_id": "AICTE-23456", "name": "Sunrise Engineering College",
     "address": "Plot 7, Industrial Area", "city": "Pune", "state": "Maharashtra",
     "region": "West", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-34567", "name": "Coastal Institute of Management & Technology",
     "address": "NH-17, Coastal Highway", "city": "Kochi", "state": "Kerala",
     "region": "South", "institution_type": "Management"},
    {"aicte_permanent_id": "AICTE-45678", "name": "Northern Polytechnic Institute",
     "address": "Sector 18, Industrial Zone", "city": "Chandigarh", "state": "Punjab",
     "region": "North", "institution_type": "Polytechnic"},
    {"aicte_permanent_id": "AICTE-56789", "name": "Deccan College of Engineering",
     "address": "Survey No. 42, Nalgonda Road", "city": "Hyderabad", "state": "Telangana",
     "region": "South", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-67890", "name": "Rajputana Institute of Pharmacy",
     "address": "Behind Railway Station", "city": "Jaipur", "state": "Rajasthan",
     "region": "North", "institution_type": "Pharmacy"},
    {"aicte_permanent_id": "AICTE-78901", "name": "Eastern College of Applied Sciences",
     "address": "Salt Lake Sector 3", "city": "Kolkata", "state": "West Bengal",
     "region": "East", "institution_type": "Applied Sciences"},
    {"aicte_permanent_id": "AICTE-89012", "name": "Vindhya Technical University Campus",
     "address": "University Road, Shahdol", "city": "Bhopal", "state": "Madhya Pradesh",
     "region": "Central", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-90123", "name": "Metropolitan Institute of Hotel Management",
     "address": "Airport Road", "city": "Mumbai", "state": "Maharashtra",
     "region": "West", "institution_type": "Hotel Management"},
    {"aicte_permanent_id": "AICTE-11234", "name": "Himalayan College of Architecture",
     "address": "Mall Road", "city": "Shimla", "state": "Himachal Pradesh",
     "region": "North", "institution_type": "Architecture"},
    {"aicte_permanent_id": "AICTE-22345", "name": "Kaveri Institute of Technology & Science",
     "address": "Salem Highway, Krishnagiri District", "city": "Salem", "state": "Tamil Nadu",
     "region": "South", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-33456", "name": "Ganga Valley Polytechnic",
     "address": "Haridwar Bypass Road", "city": "Dehradun", "state": "Uttarakhand",
     "region": "North", "institution_type": "Polytechnic"},
    {"aicte_permanent_id": "AICTE-44567", "name": "Brahmaputra College of Engineering",
     "address": "National Highway 37", "city": "Guwahati", "state": "Assam",
     "region": "East", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-55678", "name": "Saurashtra Technical College",
     "address": "360 Rajkot Road", "city": "Rajkot", "state": "Gujarat",
     "region": "West", "institution_type": "Engineering"},
    {"aicte_permanent_id": "AICTE-66789", "name": "Central India Pharmacy School",
     "address": "Near Civil Hospital", "city": "Nagpur", "state": "Maharashtra",
     "region": "Central", "institution_type": "Pharmacy"},
]

# Case templates (category, description, bureau_code, source)
CASE_TEMPLATES = [
    ("Student Grievance - Fee Refund", "Student complaints regarding refund of fees not processed within stipulated time.", "PGRC", "CPGRAMS"),
    ("Faculty Qualification Non-compliance", "Complaint that teaching staff do not meet minimum qualification norms.", "FDB", "Direct"),
    ("Infrastructure Deficiency", "Reported deficiency in laboratory infrastructure against approved standards.", "IPC", "Portal"),
    ("Annual Approval Discrepancy", "Discrepancy found in submitted documents for Extension of Approval.", "EOA", "Direct"),
    ("Regulation Violation - Seat Intake", "Institution allegedly admitting students beyond approved intake.", "RB", "CPGRAMS"),
    ("Student Grievance - Harassment", "Complaint regarding alleged harassment of student by faculty.", "PGRC", "CPGRAMS"),
    ("Court Order Compliance", "Institution directed by High Court to comply with specific order.", "LEGAL", "Court"),
    ("Faculty Grievance - Service Conditions", "Faculty complaint regarding irregular payment of salaries.", "PGRC", "Portal"),
    ("Accreditation Mismatch", "Claims of displaying accreditation status not awarded by AICTE.", "RB", "Direct"),
    ("Infrastructure - Fire Safety", "Non-compliance with fire safety norms in campus buildings.", "IPC", "Inspection"),
    ("Student Grievance - Degree Certificate", "Delay in issuance of degree certificates to pass-out students.", "PGRC", "CPGRAMS"),
    ("Regulation Violation - Unapproved Program", "Running a technical program without AICTE approval.", "RB", "Inspection"),
]


def seed_database(db: Session) -> None:
    """Populate the database with synthetic demo data."""

    # Check if already seeded
    if db.query(Bureau).count() > 0:
        return

    print("[SEED] Seeding demo database with synthetic data...")

    # 1. Bureaus
    bureau_map = {}
    for b in BUREAUS:
        bureau = Bureau(**b)
        db.add(bureau)
        db.flush()
        bureau_map[b["code"]] = bureau
    db.commit()

    # 2. Users
    user_map = {}
    for u in USERS:
        bureau_id = bureau_map[u["bureau_code"]].id if u["bureau_code"] else None
        user = User(
            username=u["username"],
            email=u["email"],
            full_name=u["full_name"],
            hashed_password=get_password_hash(u["password"]),
            role=u["role"],
            bureau_id=bureau_id,
            region=u["region"],
        )
        db.add(user)
        db.flush()
        user_map[u["username"]] = user
    db.commit()

    # 3. Institutions
    institution_map = {}
    for inst_data in INSTITUTIONS:
        inst = Institution(**inst_data)
        db.add(inst)
        db.flush()
        institution_map[inst_data["aicte_permanent_id"]] = inst
    db.commit()

    # 4. Deadline rules
    rules = [
        DeadlineRule(bureau_id=None, category=None, days_to_resolve=30, warn_before_days=5),
        DeadlineRule(bureau_id=bureau_map["PGRC"].id, category="Student Grievance - Fee Refund",
                     days_to_resolve=15, warn_before_days=3),
        DeadlineRule(bureau_id=bureau_map["RB"].id, category=None, days_to_resolve=45, warn_before_days=7),
        DeadlineRule(bureau_id=bureau_map["LEGAL"].id, category="Court Order Compliance",
                     days_to_resolve=10, warn_before_days=2),
    ]
    for r in rules:
        db.add(r)
    db.commit()

    # 5. Cases (60 synthetic cases)
    now = datetime.utcnow()
    statuses = [CaseStatus.PENDING, CaseStatus.UNDER_PROCESS, CaseStatus.DISPOSED,
                CaseStatus.OVERDUE, CaseStatus.ESCALATED]
    status_weights = [0.25, 0.30, 0.25, 0.12, 0.08]

    # Officers per bureau
    bureau_officers = {
        "PGRC": user_map["pgrc_off1"],
        "RB": user_map["rb_off1"],
        "EOA": user_map["eoa_off1"],
        "FDB": user_map["fdb_off1"],
        "IPC": user_map["ipc_off1"],
        "LEGAL": user_map["legal_off1"],
    }

    all_inst_ids = list(institution_map.keys())
    case_objects = []
    case_counter = {code: 1 for code in bureau_map}

    # ── Deterministic overlap seed cases (AICTE-12345) ──────────────────────
    abc_inst = institution_map["AICTE-12345"]
    pgrc_bureau = bureau_map["PGRC"]
    rb_bureau = bureau_map["RB"]

    # Case A: PGRC case for ABC Institute ("Under process")
    case_abc_pgrc = Case(
        case_code="PGRC-2025-0001",
        institution_id=abc_inst.id,
        category="Student Grievance - Fee Refund",
        description="Multiple students from ABC Institute of Technology have filed complaints regarding refund of fees not being processed even after 45 days of submitting requests. The institution has not responded to communications sent by the cell.",
        status=CaseStatus.UNDER_PROCESS,
        bureau_id=pgrc_bureau.id,
        officer_id=user_map["pgrc_off1"].id,
        received_date=now - timedelta(days=18),
        due_date=now + timedelta(days=5),
        source="CPGRAMS",
        reference_number="CPGRAMS-2025-AICTE-78432",
    )
    db.add(case_abc_pgrc)
    db.flush()
    case_counter["PGRC"] = 2

    # Case B: RB case for ABC Institute ("Action initiated")
    case_abc_rb = Case(
        case_code="RB-2025-0001",
        institution_id=abc_inst.id,
        category="Regulation Violation - Seat Intake",
        description="Inspection report (Ref: RB-INSP-2025-112) indicates ABC Institute of Technology admitted 60 additional students to the B.Tech program beyond the approved intake of 240. Compliance notice issued on 15-Oct-2025.",
        status=CaseStatus.ACTION_INITIATED,
        bureau_id=rb_bureau.id,
        officer_id=user_map["rb_off1"].id,
        received_date=now - timedelta(days=10),
        due_date=now + timedelta(days=20),
        source="Inspection",
        reference_number="RB-INSP-2025-112",
    )
    db.add(case_abc_rb)
    db.flush()
    case_counter["RB"] = 2

    case_objects.extend([case_abc_pgrc, case_abc_rb])

    # ── Seed 3 institutions with 2 unrelated cases across different bureaus (Requirement 3) ──
    # Inst 1: Sunrise Engineering College (AICTE-23456) across EOA and FDB
    inst_sunrise = institution_map["AICTE-23456"]
    case_sunrise_eoa = Case(
        case_code="EOA-2025-0001",
        institution_id=inst_sunrise.id,
        category="Annual Approval Discrepancy",
        description="Discrepancy observed in faculty cadastral map submitted during Extension of Approval for 2025-26.",
        status=CaseStatus.UNDER_PROCESS,
        bureau_id=bureau_map["EOA"].id,
        officer_id=user_map["eoa_off1"].id,
        received_date=now - timedelta(days=80),
        due_date=now + timedelta(days=15),
        source="Portal",
        reference_number="EOA-APP-2025-998",
    )
    case_sunrise_fdb = Case(
        case_code="FDB-2025-0001",
        institution_id=inst_sunrise.id,
        category="Faculty Qualification Non-compliance",
        description="Faculty development program audit noted two adjunct lecturers lacking mandatory AICTE pedagogical training certification.",
        status=CaseStatus.PENDING,
        bureau_id=bureau_map["FDB"].id,
        officer_id=user_map["fdb_off1"].id,
        received_date=now - timedelta(days=15),
        due_date=now + timedelta(days=35),
        source="Direct",
        reference_number="FDB-AUDIT-2025-412",
    )
    db.add(case_sunrise_eoa)
    db.add(case_sunrise_fdb)
    db.flush()
    case_counter["EOA"] = 2
    case_counter["FDB"] = 2
    case_objects.extend([case_sunrise_eoa, case_sunrise_fdb])

    # Inst 2: Coastal Institute (AICTE-34567) across PGRC and IPC
    inst_coastal = institution_map["AICTE-34567"]
    case_coastal_pgrc = Case(
        case_code="PGRC-2025-0002",
        institution_id=inst_coastal.id,
        category="Student Grievance - Harassment",
        description="Complaint regarding hostel accommodation dispute and alleged unfair disciplinary warning.",
        status=CaseStatus.UNDER_PROCESS,
        bureau_id=bureau_map["PGRC"].id,
        officer_id=user_map["pgrc_off1"].id,
        received_date=now - timedelta(days=65),
        due_date=now + timedelta(days=10),
        source="CPGRAMS",
        reference_number="CPGRAMS-2025-AICTE-10044",
    )
    case_coastal_ipc = Case(
        case_code="IPC-2025-0001",
        institution_id=inst_coastal.id,
        category="Infrastructure - Fire Safety",
        description="Local municipality inspection reported pending renewal of fire safety clearance for laboratory block.",
        status=CaseStatus.PENDING,
        bureau_id=bureau_map["IPC"].id,
        officer_id=user_map["ipc_off1"].id,
        received_date=now - timedelta(days=12),
        due_date=now + timedelta(days=25),
        source="Inspection",
        reference_number="IPC-FIRE-2025-871",
    )
    db.add(case_coastal_pgrc)
    db.add(case_coastal_ipc)
    db.flush()
    case_counter["PGRC"] = 3
    case_counter["IPC"] = 2
    case_objects.extend([case_coastal_pgrc, case_coastal_ipc])

    # Inst 3: Rajputana Institute of Pharmacy (AICTE-67890) across RB and LEGAL
    inst_rajputana = institution_map["AICTE-67890"]
    case_rajputana_rb = Case(
        case_code="RB-2025-0002",
        institution_id=inst_rajputana.id,
        category="Accreditation Mismatch",
        description="Advertisement brochure displays unauthorized NBA accreditation badge for diploma program.",
        status=CaseStatus.UNDER_PROCESS,
        bureau_id=bureau_map["RB"].id,
        officer_id=user_map["rb_off1"].id,
        received_date=now - timedelta(days=70),
        due_date=now + timedelta(days=18),
        source="Direct",
        reference_number="RB-ADV-2025-231",
    )
    case_rajputana_legal = Case(
        case_code="LEGAL-2025-0001",
        institution_id=inst_rajputana.id,
        category="Court Order Compliance",
        description="High Court writ petition order concerning land demarcation compliance submitted by trust.",
        status=CaseStatus.PENDING,
        bureau_id=bureau_map["LEGAL"].id,
        officer_id=user_map["legal_off1"].id,
        received_date=now - timedelta(days=8),
        due_date=now + timedelta(days=6),
        source="Court",
        reference_number="LEGAL-HC-2025-099",
    )
    db.add(case_rajputana_rb)
    db.add(case_rajputana_legal)
    db.flush()
    case_counter["RB"] = 3
    case_counter["LEGAL"] = 2
    case_objects.extend([case_rajputana_rb, case_rajputana_legal])

    # ── Random cases for remaining institutions (52 cases to make 60 total) ──
    rng = random.Random(42)  # Fixed seed for reproducibility

    for i in range(52):
        tpl = rng.choice(CASE_TEMPLATES)
        category, description, bureau_code, source = tpl
        bureau = bureau_map[bureau_code]
        inst_pid = rng.choice(all_inst_ids)
        inst = institution_map[inst_pid]
        officer = bureau_officers.get(bureau_code)

        n = case_counter[bureau_code]
        case_counter[bureau_code] += 1
        case_code = f"{bureau_code}-2025-{n:04d}"

        received_days_ago = rng.randint(1, 120)
        received_date = now - timedelta(days=received_days_ago)

        # Deadline based on category
        days_to_resolve = 30 if bureau_code != "LEGAL" else 10
        due_date = received_date + timedelta(days=days_to_resolve)

        # Status: if due_date is past and not disposed, mark overdue
        if due_date < now:
            chosen_status = rng.choices(
                [CaseStatus.OVERDUE, CaseStatus.DISPOSED, CaseStatus.ESCALATED],
                weights=[0.5, 0.4, 0.1]
            )[0]
        else:
            chosen_status = rng.choices(
                [CaseStatus.PENDING, CaseStatus.UNDER_PROCESS],
                weights=[0.4, 0.6]
            )[0]

        closed_date = now - timedelta(days=rng.randint(1, 10)) if chosen_status == CaseStatus.DISPOSED else None

        c = Case(
            case_code=case_code,
            institution_id=inst.id,
            category=category,
            description=description,
            status=chosen_status,
            bureau_id=bureau.id,
            officer_id=officer.id if officer else None,
            received_date=received_date,
            due_date=due_date,
            closed_date=closed_date,
            source=source,
            reference_number=f"REF-{rng.randint(10000, 99999)}",
        )
        db.add(c)
        db.flush()
        case_objects.append(c)

    db.commit()

    # 6. Case Actions (action history for each case)
    action_users = [user_map["pgrc_off1"], user_map["rb_off1"], user_map["eoa_off1"],
                    user_map["fdb_off1"], user_map["ipc_off1"], user_map["legal_off1"]]

    for case_obj in case_objects:
        # Always add a "Created" action
        officer_user = next((u for u in action_users if u.bureau_id == case_obj.bureau_id), action_users[0])
        db.add(CaseAction(
            case_id=case_obj.id,
            user_id=officer_user.id,
            bureau_id=case_obj.bureau_id,
            action_type=ActionType.CREATED,
            remarks="Case registered and assigned for initial review.",
            timestamp=case_obj.received_date,
        ))

        # Add status changes based on current status
        if case_obj.status in (CaseStatus.UNDER_PROCESS, CaseStatus.DISPOSED,
                                CaseStatus.OVERDUE, CaseStatus.ESCALATED):
            db.add(CaseAction(
                case_id=case_obj.id,
                user_id=officer_user.id,
                bureau_id=case_obj.bureau_id,
                action_type=ActionType.STATUS_CHANGED,
                remarks="Initial documents reviewed. Case moved to active processing.",
                previous_status=CaseStatus.PENDING,
                new_status=CaseStatus.UNDER_PROCESS,
                timestamp=case_obj.received_date + timedelta(days=2),
            ))

        if case_obj.status == CaseStatus.ESCALATED:
            db.add(CaseAction(
                case_id=case_obj.id,
                user_id=officer_user.id,
                bureau_id=case_obj.bureau_id,
                action_type=ActionType.ESCALATED,
                remarks="Case escalated to Senior Management due to non-response from institution.",
                previous_status=CaseStatus.UNDER_PROCESS,
                new_status=CaseStatus.ESCALATED,
                timestamp=case_obj.received_date + timedelta(days=15),
            ))

        if case_obj.status == CaseStatus.DISPOSED:
            db.add(CaseAction(
                case_id=case_obj.id,
                user_id=officer_user.id,
                bureau_id=case_obj.bureau_id,
                action_type=ActionType.STATUS_CHANGED,
                remarks="Institution provided satisfactory compliance report. Case closed.",
                previous_status=CaseStatus.UNDER_PROCESS,
                new_status=CaseStatus.DISPOSED,
                timestamp=case_obj.closed_date or (case_obj.received_date + timedelta(days=25)),
            ))

    # Special detailed actions for the ABC Institute overlap demo cases
    db.add(CaseAction(
        case_id=case_abc_pgrc.id,
        user_id=user_map["pgrc_off1"].id,
        bureau_id=pgrc_bureau.id,
        action_type=ActionType.REMARK_ADDED,
        remarks="Communication sent to institution via email and registered post. Awaiting response.",
        timestamp=case_abc_pgrc.received_date + timedelta(days=3),
    ))
    db.add(CaseAction(
        case_id=case_abc_pgrc.id,
        user_id=user_map["pgrc_off1"].id,
        bureau_id=pgrc_bureau.id,
        action_type=ActionType.REMARK_ADDED,
        remarks="Second reminder sent. Institution confirmed receipt. Response expected within 7 days.",
        timestamp=case_abc_pgrc.received_date + timedelta(days=8),
    ))
    db.add(CaseAction(
        case_id=case_abc_rb.id,
        user_id=user_map["rb_off1"].id,
        bureau_id=rb_bureau.id,
        action_type=ActionType.REMARK_ADDED,
        remarks="Show-cause notice issued to the institution. Response required within 15 days.",
        timestamp=case_abc_rb.received_date + timedelta(days=2),
    ))

    db.commit()

    # 7. Overlap Alerts (generated via overlap engine)
    from .overlap_engine import evaluate_case_overlap
    import json

    # Primary flagship overlap: ABC Institute PGRC + RB (High match level, reason includes 'same AICTE ID across PGRC and RB')
    res_abc = evaluate_case_overlap(case_abc_pgrc, case_abc_rb)
    if res_abc:
        lvl, rsn, rls, scr = res_abc
        overlap_abc = OverlapAlert(
            case_a_id=case_abc_pgrc.id,
            case_b_id=case_abc_rb.id,
            match_level=lvl,
            reason=rsn,
            match_rules=json.dumps(rls),
            similarity_score=scr,
            review_status=ReviewStatus.PENDING,
            created_at=datetime.utcnow(),
        )
        db.add(overlap_abc)

    # 3 institutions with unrelated cases across different bureaus (Requirement 3: strictly LOW)
    unrelated_pairs = [
        (case_sunrise_eoa, case_sunrise_fdb, ReviewStatus.PENDING),
        (case_coastal_pgrc, case_coastal_ipc, ReviewStatus.CONFIRMED),
        (case_rajputana_rb, case_rajputana_legal, ReviewStatus.DISMISSED),
    ]

    for ca, cb, rev_st in unrelated_pairs:
        res = evaluate_case_overlap(ca, cb)
        if res:
            lvl, rsn, rls, scr = res
            oa = OverlapAlert(
                case_a_id=ca.id,
                case_b_id=cb.id,
                match_level=lvl,  # Low match
                reason=rsn,
                match_rules=json.dumps(rls),
                similarity_score=scr,
                review_status=rev_st,
                reviewed_by=user_map["admin"].id if rev_st != ReviewStatus.PENDING else None,
                reviewed_at=datetime.utcnow() - timedelta(days=2) if rev_st != ReviewStatus.PENDING else None,
                review_notes="Verified as distinct matters handled by respective bureaus." if rev_st == ReviewStatus.CONFIRMED else ("Dismissed - no mutual bureau coordination required." if rev_st == ReviewStatus.DISMISSED else None),
                created_at=datetime.utcnow() - timedelta(days=3),
            )
            db.add(oa)

    db.commit()

    # 8. Notifications (for demo users)
    for user in [user_map["pgrc_off1"], user_map["rb_off1"], user_map["admin"]]:
        db.add(Notification(
            user_id=user.id,
            case_id=case_abc_pgrc.id,
            notification_type="overlap",
            title="Potential Overlap Detected",
            message=f"Case {case_abc_pgrc.case_code} has a potential overlap with {case_abc_rb.case_code} at ABC Institute of Technology. Flagged for human review.",
            is_read=False,
        ))
        db.add(Notification(
            user_id=user.id,
            case_id=case_abc_pgrc.id,
            notification_type="deadline",
            title="Approaching Deadline",
            message=f"Case {case_abc_pgrc.case_code} is due in 5 days. Please update the status.",
            is_read=False,
        ))

    db.commit()

    # 9. Audit log entries
    db.add(AuditLog(
        user_id=user_map["admin"].id,
        action="DATABASE_SEEDED",
        entity_type="system",
        entity_id=None,
        details='{"note": "Synthetic demo data loaded for SIH 2026 prototype demonstration."}',
        ip_address="127.0.0.1",
    ))
    db.add(AuditLog(
        user_id=user_map["pgrc_off1"].id,
        action="CASE_STATUS_CHANGED",
        entity_type="case",
        entity_id=case_abc_pgrc.id,
        details=f'{{"case_code": "{case_abc_pgrc.case_code}", "from": "Pending", "to": "Under Process"}}',
        ip_address="192.168.1.10",
    ))
    db.commit()

    print("[SEED] Demo seed complete. complete. All data is SYNTHETIC and for demonstration only.")
