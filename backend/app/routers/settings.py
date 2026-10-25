"""
Settings & User Management router (Administrator only).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from fastapi import Query

from ..database import get_db
from ..models import User, Bureau, DeadlineRule, AuditLog, UserRole
from ..schemas import UserOut, UserCreate, UserUpdate, BureauOut, DeadlineRuleOut, DeadlineRuleCreate, DeadlineRuleUpdate, AuditLogOut
from ..auth import get_password_hash
from ..routers.auth import get_current_user
from ..deadline_engine import regenerate_deadline_alerts

router = APIRouter(prefix="/settings", tags=["Settings"])


def admin_only(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return current_user


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    users = db.query(User).options(joinedload(User.bureau)).all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    request: Request,
    body: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        hashed_password=get_password_hash(body.password),
        role=body.role,
        bureau_id=body.bureau_id,
        region=body.region,
    )
    db.add(user)
    db.add(AuditLog(
        user_id=admin.id,
        action="USER_CREATED",
        entity_type="user",
        details=f'{{"username": "{body.username}", "role": "{body.role}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    request: Request,
    body: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.add(AuditLog(
        user_id=admin.id,
        action="USER_UPDATED",
        entity_type="user",
        entity_id=user_id,
        details=f'{body.model_dump(exclude_none=True)}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


# ── Bureaus ───────────────────────────────────────────────────────────────────

@router.get("/bureaus", response_model=list[BureauOut])
async def list_bureaus(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [BureauOut.model_validate(b) for b in db.query(Bureau).all()]


# ── Deadline Rules ────────────────────────────────────────────────────────────

@router.get("/deadline-rules", response_model=list[DeadlineRuleOut])
async def list_deadline_rules(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    rules = db.query(DeadlineRule).options(joinedload(DeadlineRule.bureau)).all()
    return [DeadlineRuleOut.model_validate(r) for r in rules]


@router.post("/deadline-rules", response_model=DeadlineRuleOut, status_code=201)
async def create_deadline_rule(
    request: Request,
    body: DeadlineRuleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    rule = DeadlineRule(**body.model_dump())
    db.add(rule)
    db.flush()
    db.add(AuditLog(
        user_id=admin.id,
        action="DEADLINE_RULE_CREATED",
        entity_type="deadline_rule",
        entity_id=rule.id,
        details=f'{{"category": "{rule.category}", "days": {rule.days_to_resolve}, "warn_before": {rule.warn_before_days}}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(rule)

    # Regenerate alerts based on new rule (Requirement 6)
    regenerate_deadline_alerts(db)

    return DeadlineRuleOut.model_validate(rule)


@router.patch("/deadline-rules/{rule_id}", response_model=DeadlineRuleOut)
async def update_deadline_rule(
    rule_id: int,
    request: Request,
    body: DeadlineRuleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    """
    Update deadline rule days and approaching warning threshold.
    Regenerates deadline alerts across active cases (Requirement 6 & Acceptance Test F).
    """
    rule = db.query(DeadlineRule).filter(DeadlineRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Deadline rule not found")

    changes = body.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(rule, field, value)

    db.add(AuditLog(
        user_id=admin.id,
        action="DEADLINE_RULE_UPDATED",
        entity_type="deadline_rule",
        entity_id=rule_id,
        details=f'{changes}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    db.refresh(rule)

    # Regenerate alerts based on updated rule
    regenerate_deadline_alerts(db)

    return DeadlineRuleOut.model_validate(rule)


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[AuditLogOut])
async def get_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [AuditLogOut.model_validate(l) for l in logs]
