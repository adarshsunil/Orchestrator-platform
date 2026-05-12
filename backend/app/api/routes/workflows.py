from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api.deps import tenant_db, get_tenant_id
from app.db.models import Workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])

class WorkflowIn(BaseModel):
    name: str
    definition: dict = Field(default_factory=dict)

@router.post("")
def create_workflow(payload: WorkflowIn, db: Session = Depends(tenant_db), tenant_id: str = Depends(get_tenant_id)):
    obj = Workflow(tenant_id=tenant_id, owner_user_id="system", name=payload.name, definition=payload.definition)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"id": obj.id}

@router.get("")
def list_workflows(db: Session = Depends(tenant_db)):
    return db.query(Workflow).all()