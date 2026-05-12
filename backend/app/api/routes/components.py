from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api.deps import tenant_db, get_tenant_id
from app.db.models import Component

router = APIRouter(prefix="/components", tags=["components"])

class ComponentIn(BaseModel):
    name: str
    kind: str
    version: str = "1.0.0"
    runtime_mode: str = "hybrid"
    input_schema: dict = Field(default_factory=dict)
    output_schema: dict = Field(default_factory=dict)
    config: dict = Field(default_factory=dict)
    is_public: bool = False

@router.post("")
def create_component(payload: ComponentIn, db: Session = Depends(tenant_db), tenant_id: str = Depends(get_tenant_id)):
    obj = Component(tenant_id=tenant_id, owner_user_id="system", **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"id": obj.id}

@router.get("")
def list_components(db: Session = Depends(tenant_db)):
    return db.query(Component).all()