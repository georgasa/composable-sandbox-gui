from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import assistant_routes, auth_routes, catalog_routes, environment_routes, execute_routes, llm_config_routes, prepare_routes
from app.auth import AuthGateMiddleware
from app.catalog.loader import build_catalog
from app.config import settings
from app.environment import EnvironmentConfig, EnvironmentStore
from app.llm.retriever import BM25Retriever

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("console-app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.environment = EnvironmentStore(
        EnvironmentConfig(
            label=settings.env_label,
            prefix=settings.env_prefix,
            seed=settings.env_seed,
            region=settings.env_region,
        )
    )
    logger.info("Building operation catalog from specs...")
    catalog = build_catalog()
    logger.info("Catalog built: %d operations", len(catalog.operations))
    app.state.catalog = catalog
    app.state.retriever = BM25Retriever(catalog)
    yield


app = FastAPI(title="Composable Banking Console", lifespan=lifespan)

app.add_middleware(AuthGateMiddleware)

app.include_router(auth_routes.router, prefix="/api")
app.include_router(catalog_routes.router, prefix="/api")
app.include_router(prepare_routes.router, prefix="/api")
app.include_router(execute_routes.router, prefix="/api")
app.include_router(assistant_routes.router, prefix="/api")
app.include_router(environment_routes.router, prefix="/api")
app.include_router(llm_config_routes.router, prefix="/api")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
