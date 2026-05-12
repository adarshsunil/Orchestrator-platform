from app.db.models import Workflow, WorkflowRun, RunStep
from app.services.graph import topological_order

def create_run(db, tenant_id, workflow_id, input_data, execution_target):
    wf = db.query(Workflow).filter_by(id=workflow_id, tenant_id=tenant_id).first()
    if not wf:
        raise ValueError("Workflow not found")

    run = WorkflowRun(
        tenant_id=tenant_id,
        workflow_id=workflow_id,
        input_data=input_data,
        execution_target=execution_target,
        status="queued"
    )
    db.add(run)
    db.flush()

    order = topological_order(wf.definition)
    first = order[0]
    db.add(RunStep(
        tenant_id=tenant_id,
        run_id=run.id,
        node_id=first,
        status="queued",
        input_data=input_data
    ))
    run.current_node = first
    db.commit()
    db.refresh(run)
    return run