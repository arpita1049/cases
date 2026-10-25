# AICTE Integrated Complaint Monitoring Dashboard

**SIH 2026 · Problem Statement SIH26264**

> ⚠️ **All data in this application is SYNTHETIC demo data. It does not represent official AICTE statistics.**

A monitoring and coordination layer for authorised AICTE officials to track institution-related complaint cases across different AICTE Bureaus/Cells (PGRC, RB, EOA, FDB, IPC, LEGAL). Complements existing systems such as CPGRAMS — does not replace them.

---

## Tech Stack

| Layer     | Technology                                           |
|-----------|------------------------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS v4 + Recharts + Lucide |
| Backend   | Python FastAPI                                       |
| Database  | SQLite (prototype) — see migration note below        |
| Auth      | JWT (HS256) + bcrypt password hashing                |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
pip install fastapi uvicorn sqlalchemy passlib[bcrypt] python-jose[cryptography] python-multipart pydantic-settings
python -m uvicorn app.main:app --reload --port 8000
```

The backend auto-creates the SQLite database and seeds synthetic demo data on first run.
API docs available at: **http://localhost:8000/api/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: **http://localhost:5173**

---

## Demo Credentials

| Role                | Username     | Password  |
|---------------------|--------------|-----------|
| Administrator       | `admin`      | `admin123`|
| PGRC Officer        | `pgrc_off1`  | `demo123` |
| RB Officer          | `rb_off1`    | `demo123` |
| Regional (North)    | `north_ro`   | `demo123` |
| Senior Management   | `director`   | `demo123` |

---

## Key Demo Scenario

**ABC Institute of Technology** (AICTE ID: `AICTE-12345`) has:
- **PGRC case** `PGRC-2025-0001` — Student Fee Refund grievance (Under Process)
- **RB case** `RB-2025-0001` — Regulation Violation: Seat Intake (Pending)

These are different issues, but the system automatically raises a **High** overlap alert because the same institution has active cases in two different bureaus simultaneously. Officers can **Confirm Related**, **Dismiss**, or **Coordinate** — the system **never** auto-merges or closes any case.

---

## Project Structure

```
cases/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI app, CORS, route registration, seed on startup
│       ├── database.py      # SQLAlchemy engine (SQLite → PostgreSQL swap: 1 line)
│       ├── models.py        # ORM models: Bureau, User, Institution, Case, etc.
│       ├── schemas.py       # Pydantic request/response schemas
│       ├── auth.py          # JWT + bcrypt utilities
│       ├── seed.py          # Synthetic demo data seeder
│       └── routers/
│           ├── auth.py          # Login, /me
│           ├── dashboard.py     # Summary stats, charts data
│           ├── cases.py         # Case CRUD + action history
│           ├── institutions.py  # Institution list + profile
│           ├── overlaps.py      # Overlap detection + review
│           ├── notifications.py # Alerts management
│           ├── reports.py       # Analytics endpoints
│           └── settings.py      # Admin: users, rules, audit log
└── frontend/
    └── src/
        ├── api/
        │   ├── client.js        # Axios with JWT interceptors
        │   └── endpoints.js     # All API functions
        ├── components/
        │   ├── AppLayout.jsx    # Sidebar + topbar + footer
        │   ├── NotificationsPanel.jsx
        │   ├── StatusBadge.jsx  # Status/Match/Review badges
        │   └── Skeleton.jsx     # Loading skeletons
        ├── context/
        │   └── AuthContext.jsx  # Auth state + login/logout
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── CasesPage.jsx
        │   ├── CaseDrawer.jsx   # Right-side case detail drawer
        │   ├── InstitutionsPage.jsx
        │   ├── InstitutionProfile.jsx
        │   ├── OverlapsPage.jsx
        │   ├── NotificationsPage.jsx
        │   ├── ReportsPage.jsx
        │   └── SettingsPage.jsx
        └── utils/
            └── format.js        # Date/string utilities
```

---

## Migrating from SQLite to PostgreSQL

In `backend/app/database.py`, change one line:

```python
# SQLite (prototype)
DATABASE_URL = "sqlite:///./aicte_dashboard.db"

# PostgreSQL (production)
DATABASE_URL = "postgresql://user:password@host:5432/aicte_dashboard"
```

Remove `connect_args={"check_same_thread": False}` from `create_engine()`. Everything else stays the same.

---

## Role-Based Access

| Feature                | Admin | Bureau Officer | Regional | Senior Mgmt |
|------------------------|-------|----------------|----------|-------------|
| All cases              | ✅    | Own bureau     | Own region | ✅ read-only |
| Add/update cases       | ✅    | ✅            | ❌        | ❌          |
| View overlaps          | ✅    | Own bureau     | ✅        | ✅ read-only |
| Review overlaps        | ✅    | ✅            | ❌        | ❌          |
| Reports                | ✅    | ✅            | ✅        | ✅          |
| User management        | ✅    | ❌            | ❌        | ❌          |

---

## Security Notes

- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with 8-hour expiry
- All sensitive actions logged in `audit_log` table
- Input validated via Pydantic schemas
- CORS restricted to `localhost:5173` (update for production)
- No real personal data — all seed data is synthetic

---

*SIH 2026 Prototype — Not for production use without security review.*
