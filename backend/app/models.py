"""
SQLAlchemy ORM models.
Schema is designed to be easy to migrate to PostgreSQL:
- Use Integer PKs with server_default for compatibility
- Avoid SQLite-only types
- Foreign key constraints are explicitly defined
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float, Boolean
)
from sqlalchemy.orm import relationship
from .database import Base
import enum


# ── Enums ────────────────────────────────────────────────────────────────────

class CaseStatus(str, enum.Enum):
    PENDING = "Pending"
    UNDER_PROCESS = "Under Process"
    ACTION_INITIATED = "Action initiated"
    DISPOSED = "Disposed"
    OVERDUE = "Overdue"
    ESCALATED = "Escalated"
    CLOSED = "Closed"


class MatchLevel(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class ReviewStatus(str, enum.Enum):
    PENDING = "Pending"
    CONFIRMED = "Confirmed"
    DISMISSED = "Dismissed"
    COORDINATING = "Coordinating"


class UserRole(str, enum.Enum):
    ADMINISTRATOR = "Administrator"
    BUREAU_OFFICER = "Bureau/Cell Officer"
    REGIONAL_OFFICIAL = "Regional Official"
    SENIOR_MANAGEMENT = "Senior Management"


class ActionType(str, enum.Enum):
    CREATED = "Created"
    STATUS_CHANGED = "Status Changed"
    TRANSFERRED = "Transferred"
    ESCALATED = "Escalated"
    REMARK_ADDED = "Remark Added"
    DOCUMENT_UPLOADED = "Document Uploaded"
    CLOSED = "Closed"


# ── Models ───────────────────────────────────────────────────────────────────

class Bureau(Base):
    """AICTE Bureau or Cell (e.g., RB, PGRC)."""
    __tablename__ = "bureaus"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)       # e.g., "RB"
    name = Column(String(200), nullable=False)                   # e.g., "Regulation Bureau"
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="bureau")
    cases = relationship("Case", back_populates="bureau")
    case_actions = relationship("CaseAction", back_populates="bureau", foreign_keys="CaseAction.bureau_id")


class User(Base):
    """System user (AICTE official)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    bureau_id = Column(Integer, ForeignKey("bureaus.id"), nullable=True)
    region = Column(String(100), nullable=True)   # for Regional Officials
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bureau = relationship("Bureau", back_populates="users")
    cases_assigned = relationship("Case", back_populates="officer")
    actions = relationship("CaseAction", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Institution(Base):
    """AICTE-affiliated institution."""
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    aicte_permanent_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(300), nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)   # e.g., North, South, East, West, Central
    institution_type = Column(String(100), nullable=True)  # Engineering, Pharmacy, etc.
    created_at = Column(DateTime, default=datetime.utcnow)

    cases = relationship("Case", back_populates="institution")


class Case(Base):
    """A complaint/grievance case."""
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_code = Column(String(50), unique=True, nullable=False)   # e.g., PGRC-2025-0042
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    category = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(CaseStatus), nullable=False, default=CaseStatus.PENDING)
    bureau_id = Column(Integer, ForeignKey("bureaus.id"), nullable=False)
    officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=True)
    closed_date = Column(DateTime, nullable=True)
    source = Column(String(100), nullable=True)   # e.g., CPGRAMS, Direct, Portal
    reference_number = Column(String(100), nullable=True)  # External reference (e.g., CPGRAMS ID)
    complainant_name = Column(String(200), nullable=True)
    complainant_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    institution = relationship("Institution", back_populates="cases")
    bureau = relationship("Bureau", back_populates="cases")
    officer = relationship("User", back_populates="cases_assigned")
    actions = relationship("CaseAction", back_populates="case", cascade="all, delete-orphan")
    overlap_alerts_a = relationship("OverlapAlert", foreign_keys="OverlapAlert.case_a_id", back_populates="case_a")
    overlap_alerts_b = relationship("OverlapAlert", foreign_keys="OverlapAlert.case_b_id", back_populates="case_b")
    notifications = relationship("Notification", back_populates="case")


class CaseAction(Base):
    """Timestamped action history entry for a case."""
    __tablename__ = "case_actions"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    bureau_id = Column(Integer, ForeignKey("bureaus.id"), nullable=True)
    action_type = Column(Enum(ActionType), nullable=False)
    remarks = Column(Text, nullable=True)
    previous_status = Column(Enum(CaseStatus), nullable=True)
    new_status = Column(Enum(CaseStatus), nullable=True)
    transferred_to_bureau_id = Column(Integer, ForeignKey("bureaus.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    case = relationship("Case", back_populates="actions")
    user = relationship("User", back_populates="actions")
    bureau = relationship("Bureau", back_populates="case_actions", foreign_keys=[bureau_id])
    transferred_to_bureau = relationship("Bureau", foreign_keys=[transferred_to_bureau_id])


class OverlapAlert(Base):
    """
    Rule-based overlap detection alert.
    NEVER auto-merges or auto-closes cases. Always requires human review.
    """
    __tablename__ = "overlap_alerts"

    id = Column(Integer, primary_key=True, index=True)
    case_a_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    case_b_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    match_level = Column(Enum(MatchLevel), nullable=False)
    reason = Column(Text, nullable=False)       # Human-readable explanation
    match_rules = Column(Text, nullable=True)   # JSON list of triggered rules
    similarity_score = Column(Float, nullable=True)  # Optional text-similarity 0.0–1.0
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case_a = relationship("Case", foreign_keys=[case_a_id], back_populates="overlap_alerts_a")
    case_b = relationship("Case", foreign_keys=[case_b_id], back_populates="overlap_alerts_b")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class Notification(Base):
    """In-app notification for a user."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    notification_type = Column(String(50), nullable=False)  # overlap|deadline|overdue|transfer
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    case = relationship("Case", back_populates="notifications")


class DeadlineRule(Base):
    """Configurable deadline rules (not hardcoded official timelines)."""
    __tablename__ = "deadline_rules"

    id = Column(Integer, primary_key=True, index=True)
    bureau_id = Column(Integer, ForeignKey("bureaus.id"), nullable=True)  # None = global
    category = Column(String(200), nullable=True)  # None = all categories
    days_to_resolve = Column(Integer, nullable=False)  # Working days
    warn_before_days = Column(Integer, default=3)  # Alert this many days before due date
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bureau = relationship("Bureau")


class AuditLog(Base):
    """Immutable audit trail for sensitive actions."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(200), nullable=False)
    entity_type = Column(String(100), nullable=True)  # "case", "user", "overlap_alert", etc.
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)   # JSON serialised diff or context
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
