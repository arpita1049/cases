"""
Auth router: login endpoint + current user dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from ..database import get_db
from ..models import User, AuditLog
from ..schemas import Token, LoginRequest, UserOut
from ..auth import verify_password, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


@router.post("/token", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 compatible login endpoint."""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Log failed attempt
        db.add(AuditLog(
            user_id=None,
            action="LOGIN_FAILED",
            entity_type="auth",
            details=f'{{"username": "{form_data.username}"}}',
            ip_address=request.client.host if request.client else "unknown",
        ))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    # Log successful login
    db.add(AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        entity_type="auth",
        details=f'{{"role": "{user.role.value}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()

    return Token(access_token=access_token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login_json(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """JSON-body login for the React frontend."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        db.add(AuditLog(
            user_id=None,
            action="LOGIN_FAILED",
            entity_type="auth",
            details=f'{{"username": "{body.username}"}}',
            ip_address=request.client.host if request.client else "unknown",
        ))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    db.add(AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        entity_type="auth",
        details=f'{{"role": "{user.role.value}"}}',
        ip_address=request.client.host if request.client else "unknown",
    ))
    db.commit()
    return Token(access_token=access_token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
