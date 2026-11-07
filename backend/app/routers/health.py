from fastapi import APIRouter
from app.config import settings
from app.schemas.all import HealthResponse

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        provider=settings.PROVIDER,
        provider_status="ok"
    )

