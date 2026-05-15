"""
In-memory Redis fake covering: string, hash, sorted-set, set, pub/sub.

Shared between integration conftest and unit conftest so both get the same
behaviour. Import as:

    from tests._fakes.redis import MockRedis
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional, Set


class MockRedis:
    """Async-compatible, in-memory mock that covers the Redis commands used
    throughout the application."""

    def __init__(self) -> None:
        self.data: Dict[str, Any] = {}
        # Pub/sub bookkeeping
        self._pubsub_channels: Dict[str, List[asyncio.Queue]] = {}

    # ── String ─────────────────────────────────────────────────────────────

    async def get(self, key: str) -> Optional[str]:
        val = self.data.get(key)
        return val if isinstance(val, str) else None

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self.data[key] = str(value)
        return True

    async def incr(self, key: str) -> int:
        val = int(self.data.get(key, 0)) + 1
        self.data[key] = str(val)
        return val

    # ── Hash ───────────────────────────────────────────────────────────────

    async def hset(self, key: str, field: str, value: str) -> int:
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        self.data[key][field] = str(value)
        return 1

    async def hget(self, key: str, field: str) -> Optional[str]:
        h = self.data.get(key)
        if isinstance(h, dict):
            return h.get(field)
        return None

    async def hgetall(self, key: str) -> Dict[str, str]:
        h = self.data.get(key)
        return h if isinstance(h, dict) else {}

    async def hincrby(self, key: str, field: str, amount: int = 1) -> int:
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        current = int(self.data[key].get(field, 0))
        new_val = current + amount
        self.data[key][field] = str(new_val)
        return new_val

    # ── Sorted Set ─────────────────────────────────────────────────────────

    async def zadd(self, key: str, mapping: Dict[str, float]) -> int:
        if key not in self.data or not isinstance(self.data[key], dict):
            self.data[key] = {}
        for member, score in mapping.items():
            self.data[key][member] = score
        return len(mapping)

    async def zrevrange(self, key: str, start: int, end: int) -> List[str]:
        zset = self.data.get(key)
        if not isinstance(zset, dict):
            return []
        sorted_members = sorted(zset.items(), key=lambda x: x[1], reverse=True)
        members = [m for m, _ in sorted_members]
        n = len(members)
        if n == 0:
            return []

        def _norm_rank(r: int) -> int:
            while r < 0:
                r += n
            return r

        si, ei = _norm_rank(start), _norm_rank(end)
        if si >= n or ei < 0:
            return []
        si = max(0, min(si, n - 1))
        ei = max(0, min(ei, n - 1))
        if si > ei:
            return []
        return members[si : ei + 1]

    async def zremrangebyrank(self, key: str, start: int, end: int) -> int:
        zset = self.data.get(key)
        if not isinstance(zset, dict):
            return 0
        sorted_members = sorted(zset.items(), key=lambda x: x[1])
        n = len(sorted_members)
        if n == 0:
            return 0

        # ``push_to_newsfeed`` uses ``zremrangebyrank(key, 0, -201)`` to cap at
        # 200 posts (remove lowest-score / oldest ranks). For small sets Redis
        # leaves all members; mirror that instead of wrapping negative indices.
        if start == 0 and end == -201:
            excess = n - 200
            if excess <= 0:
                return 0
            to_remove = sorted_members[:excess]
            for member, _ in to_remove:
                zset.pop(member, None)
            return len(to_remove)

        def _norm_rank(r: int) -> int:
            while r < 0:
                r += n
            return r

        si, ei = _norm_rank(start), _norm_rank(end)
        if si >= n or ei < 0:
            return 0
        si = max(0, min(si, n - 1))
        ei = max(0, min(ei, n - 1))
        if si > ei:
            return 0
        to_remove = sorted_members[si : ei + 1]
        for member, _ in to_remove:
            zset.pop(member, None)
        return len(to_remove)

    # ── Set ────────────────────────────────────────────────────────────────

    async def sadd(self, key: str, *members: str) -> int:
        if key not in self.data or not isinstance(self.data[key], set):
            self.data[key] = set()
        added = 0
        for m in members:
            if m not in self.data[key]:
                self.data[key].add(m)
                added += 1
        return added

    async def smembers(self, key: str) -> Set[str]:
        s = self.data.get(key)
        return s if isinstance(s, set) else set()

    async def srem(self, key: str, *members: str) -> int:
        s = self.data.get(key)
        if not isinstance(s, set):
            return 0
        removed = 0
        for m in members:
            if m in s:
                s.discard(m)
                removed += 1
        if not s:
            self.data.pop(key, None)
        return removed

    # ── Key operations ─────────────────────────────────────────────────────

    async def expire(self, key: str, seconds: int) -> bool:
        return True

    async def delete(self, *keys: str) -> int:
        removed = 0
        for key in keys:
            if key in self.data:
                del self.data[key]
                removed += 1
        return removed

    async def exists(self, key: str) -> bool:
        return key in self.data

    async def ttl(self, key: str) -> int:
        # In-memory fake always returns 300 (no real expiry tracking)
        return 300

    async def close(self) -> None:
        pass

    # ── Pub/Sub ────────────────────────────────────────────────────────────

    async def publish(self, channel: str, message: str) -> int:
        queues = self._pubsub_channels.get(channel, [])
        for q in queues:
            await q.put({"type": "message", "channel": channel, "data": message})
        return len(queues)

    def pubsub(self) -> "MockPubSub":
        return MockPubSub(self)


class MockPubSub:
    """Minimal pub/sub companion for MockRedis."""

    def __init__(self, redis: MockRedis) -> None:
        self._redis = redis
        self._queue: asyncio.Queue = asyncio.Queue()
        self._channels: List[str] = []

    async def subscribe(self, *channels: str) -> None:
        for ch in channels:
            self._channels.append(ch)
            self._redis._pubsub_channels.setdefault(ch, []).append(self._queue)

    async def unsubscribe(self, *channels: str) -> None:
        for ch in channels:
            if ch in self._channels:
                self._channels.remove(ch)
            queues = self._redis._pubsub_channels.get(ch, [])
            if self._queue in queues:
                queues.remove(self._queue)

    async def get_message(
        self, ignore_subscribe_messages: bool = True, timeout: float = 0.1
    ) -> Optional[Dict[str, Any]]:
        try:
            msg = await asyncio.wait_for(self._queue.get(), timeout=timeout)
            return msg
        except asyncio.TimeoutError:
            return None

    async def close(self) -> None:
        for ch in list(self._channels):
            await self.unsubscribe(ch)
