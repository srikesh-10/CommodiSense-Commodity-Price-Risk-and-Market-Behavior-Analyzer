from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.persistence.storage import init_db
from app.routers import health, market, analysis, models

init_db()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="CommodiSense commodity price risk and market behavior analyzer backend"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(market.router)
app.include_router(analysis.router)
app.include_router(models.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

