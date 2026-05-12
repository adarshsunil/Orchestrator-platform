from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer, Text, JSON
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

def gen_id():
    return str(uuid.uuid4())

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Component(Base):
    __tablename__ = "components"
    id = Column(String, primary_key=True, default=gen_id)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    owner_user_id = Column(String, nullable=False, default="system")
    name = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    version = Column(String, nullable=False, default="1.0.0")
    runtime_mode = Column(String, nullable=False, default="hybrid")
    input_schema = Column(JSON, nullable=False, default=dict)
    output_schema = Column(JSON, nullable=False, default=dict)
    config = Column(JSON, nullable=False, default=dict)
    is_public = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(String, primary_key=True, default=gen_id)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    owner_user_id = Column(String, nullable=False, default="system")
    name = Column(String, nullable=False)
    definition = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id = Column(String, primary_key=True, default=gen_id)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    status = Column(String, nullable=False, default="queued")
    current_node = Column(String, nullable=True)
    input_data = Column(JSON, nullable=False, default=dict)
    output_data = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    execution_target = Column(String, nullable=False, default="hybrid")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RunStep(Base):
    __tablename__ = "run_steps"
    id = Column(String, primary_key=True, default=gen_id)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    run_id = Column(String, ForeignKey("workflow_runs.id"), nullable=False, index=True)
    node_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    input_data = Column(JSON, nullable=False, default=dict)
    output_data = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())