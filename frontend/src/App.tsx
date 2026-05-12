import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "X-Tenant-ID": "demo-tenant",
    "Content-Type": "application/json",
  },
});

export default function App() {
  const [catalog, setCatalog] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowId, setWorkflowId] = useState("");
  const [inputJson, setInputJson] = useState('{"query":"test"}');
  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState<any>(null);

  // Only ONE `load`
  const load = async () => {
    try {
      const c = await api.get("/portal/catalog");
      setCatalog(c.data);
      const w = await api.get("/workflows");
      setWorkflows(w.data);
    } catch (e: any) {
      console.error("Failed to load:", e.response?.data || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createSample = async () => {
    const wf = {
      name: "sample-workflow",
      definition: {
        nodes: [
          { id: "n1", type: "transform", config: { result: { msg: "hello" } } }
        ],
        edges: [],
      },
    };
    await api.post("/workflows", wf);
    await load();
  };

  const startRun = async () => {
    const r = await api.post("/runs", {
      workflow_id: workflowId,
      input_data: JSON.parse(inputJson),
      execution_target: "hybrid",
    });
    setRunId(r.data.run_id);
  };

  const refreshRun = async () => {
    if (!runId) return;
    const r = await api.get(`/runs/${runId}`);
    setRunStatus(r.data);
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>AI Orchestrator Sandbox</h1>
      <button onClick={createSample}>Create Sample Workflow</button>
      <h2>Catalog</h2>
      <pre>{JSON.stringify(catalog, null, 2)}</pre>
      <h2>Workflows</h2>
      <pre>{JSON.stringify(workflows, null, 2)}</pre>
      <h2>Start Run</h2>
      <input
        style={{ width: "100%", marginBottom: 8 }}
        placeholder="Workflow ID"
        value={workflowId}
        onChange={(e) => setWorkflowId(e.target.value)}
      />
      <textarea
        style={{ width: "100%", height: 120 }}
        value={inputJson}
        onChange={(e) => setInputJson(e.target.value)}
      />
      <br />
      <button onClick={startRun}>Run Workflow</button>
      <h2>Run Monitor</h2>
      <button onClick={refreshRun}>Refresh Run</button>
      <pre>{JSON.stringify({ runId, runStatus }, null, 2)}</pre>
    </div>
  );
}