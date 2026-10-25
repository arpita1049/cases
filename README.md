# AICTE Integrated Complaint Monitoring Dashboard

**Smart India Hackathon (SIH 2026) · Problem Statement SIH26264**  
*Live Demo:* [https://frontend-pxjz.vercel.app](https://frontend-pxjz.vercel.app)

> ⚠️ **Disclaimer:** All data in this application is **SYNTHETIC demo data**. It does not represent official AICTE statistics. This dashboard acts as a monitoring and coordination layer for authorised AICTE officials and complements existing systems (such as CPGRAMS) without replacing them.

---

## 1. System Overview & Core Architecture

The dashboard provides end-to-end multi-bureau visibility, proactive alert triggers, and cross-bureau correlation across AICTE cells:
- **PGRC** (Public Grievance Redressal Cell)
- **RB** (Regulation Bureau)
- **EOA** (Extension of Approval Cell)
- **FDB** (Faculty Development Bureau)
- **IPC** (Infrastructure & Planning Cell)
- **LEGAL** (Legal Cell)

### Key Human-in-the-Loop Guarantee
The system **NEVER** auto-merges, auto-closes, auto-transfers, or blocks any complaint. Cross-bureau overlaps are surfaced as non-destructive intelligence alerts. AICTE officials review and coordinate actions while maintaining full, independent case records and audit trails.

---

## 2. Quick Start (Run Locally)

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### Backend Setup

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
- The backend automatically initializes the database (`aicte_dashboard.db`) and seeds synthetic demo institutions, cases, and rules on startup.
- Interactive Swagger API docs: **http://localhost:8000/api/docs**

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
- Local dashboard runs at: **http://localhost:5173**
- Production bundle verification: `npm run build`

---

## 3. Seed Credentials (All 4 Roles)

| Role | Username | Password | Assigned Scope | Key Capabilities |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Global | Full access, user management, audit log, deadline rule configuration |
| **Bureau Officer** | `pgrc_off1` | `demo123` | PGRC Bureau | Manage PGRC cases; view foreign cases **only** if linked via active overlap; cannot access settings |
| **Bureau Officer** | `rb_off1` | `demo123` | RB Bureau | Manage RB cases; view foreign cases **only** if linked via active overlap |
| **Regional Official** | `north_ro` | `demo123` | North Region | View/act on institutions in North region across all bureaus; 403 on other regions |
| **Regional Official** | `south_ro` | `demo123` | South Region | View/act on institutions in South region across all bureaus; 403 on other regions |
| **Senior Management**| `director` | `demo123` | Global (Read-only) | Read-only access to all dashboards, reports, and case histories; 403 on any edit/mutation |

---

## 4. Role & Permissions Matrix (Backend Enforced with 403)

| Endpoint / Operation | Administrator | Bureau Officer | Regional Official | Senior Management |
|---|:---:|:---:|:---:|:---:|
| **View Dashboard & Summary Reports** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (Read-Only) |
| **View Cases (Own Bureau / Region)** | ✅ All | ✅ Own + Overlap | ✅ Own Region Only | ✅ All (Read-Only) |
| **View Cases (Foreign / Out-of-Region)** | ✅ All | 🔒 403 (Unless Overlap) | 🔒 403 Forbidden | ✅ All (Read-Only) |
| **Create Case (`POST /api/cases`)** | ✅ Allowed | ✅ Own Bureau Only | ✅ Own Region Only | 🔒 403 Forbidden |
| **Update Case (`PATCH /api/cases/{id}`)** | ✅ Allowed | ✅ Own Bureau Only | ✅ Own Region Only | 🔒 403 Forbidden |
| **Add Action / Transfer / Escalate** | ✅ Allowed | ✅ Own Bureau Only | ✅ Own Region Only | 🔒 403 Forbidden |
| **Review Overlap Alert** | ✅ Allowed | ✅ Own Bureau Only | ✅ Own Region Only | 🔒 403 Forbidden |
| **Bulk Import CSV** | ✅ Allowed | ✅ Own Bureau Only | ✅ Own Region Only | 🔒 403 Forbidden |
| **Deadline Rule Config (`/settings/deadline-rules`)** | ✅ Allowed | 🔒 403 Forbidden | 🔒 403 Forbidden | 🔒 403 Forbidden |
| **User Management (`/settings/users`)** | ✅ Allowed | 🔒 403 Forbidden | 🔒 403 Forbidden | 🔒 403 Forbidden |
| **Audit Log Inspection (`/settings/audit-log`)** | ✅ Allowed | 🔒 403 Forbidden | 🔒 403 Forbidden | 🔒 403 Forbidden |

---

## 5. Tiered Overlap Detection Engine

The cross-bureau overlap engine evaluates pairs of complaints across bureaus using a three-tier algorithm:

```
                  ┌──────────────────────────────┐
                  │ Complaint Received / Updated │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
             ┌────────────────────────────────────────┐
             │ Same Institution (AICTE Permanent ID)? │
             └───────┬────────────────────────┬───────┘
                     │ YES                    │ NO
                     ▼                        ▼
      ┌─────────────────────────────┐   No Overlap
      │ Active in Different Bureaus?│
      └──────┬───────────────┬──────┘
             │ NO            │ YES
             ▼               ▼
        Single Bureau   ┌────────────────────────────────────────┐
                        │ Level 1: Common Institution Base Check │
                        │  (Evaluates as LOW overlap)            │
                        └───────────────────┬────────────────────┘
                                            │
                                            ▼
                        ┌────────────────────────────────────────┐
                        │ Level 2: Correlation Engine Check      │
                        │  • Category match/related?             │
                        │  • Shared reference number / prefix?   │
                        │  • Received dates within 14 days?      │
                        └───────────────────┬────────────────────┘
                                            │
                                            ▼
                        ┌────────────────────────────────────────┐
                        │ Level 3: TF-IDF Text Cosine Similarity │
                        │  • Tokenize, stem & vectorise text     │
                        │  • Cosine similarity score             │
                        └───────────────────┬────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
             HIGH Overlap (Score >= 70)                 MEDIUM Overlap (Score >= 40)
             e.g. ABC Institute with PGRC + RB          e.g. Related claims or close dates
```

- **Level 1 (Institution Check):** Different bureaus for the same institution alone evaluates to **LOW** ("common institution across bureaus"). Never falsely labelled as duplicate.
- **Level 2 (Correlation Engine):** Correlates shared external grievance reference numbers (e.g., CPGRAMS prefix), category alignment, and close intake dates (within 14 days).
- **Level 3 (Content Similarity):** Pure Python TF-IDF cosine similarity vectorizer on complaint descriptions.
- **Scoring Thresholds:**
  - `HIGH`: Score $\ge 70$ (e.g. same institution across PGRC and RB with overlapping claims)
  - `MEDIUM`: Score $40 - 69$ (e.g. similar category or close filing dates)
  - `LOW`: Score $< 40$ (e.g. different bureaus for same institution with unrelated claims)

---

## 6. Running Automated Acceptance Tests

To verify that the system satisfies all requirements and constraints, run the automated test suites in `backend/`:

### Master Acceptance Suite (Tests A through J)
```bash
cd backend
python tests/test_acceptance_master.py
```
**Tests Covered:**
- **Test A (Institution-centric view):** Consolidated complaints table with street address, distinct bureau tags, and sorting.
- **Test B (Cross-bureau overlap detection):** ABC Institute flagged as **HIGH** match citing same AICTE ID across PGRC and RB.
- **Test C (No false duplicate labelling):** 3 institutions with unrelated cases in different bureaus evaluate as **LOW** or no alert.
- **Test D (Human-in-the-loop guarantee):** Overlap review records reviewer & timestamp, leaves both cases open, and appends actions to both timelines.
- **Test E (Live drill-down reporting):** Drill-down links, `0-7, 8-15, 16-30, 30+` day ageing buckets, CSV export, formatted PDF export with AICTE header, and audit logging.
- **Test F (Proactive deadlines & escalation):** Editable deadline rules recalculate due dates live; escalating requires a mandatory reason, sets `ESCALATED`, and notifies officials.
- **Test G (Complete audit trail):** Chronological timeline with case creation, transfers, overlap links, and escalations.
- **Test H (Role-based access enforcement):** Strict `403 Forbidden` verification across all 4 roles.
- **Test I (CSV bulk import):** Row-by-row validation, preview with error reasons, and confirmation bulk insertion.
- **Test J (Design and architecture):** Color palette (#1E3A5F, #0F9D8A, #F7F9FC), max cards/charts constraints, and accessibility.

### Individual Test Suites
```bash
# Verify Human-In-The-Loop No Auto-Merge Guarantee
python tests/test_no_automerge.py

# Verify Role-Based Access 403 Enforcement
python tests/test_rbac.py
```

---

## 7. Design System & Accessibility

- **Primary Colors:** Deep Navy `#1E3A5F`, Teal `#0F9D8A`, Off-White background `#F7F9FC`, clean white cards.
- **Muted Status Badges:** Discreet indicators for Pending, Under Process, Action initiated, Disposed, Overdue, and Escalated.
- **Decluttered Layout:** Maximum 4 KPI summary cards per page, maximum 2 charts on the dashboard and reports.
- **Animations:** Subtle 150–200ms transitions on drawers, modals, and interactive buttons.
- **Accessibility:** WCAG AA contrast, keyboard navigable, and full ARIA labels on all icon buttons.
