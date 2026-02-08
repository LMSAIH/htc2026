"""
Worker Structured Logging — sends logs to API via WebSocket with HTTP fallback.

This module provides structured logging for the GPU worker:
1. Logs are sent in real-time via WebSocket to the API
2. If WebSocket fails, logs are sent via HTTP POST (callback/log)
3. Logs are also written to stdout for container logs

Log format (structured):
{
    "level": "INFO",
    "message": "Epoch 1/3, Batch 45/120 — loss: 0.324, accuracy: 0.72",
    "timestamp": "2026-02-08T06:30:00Z",
    "epoch": 1,
    "batch": 45
}
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

import httpx
from websockets import connect, WebSocketClientProtocol

from .state import JobState

logger = logging.getLogger(__name__)

WS_LOG_ENDPOINT = "/ws/logs/{job_id}"
HTTP_LOG_ENDPOINT = "/api/training/jobs/{job_id}/callback/log"

MAX_WS_RECONNECT = 3
WS_RECONNECT_DELAY = 5


class WorkerLogger:
    """Structured logger that sends logs to API via WebSocket with HTTP fallback."""

    def __init__(
        self,
        job_id: str,
        api_url: str,
        callback_secret: str,
        state: Optional[JobState] = None,
    ):
        self.job_id = job_id
        self.api_url = api_url.rstrip("/")
        self.callback_secret = callback_secret
        self.state = state

        self._ws: Optional[WebSocketClientProtocol] = None
        self._ws_connected = False
        self._http_client = httpx.AsyncClient(timeout=30.0)
        self._http_headers = {
            "Content-Type": "application/json",
            "X-Callback-Secret": callback_secret,
        }

    async def connect(self) -> bool:
        """Establish WebSocket connection for log streaming."""
        ws_url = f"{self.api_url}{WS_LOG_ENDPOINT.format(job_id=self.job_id)}"
        try:
            self._ws = await connect(ws_url)
            self._ws_connected = True
            logger.info("Connected to log WebSocket: %s", ws_url)
            await self._send_log(
                level="INFO",
                message="Worker connected, starting training",
                epoch=self.state.epoch if self.state else None,
                batch=self.state.batch if self.state else None,
            )
            return True
        except Exception as exc:
            logger.warning("Failed to connect to log WebSocket: %s", exc)
            self._ws_connected = False
            return False

    async def disconnect(self) -> None:
        """Close WebSocket connection."""
        if self._ws:
            try:
                await self._ws.close()
            except Exception as exc:
                logger.warning("Error closing WebSocket: %s", exc)
            self._ws = None
            self._ws_connected = False

        await self._http_client.aclose()

    async def _send_ws(self, log_data: dict) -> bool:
        """Send log via WebSocket. Returns True on success."""
        if not self._ws_connected or not self._ws:
            return False

        try:
            await self._ws.send(json.dumps(log_data))
            return True
        except Exception as exc:
            logger.warning("WebSocket send failed: %s", exc)
            self._ws_connected = False
            return False

    async def _send_http(self, log_data: dict) -> bool:
        """Send log via HTTP POST (fallback). Returns True on success."""
        url = f"{self.api_url}{HTTP_LOG_ENDPOINT.format(job_id=self.job_id)}"
        try:
            resp = await self._http_client.post(
                url, json=log_data, headers=self._http_headers
            )
            if resp.status_code == 200:
                return True
            logger.warning(
                "HTTP log callback returned %d: %s", resp.status_code, resp.text
            )
            return False
        except Exception as exc:
            logger.warning("HTTP log callback failed: %s", exc)
            return False

    async def _send_log(
        self,
        level: str,
        message: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Send structured log to API (WS first, HTTP fallback)."""
        log_data = {
            "level": level.upper(),
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "epoch": epoch,
            "batch": batch,
        }

        ws_success = await self._send_ws(log_data)
        if not ws_success:
            http_success = await self._send_http(log_data)
            if not http_success:
                logger.warning("Both WS and HTTP failed, log may be lost: %s", message)

    async def debug(
        self,
        message: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log DEBUG level message."""
        logger.debug(message)
        await self._send_log("DEBUG", message, epoch, batch)

    async def info(
        self,
        message: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log INFO level message."""
        logger.info(message)
        await self._send_log("INFO", message, epoch, batch)

    async def warning(
        self,
        message: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log WARNING level message."""
        logger.warning(message)
        await self._send_log("WARNING", message, epoch, batch)

    async def error(
        self,
        message: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log ERROR level message."""
        logger.error(message)
        await self._send_log("ERROR", message, epoch, batch)

    async def training_progress(
        self,
        epoch: int,
        total_epochs: int,
        batch: int,
        total_batches: int,
        loss: float,
        accuracy: float,
        eta_seconds: int,
    ) -> None:
        """Log training progress (INFO level with structured data)."""
        progress = (batch / total_batches) * 100
        message = (
            f"Epoch {epoch}/{total_epochs}, Batch {batch}/{total_batches} "
            f"({progress:.0f}%) — loss: {loss:.4f}, accuracy: {accuracy:.4f}, "
            f"ETA: {eta_seconds}s"
        )
        logger.info(message)
        await self._send_log(
            "INFO",
            message,
            epoch=epoch,
            batch=batch,
        )

    async def retrying(
        self,
        attempt: int,
        max_attempts: int,
        error: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log retry attempt."""
        message = f"Retry {attempt}/{max_attempts}: {error}"
        logger.warning(message)
        await self._send_log("WARNING", message, epoch, batch)

    async def batch_failed(
        self,
        epoch: int,
        batch: int,
        error: str,
        final_attempt: bool,
    ) -> None:
        """Log batch failure."""
        status = "Giving up" if final_attempt else "Retrying"
        message = f"Batch {batch} failed ({status}): {error}"
        logger.error(message)
        await self._send_log("ERROR", message, epoch, batch)

    async def training_complete(
        self,
        epochs_completed: int,
        final_loss: float,
        final_accuracy: float,
    ) -> None:
        """Log training completion."""
        message = (
            f"Training complete: epochs={epochs_completed}, "
            f"loss={final_loss:.4f}, accuracy={final_accuracy:.4f}"
        )
        logger.info(message)
        await self._send_log(
            "INFO",
            message,
            epoch=epochs_completed,
            batch=None,
        )

    async def training_failed(
        self,
        error: str,
        epoch: Optional[int] = None,
        batch: Optional[int] = None,
    ) -> None:
        """Log training failure."""
        message = f"Training failed: {error}"
        logger.error(message)
        await self._send_log("ERROR", message, epoch, batch)


def create_logger(
    job_id: str,
    api_url: str,
    callback_secret: str,
    state: Optional[JobState] = None,
) -> WorkerLogger:
    """Factory function to create a WorkerLogger."""
    return WorkerLogger(job_id, api_url, callback_secret, state)
