import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.services import assignment_service, triage_service

logger = logging.getLogger(__name__)


async def _sweep_loop(interval: int) -> None:
    while True:
        try:
            triaged = await asyncio.to_thread(triage_service.run_sweep)
            if triaged:
                logger.info("Triage sweep processed %s ticket(s)", triaged)
            # Also covers tickets that had no free agent earlier or whose agent list changed.
            assigned = await asyncio.to_thread(assignment_service.run_sweep)
            if assigned:
                logger.info("Assignment sweep assigned %s ticket(s)", assigned)
        except Exception:
            logger.exception("Triage sweep failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_sweep_loop(get_settings().triage_sweep_seconds))
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
