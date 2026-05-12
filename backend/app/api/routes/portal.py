from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import tenant_db
from app.db.models import Component, Workflow, WorkflowRun

router = APIRouter(prefix="/portal", tags=["portal"])

@router.get("/catalog")
def catalog(db: Session = Depends(tenant_db)):
    return {
        "components": db.query(Component).filter_by(is_public=True).all(),
        "workflows": db.query(Workflow).all()
    }

@router.get("/dashboard")
def dashboard(db: Session = Depends(tenant_db)):
    return {
        "components_count": db.query(Component).count(),
        "workflows_count": db.query(Workflow).count(),
        "runs_count": db.query(WorkflowRun).count()
    }