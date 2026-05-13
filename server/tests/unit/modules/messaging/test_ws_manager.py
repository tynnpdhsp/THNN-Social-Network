"""``ConnectionManager`` in ``ws_manager``."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.messaging import ws_manager


class TestConnectionManagerConnectDisconnect:
    @pytest.mark.asyncio
    async def test_connect_accepts_and_registers_socket(self):
        mgr = ws_manager.ConnectionManager()
        ws = MagicMock()
        ws.accept = AsyncMock()

        await mgr.connect("user-1", ws)

        ws.accept.assert_awaited_once()
        assert "user-1" in mgr.active_connections
        assert ws in mgr.active_connections["user-1"]

    @pytest.mark.asyncio
    async def test_multiple_tabs_same_user(self):
        mgr = ws_manager.ConnectionManager()
        ws1, ws2 = MagicMock(), MagicMock()
        ws1.accept = AsyncMock()
        ws2.accept = AsyncMock()

        await mgr.connect("user-1", ws1)
        await mgr.connect("user-1", ws2)

        assert len(mgr.active_connections["user-1"]) == 2

    def test_disconnect_removes_socket_and_prunes_empty_user(self):
        mgr = ws_manager.ConnectionManager()
        ws = MagicMock()
        mgr.active_connections["user-1"] = {ws}

        mgr.disconnect("user-1", ws)

        assert "user-1" not in mgr.active_connections


@pytest.mark.asyncio
class TestSendPersonalMessage:
    async def test_swallows_per_connection_error(self):
        mgr = ws_manager.ConnectionManager()
        ok = MagicMock()
        ok.send_json = AsyncMock(return_value=None)
        bad = MagicMock()
        bad.send_json = AsyncMock(side_effect=RuntimeError("closed"))
        mgr.active_connections["u"] = {ok, bad}

        await mgr.send_personal_message({"type": "ping"}, "u")

        ok.send_json.assert_awaited_once()
        bad.send_json.assert_awaited_once()


class _FakePubSub:
    """Minimal pub/sub matching ``start_pubsub`` (subscribe + async ``listen``)."""

    def __init__(self, wire_data: str, block: asyncio.Event | None = None):
        self._wire_data = wire_data
        self._block = block
        self.subscribe = AsyncMock()

    def listen(self):
        async def _gen():
            yield {"type": "message", "data": self._wire_data}
            if self._block is not None:
                await self._block.wait()

        return _gen()


@pytest.mark.asyncio
class TestStartPubsub:
    async def test_delivers_payload_to_target_users(self, mock_redis, patch_get_redis):
        mgr = ws_manager.ConnectionManager()
        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.send_json = AsyncMock()
        await mgr.connect("target-a", ws)

        payload = {"type": "new_message", "data": {"id": "1"}}
        wire = json.dumps({"target_user_ids": ["target-a"], "payload": payload})
        block = asyncio.Event()
        mock_redis.pubsub = lambda: _FakePubSub(wire, block=block)

        task = asyncio.create_task(mgr.start_pubsub())
        for _ in range(200):
            if ws.send_json.await_count:
                break
            await asyncio.sleep(0.01)

        ws.send_json.assert_awaited()
        assert ws.send_json.await_args[0][0] == payload

        task.cancel()
        block.set()
        with pytest.raises(asyncio.CancelledError):
            await task

    async def test_redis_error_triggers_sleep_retry(self, mock_redis, patch_get_redis):
        mgr = ws_manager.ConnectionManager()

        async def broken_get_redis():
            raise ConnectionError("no redis")

        real_sleep = asyncio.sleep
        sleep_delays: list[float] = []

        async def fake_sleep(delay: float):
            if delay == 5:
                sleep_delays.append(delay)
            await real_sleep(0)

        with patch.object(asyncio, "sleep", new=fake_sleep), patch(
            "app.modules.messaging.ws_manager.get_redis", new=broken_get_redis
        ):
            task = asyncio.create_task(mgr.start_pubsub())
            for _ in range(200):
                if sleep_delays:
                    break
                await asyncio.sleep(0.01)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

        assert sleep_delays and sleep_delays[0] == 5
