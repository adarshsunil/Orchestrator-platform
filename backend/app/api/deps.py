from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.db.models import Tenant

def get_tenant_id(x_tenant_id: str = Header(default=None)) -> str:
    if not x_tenant_id:
        raise HTTPException(400, "Missing X-Tenant-ID header")
    return x_tenant_id

def tenant_db(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
) -> Session:
    # Verify the tenant exists — fail with a clear 403 instead of a
    # confusing ForeignKeyViolation on the first INSERT.
    if not db.query(Tenant).filter_by(id=tenant_id).first():
        raise HTTPException(403, f"Unknown tenant: {tenant_id}")

    # Placeholder for future Row-Level Security policies.
    db.execute(text("SET LOCAL app.tenant_id = :tenant"), {"tenant": tenant_id})
    return db