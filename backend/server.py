#!/usr/bin/env python3
"""CommodiSense analysis backend entrypoint.

Runs the modular FastAPI application with Uvicorn on port 8000.
Maintains exact backward-compatibility with:
    python3 backend/server.py
"""
import sys
from pathlib import Path

# Ensure 'backend' is in Python module search path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"Starting {settings.APP_NAME} v{settings.VERSION} on http://{settings.HOST}:{settings.PORT}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True, reload_dirs=[str(backend_dir)])
