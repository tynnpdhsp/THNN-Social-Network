"""
Smoke tests for the ``MockRedis`` fake itself.

Ensures our test infrastructure behaves correctly before relying on it
in hundreds of unit tests.
"""

from __future__ import annotations

import asyncio

import pytest

from tests._fakes.redis import MockRedis, MockPubSub


class TestMockRedisString:
    @pytest.mark.asyncio
    async def test_get_missing_key(self):
        r = MockRedis()
        assert await r.get("nope") is None

    @pytest.mark.asyncio
    async def test_set_then_get(self):
        r = MockRedis()
        await r.set("k", "v")
        assert await r.get("k") == "v"

    @pytest.mark.asyncio
    async def test_incr_new_key(self):
        r = MockRedis()
        result = await r.incr("counter")
        assert result == 1

    @pytest.mark.asyncio
    async def test_incr_existing_key(self):
        r = MockRedis()
        await r.set("counter", "5")
        result = await r.incr("counter")
        assert result == 6


class TestMockRedisHash:
    @pytest.mark.asyncio
    async def test_hset_hget(self):
        r = MockRedis()
        await r.hset("h", "field", "val")
        assert await r.hget("h", "field") == "val"

    @pytest.mark.asyncio
    async def test_hget_missing_field(self):
        r = MockRedis()
        await r.hset("h", "a", "1")
        assert await r.hget("h", "b") is None

    @pytest.mark.asyncio
    async def test_hgetall_empty(self):
        r = MockRedis()
        assert await r.hgetall("nope") == {}

    @pytest.mark.asyncio
    async def test_hgetall_populated(self):
        r = MockRedis()
        await r.hset("h", "a", "1")
        await r.hset("h", "b", "2")
        result = await r.hgetall("h")
        assert result == {"a": "1", "b": "2"}

    @pytest.mark.asyncio
    async def test_hincrby(self):
        r = MockRedis()
        await r.hset("h", "count", "10")
        result = await r.hincrby("h", "count", 5)
        assert result == 15

    @pytest.mark.asyncio
    async def test_hincrby_new_field(self):
        r = MockRedis()
        result = await r.hincrby("h", "new", 3)
        assert result == 3


class TestMockRedisSortedSet:
    @pytest.mark.asyncio
    async def test_zadd_zrevrange(self):
        r = MockRedis()
        await r.zadd("z", {"a": 1, "b": 3, "c": 2})
        result = await r.zrevrange("z", 0, -1)
        assert result == ["b", "c", "a"]

    @pytest.mark.asyncio
    async def test_zrevrange_with_bounds(self):
        r = MockRedis()
        await r.zadd("z", {"x": 10, "y": 20, "z": 30})
        result = await r.zrevrange("z", 0, 1)
        assert result == ["z", "y"]

    @pytest.mark.asyncio
    async def test_zremrangebyrank(self):
        r = MockRedis()
        await r.zadd("z", {"a": 1, "b": 2, "c": 3})
        removed = await r.zremrangebyrank("z", 0, 0)
        assert removed == 1
        remaining = await r.zrevrange("z", 0, -1)
        assert "a" not in remaining


class TestMockRedisSet:
    @pytest.mark.asyncio
    async def test_sadd_smembers(self):
        r = MockRedis()
        await r.sadd("s", "a", "b", "c")
        members = await r.smembers("s")
        assert members == {"a", "b", "c"}

    @pytest.mark.asyncio
    async def test_smembers_empty(self):
        r = MockRedis()
        assert await r.smembers("empty") == set()

    @pytest.mark.asyncio
    async def test_sadd_dedup(self):
        r = MockRedis()
        added1 = await r.sadd("s", "a", "b")
        added2 = await r.sadd("s", "b", "c")
        assert added1 == 2
        assert added2 == 1  # Only "c" is new


class TestMockRedisKeyOps:
    @pytest.mark.asyncio
    async def test_delete_existing(self):
        r = MockRedis()
        await r.set("k", "v")
        count = await r.delete("k")
        assert count == 1
        assert await r.get("k") is None

    @pytest.mark.asyncio
    async def test_delete_missing(self):
        r = MockRedis()
        count = await r.delete("nope")
        assert count == 0

    @pytest.mark.asyncio
    async def test_exists_true(self):
        r = MockRedis()
        await r.set("k", "v")
        assert await r.exists("k") is True

    @pytest.mark.asyncio
    async def test_exists_false(self):
        r = MockRedis()
        assert await r.exists("nope") is False

    @pytest.mark.asyncio
    async def test_ttl_returns_300(self):
        r = MockRedis()
        assert await r.ttl("any") == 300

    @pytest.mark.asyncio
    async def test_expire_returns_true(self):
        r = MockRedis()
        assert await r.expire("k", 60) is True

    @pytest.mark.asyncio
    async def test_close_no_error(self):
        r = MockRedis()
        await r.close()


class TestMockRedisPubSub:
    @pytest.mark.asyncio
    async def test_publish_subscribe(self):
        r = MockRedis()
        ps = r.pubsub()
        await ps.subscribe("channel1")

        await r.publish("channel1", "hello")

        msg = await ps.get_message(timeout=1.0)
        assert msg is not None
        assert msg["data"] == "hello"
        assert msg["channel"] == "channel1"

    @pytest.mark.asyncio
    async def test_no_message_timeout(self):
        r = MockRedis()
        ps = r.pubsub()
        await ps.subscribe("ch")

        msg = await ps.get_message(timeout=0.1)
        assert msg is None

    @pytest.mark.asyncio
    async def test_unsubscribe(self):
        r = MockRedis()
        ps = r.pubsub()
        await ps.subscribe("ch")
        await ps.unsubscribe("ch")

        await r.publish("ch", "gone")
        msg = await ps.get_message(timeout=0.1)
        assert msg is None

    @pytest.mark.asyncio
    async def test_close_pubsub(self):
        r = MockRedis()
        ps = r.pubsub()
        await ps.subscribe("ch")
        await ps.close()
        # After close, channel should be unsubscribed
        assert len(ps._channels) == 0
