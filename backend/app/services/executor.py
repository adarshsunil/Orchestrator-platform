from app.db.models import Component

def execute_node(db, tenant_id, node, input_data, run_id):
    if node["type"] == "component":
        component = db.query(Component).filter_by(id=node["component_id"], tenant_id=tenant_id).first()
        if not component:
            raise ValueError("Component not found")
        return dispatch_component(component, input_data)

    if node["type"] == "llm":
        return {"text": f"LLM output for {input_data}"}

    if node["type"] == "transform":
        return {"result": node.get("config", {}).get("result", input_data)}

    if node["type"] == "router":
        return {"route": "default"}

    raise ValueError(f"Unknown node type: {node['type']}")

def dispatch_component(component, input_data):
    return {
        "component": component.name,
        "mode": component.runtime_mode,
        "input": input_data,
        "output": {"mock": True}
    }