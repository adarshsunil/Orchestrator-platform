from app.workers.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models import WorkflowRun, Workflow, RunStep
from app.services.executor import execute_node

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def process_run_step(self, run_id: str, tenant_id: str, node_id: str):
    db = SessionLocal()
    try:
        run = db.query(WorkflowRun).filter_by(id=run_id, tenant_id=tenant_id).one()
        wf = db.query(Workflow).filter_by(id=run.workflow_id, tenant_id=tenant_id).one()
        node = next(n for n in wf.definition["nodes"] if n["id"] == node_id)

        step = db.query(RunStep).filter_by(run_id=run_id, node_id=node_id, tenant_id=tenant_id).one()
        step.status = "running"
        db.commit()

        result = execute_node(db, tenant_id, node, run.input_data, run.id)
        step.status = "succeeded"
        step.output_data = result
        run.status = "succeeded"
        run.output_data = result
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            run = db.query(WorkflowRun).filter_by(id=run_id, tenant_id=tenant_id).one()
            run.status = "failed"
            run.error = str(exc)
            db.commit()
            raise
    finally:
        db.close()