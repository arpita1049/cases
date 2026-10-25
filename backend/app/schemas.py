"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .models import CaseStatus, MatchLevel, ReviewStatus, UserRole, ActionType


# ── Auth ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Bureau ───────────────────────────────────────────────────────────────────

class BureauOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


# ── User ─────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    bureau_id: Optional[int] = None
    bureau: Optional[BureauOut] = None
    region: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: UserRole
    bureau_id: Optional[int] = None
    region: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    bureau_id: Optional[int] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


# ── Institution ───────────────────────────────────────────────────────────────

class InstitutionOut(BaseModel):
    id: int
    aicte_permanent_id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    institution_type: Optional[str] = None

    class Config:
        from_attributes = True


class InstitutionSummary(InstitutionOut):
    total_cases: int = 0
    open_cases: int = 0
    bureaus_involved: int = 0
    active_overlap_alerts: int = 0


# ── Case ─────────────────────────────────────────────────────────────────────

class CaseOut(BaseModel):
    id: int
    case_code: str
    institution_id: int
    institution: Optional[InstitutionOut] = None
    category: str
    description: Optional[str] = None
    status: CaseStatus
    bureau_id: int
    bureau: Optional[BureauOut] = None
    officer_id: Optional[int] = None
    officer: Optional[UserOut] = None
    received_date: datetime
    due_date: Optional[datetime] = None
    closed_date: Optional[datetime] = None
    source: Optional[str] = None
    reference_number: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CaseCreate(BaseModel):
    case_code: str
    institution_id: int
    category: str
    description: Optional[str] = None
    status: CaseStatus = CaseStatus.PENDING
    bureau_id: int
    officer_id: Optional[int] = None
    received_date: datetime
    due_date: Optional[datetime] = None
    source: Optional[str] = None
    reference_number: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_type: Optional[str] = None


class CaseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    bureau_id: Optional[int] = None
    officer_id: Optional[int] = None
    due_date: Optional[datetime] = None
    source: Optional[str] = None
    reference_number: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_type: Optional[str] = None


# ── CaseAction ────────────────────────────────────────────────────────────────

class CaseActionOut(BaseModel):
    id: int
    case_id: int
    user_id: Optional[int] = None
    user: Optional[UserOut] = None
    bureau_id: Optional[int] = None
    bureau: Optional[BureauOut] = None
    action_type: ActionType
    remarks: Optional[str] = None
    previous_status: Optional[CaseStatus] = None
    new_status: Optional[CaseStatus] = None
    transferred_to_bureau_id: Optional[int] = None
    transferred_to_bureau: Optional[BureauOut] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class AddActionRequest(BaseModel):
    action_type: ActionType
    remarks: Optional[str] = None
    new_status: Optional[CaseStatus] = None
    transferred_to_bureau_id: Optional[int] = None


# ── OverlapAlert ──────────────────────────────────────────────────────────────

class OverlapAlertOut(BaseModel):
    id: int
    case_a_id: int
    case_b_id: int
    case_a: Optional[CaseOut] = None
    case_b: Optional[CaseOut] = None
    match_level: MatchLevel
    reason: str
    match_rules: Optional[str] = None
    similarity_score: Optional[float] = None
    review_status: ReviewStatus
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewAlertRequest(BaseModel):
    review_status: ReviewStatus
    review_notes: Optional[str] = None


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    user_id: int
    case_id: Optional[int] = None
    case: Optional[CaseOut] = None
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_cases: int
    pending_cases: int
    overdue_cases: int
    overlap_alerts: int
    cases_by_status: List[dict]
    cases_by_bureau: List[dict]
    needs_attention: List[CaseOut]
    recent_overlap_alerts: List[OverlapAlertOut]


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user: Optional[UserOut] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# ── Deadline Rule ─────────────────────────────────────────────────────────────

class DeadlineRuleOut(BaseModel):
    id: int
    bureau_id: Optional[int] = None
    bureau: Optional[BureauOut] = None
    category: Optional[str] = None
    days_to_resolve: int
    warn_before_days: int
    is_active: bool

    class Config:
        from_attributes = True


class DeadlineRuleCreate(BaseModel):
    bureau_id: Optional[int] = None
    category: Optional[str] = None
    days_to_resolve: int
    warn_before_days: int = 3


class DeadlineRuleUpdate(BaseModel):
    bureau_id: Optional[int] = None
    category: Optional[str] = None
    days_to_resolve: Optional[int] = None
    warn_before_days: Optional[int] = None
    is_active: Optional[bool] = None


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedCases(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[CaseOut]


class PaginatedInstitutions(BaseModel):
    total: int
    page: int
    per_page: int
    items: List[InstitutionOut]


# ── Bulk Import (Requirement 9) ───────────────────────────────────────────────

class BulkImportRowPreview(BaseModel):
    row_num: int
    valid: bool
    data: dict
    errors: List[str] = []


class BulkPreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    invalid_count: int
    rows: List[BulkImportRowPreview]


class BulkImportConfirmRequest(BaseModel):
    cases: List[dict]


Token.model_rebuild()
