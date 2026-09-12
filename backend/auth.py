import os
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.security import APIKeyCookie
from jose import jwt, JWTError
from datetime import datetime, timedelta
from pydantic import BaseModel

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_change_me")
ALGORITHM = "HS256"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

cookie_scheme = APIKeyCookie(name="session_token", auto_error=False)

class LoginData(BaseModel):
    password: str

async def get_current_user(request: Request, session_token: str = Depends(cookie_scheme)):
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(session_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return "admin"
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
