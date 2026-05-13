from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
from app.db.models import Base, Tenant

DEFAULT_TENANT_ID = "demo-tenant"
DEFAULT_TENANT_NAME = "Demo Tenant"

def init_db() -> None:
    # 1. Create tables
    Base.metadata.create_all(bind=engine)

    # 2. Seed the default tenant row that the frontend uses
    db: Session = SessionLocal()
    try:
        existing = db.query(Tenant).filter_by(id=DEFAULT_TENANT_ID).first()
        if existing is None:
            db.add(Tenant(id=DEFAULT_TENANT_ID, name=DEFAULT_TENANT_NAME))
            db.commit()
    finally:
        db.close()