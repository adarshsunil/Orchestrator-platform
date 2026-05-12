from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.api.deps import tenant_db, get_tenant_id
from app.services.orchestrator import create_run
from app.workers.tasks import process_run_step
from app.db.models import WorkflowRun

router = APIRouter(prefix="/runs", tags=["runs"])

class RunIn(BaseModel):
    workflow_id: str
    input_data: dict = Field(default_factory=dict)
    execution_target: str = "hybrid"

@router.post("")
def start_run(payload: RunIn, db: Session = Depends(tenant_db), tenant_id: str = Depends(get_tenant_id)):
    run = create_run(db, tenant_id, payload.workflow_id, payload.input_data, payload.execution_target)
    process_run_step.delay(run.id, tenant_id, run.current_node)
    return {"run_id": run.id, "status": run.status}

@router.get("/{run_id}")
def get_run(run_id: str, db: Session = Depends(tenant_db)):
    return db.query(WorkflowRun).filter_by(id=run_id).first()