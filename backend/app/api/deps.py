from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db

def get_tenant_id(x_tenant_id: str = Header(default=None)):
    if not x_tenant_id:
        raise HTTPException(400, "Missing X-Tenant-ID header")
    return x_tenant_id

def tenant_db(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id)):
    # Use sqlalchemy.text to avoid ArgumentError
    db.execute(text("SET LOCAL app.tenant_id = :tenant"), {"tenant": tenant_id})
    return db