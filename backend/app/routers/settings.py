"""
Settings & User Management router (Administrator only).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from fastapi import Query

from ..database import get_db
from ..models import User, Bureau, DeadlineRule, AuditLog, UserRole
from ..schemas import UserOut, UserCreate, UserUpdate, BureauOut, DeadlineRuleOut, DeadlineRuleCreate, AuditLogOut
from ..auth import get_password_hash
from ..routers.auth import get_current_user

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
    body: DeadlineRuleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    rule = DeadlineRule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
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
