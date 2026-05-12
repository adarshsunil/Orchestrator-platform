# Orchestrator Platform

A local-first AI workflow orchestrator for:
- researchers to publish AI components,
- vendors to compose workflows,
- and teams to run AI solutions locally, hybrid, or in the cloud.

## Stack
- Backend: FastAPI
- Database: PostgreSQL
- Queue/Broker: Redis
- Worker: Celery
- Frontend: React + Vite

## Features
- Tenant-aware API design
- Workflow graph execution
- Sample portal UI
- Health and readiness endpoints
- Local Docker Compose setup

## Prerequisites
- Docker
- Docker Compose

## Quick Start

### 1. Clone the repo
```bash
git clone <your-github-repo-url>
cd orchestrator-platform
```

### 2. Create environment file
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

### 3. Start everything
```bash
docker compose up --build
```

### 4. Open the app
- Frontend: http://localhost:5173
- FastAPI docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Readiness: http://localhost:8000/ready

## What runs locally
- `backend`: FastAPI API server
- `worker`: Celery background worker
- `db`: PostgreSQL
- `redis`: Redis broker/cache
- `frontend`: React/Vite portal UI

## Local workflow test
1. Open the frontend.
2. Create a sample workflow.
3. Copy the workflow ID.
4. Paste it into the run form.
5. Send sample JSON input.
6. Refresh the run monitor.

## API Headers
The backend expects:
```http
X-Tenant-ID: demo-tenant
```

## Stop the stack
```bash
docker compose down
```

## Stop and remove volumes
```bash
docker compose down -v
```

## Next steps
- Add JWT authentication
- Add Alembic migrations
- Enable PostgreSQL Row-Level Security
- Add Prometheus metrics
- Add real component execution adapters