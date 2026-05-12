from fastapi import APIRouter
from app.db.session import engine
import redis, os

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/ready")
def ready():
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        r = redis.Redis.from_url(os.getenv("REDIS_URL"))
        r.ping()
        return {"status": "ready"}
    except Exception as e:
        return {"status": "not_ready", "error": str(e)}