"""
Unit tests for ``app/core/cache.py``.

Uses the ``patch_get_redis`` fixture (MockRedis) so no real Redis is needed.

Covers:
- Profile cache: round-trip, bool ↔ string conversion
- Privacy cache: round-trip
- Notification settings cache: bool ↔ string conversion
- Post counters: set/get, increment only when key exists
- Newsfeed: push + trim, get empty, get ordered
- Friend cache: get/set/invalidate
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.core.cache import (
    get_user_profile_cache,
    set_user_profile_cache,
    get_user_privacy_cache,
    set_user_privacy_cache,
    get_user_notif_settings_cache,
    set_user_notif_settings_cache,
    increment_post_like,
    increment_post_comment,
    get_post_counters,
    set_post_counters,
    push_to_newsfeed,
    get_newsfeed,
    get_user_friend_ids_cache,
    set_user_friend_ids_cache,
    invalidate_user_friend_cache,
)


# ─── Profile cache ───────────────────────────────────────────────────────────

class TestProfileCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_when_empty(self, patch_get_redis):
        result = await get_user_profile_cache("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_then_get_round_trip(self, patch_get_redis):
        data = {"full_name": "Alice", "email": "alice@example.com", "email_verified": True}
        await set_user_profile_cache("u1", data)

        cached = await get_user_profile_cache("u1")
        assert cached is not None
        assert cached["full_name"] == "Alice"
        assert cached["email"] == "alice@example.com"

    @pytest.mark.asyncio
    async def test_bool_true_stored_as_string(self, patch_get_redis):
        await set_user_profile_cache("u2", {"email_verified": True})
        cached = await get_user_profile_cache("u2")
        assert cached["email_verified"] is True  # Converted back

    @pytest.mark.asyncio
    async def test_bool_false_stored_as_string(self, patch_get_redis):
        await set_user_profile_cache("u3", {"email_verified": False})
        cached = await get_user_profile_cache("u3")
        assert cached["email_verified"] is False

    @pytest.mark.asyncio
    async def test_none_values_skipped(self, patch_get_redis):
        await set_user_profile_cache("u4", {"bio": None, "full_name": "Bob"})
        cached = await get_user_profile_cache("u4")
        assert "bio" not in cached
        assert cached["full_name"] == "Bob"

    @pytest.mark.asyncio
    async def test_empty_dict_not_stored(self, patch_get_redis):
        """If all values are None, nothing is written."""
        await set_user_profile_cache("u5", {"bio": None})
        cached = await get_user_profile_cache("u5")
        assert cached is None


# ─── Privacy cache ────────────────────────────────────────────────────────────

class TestPrivacyCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_when_empty(self, patch_get_redis):
        result = await get_user_privacy_cache("missing")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_then_get(self, patch_get_redis):
        await set_user_privacy_cache("u1", {"who_can_message": "everyone"})
        cached = await get_user_privacy_cache("u1")
        assert cached is not None
        assert cached["who_can_message"] == "everyone"

    @pytest.mark.asyncio
    async def test_none_values_excluded(self, patch_get_redis):
        await set_user_privacy_cache("u2", {"x": None, "y": "val"})
        cached = await get_user_privacy_cache("u2")
        assert "x" not in cached
        assert cached["y"] == "val"


# ─── Notification settings cache ─────────────────────────────────────────────

class TestNotifSettingsCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_when_empty(self, patch_get_redis):
        result = await get_user_notif_settings_cache("nope")
        assert result is None

    @pytest.mark.asyncio
    async def test_round_trip_booleans(self, patch_get_redis):
        await set_user_notif_settings_cache("u1", {
            "likes": True,
            "comments": False,
            "messages": True,
        })
        cached = await get_user_notif_settings_cache("u1")
        assert cached["likes"] is True
        assert cached["comments"] is False
        assert cached["messages"] is True

    @pytest.mark.asyncio
    async def test_none_values_excluded(self, patch_get_redis):
        await set_user_notif_settings_cache("u2", {"likes": True, "x": None})
        cached = await get_user_notif_settings_cache("u2")
        assert "x" not in cached


# ─── Post counters ────────────────────────────────────────────────────────────

class TestPostCounters:
    @pytest.mark.asyncio
    async def test_set_then_get(self, patch_get_redis):
        await set_post_counters("p1", like_count=10, comment_count=5)
        counters = await get_post_counters("p1")
        assert counters == {"like_count": 10, "comment_count": 5}

    @pytest.mark.asyncio
    async def test_get_returns_none_when_missing(self, patch_get_redis):
        result = await get_post_counters("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_increment_like_when_key_exists(self, patch_get_redis):
        await set_post_counters("p2", like_count=3, comment_count=0)
        await increment_post_like("p2", 1)
        counters = await get_post_counters("p2")
        assert counters["like_count"] == 4

    @pytest.mark.asyncio
    async def test_increment_like_noop_when_key_missing(self, patch_get_redis):
        """Should NOT create a key if it doesn't exist."""
        await increment_post_like("missing-post", 1)
        result = await get_post_counters("missing-post")
        assert result is None

    @pytest.mark.asyncio
    async def test_increment_comment_when_key_exists(self, patch_get_redis):
        await set_post_counters("p3", like_count=0, comment_count=7)
        await increment_post_comment("p3", 1)
        counters = await get_post_counters("p3")
        assert counters["comment_count"] == 8

    @pytest.mark.asyncio
    async def test_increment_comment_noop_when_key_missing(self, patch_get_redis):
        await increment_post_comment("ghost", 1)
        result = await get_post_counters("ghost")
        assert result is None

    @pytest.mark.asyncio
    async def test_decrement_like(self, patch_get_redis):
        await set_post_counters("p4", like_count=5, comment_count=0)
        await increment_post_like("p4", -1)
        counters = await get_post_counters("p4")
        assert counters["like_count"] == 4


# ─── Newsfeed ─────────────────────────────────────────────────────────────────

class TestNewsfeed:
    @pytest.mark.asyncio
    async def test_get_returns_empty_when_no_key(self, patch_get_redis):
        result = await get_newsfeed("no-user")
        assert result == []

    @pytest.mark.asyncio
    async def test_push_and_get_ordered_desc(self, patch_get_redis):
        await push_to_newsfeed("u1", "post-old", 100)
        await push_to_newsfeed("u1", "post-new", 200)
        await push_to_newsfeed("u1", "post-mid", 150)

        feed = await get_newsfeed("u1", skip=0, limit=10)
        assert feed == ["post-new", "post-mid", "post-old"]

    @pytest.mark.asyncio
    async def test_push_trims_to_200(self, patch_get_redis):
        """After push, zremrangebyrank(0, -201) trims old entries."""
        for i in range(250):
            await push_to_newsfeed("u2", f"post-{i}", i)

        feed = await get_newsfeed("u2", skip=0, limit=300)
        # After trim, should have at most 200 items
        assert len(feed) <= 200

    @pytest.mark.asyncio
    async def test_get_with_skip_and_limit(self, patch_get_redis):
        for i in range(10):
            await push_to_newsfeed("u3", f"p{i}", i)

        feed = await get_newsfeed("u3", skip=2, limit=3)
        # Descending: p9, p8, p7, p6, p5, ...
        # skip=2 → start from p7; limit=3 → p7, p6, p5
        assert len(feed) == 3
        assert feed[0] == "p7"


# ─── Friend cache ────────────────────────────────────────────────────────────

class TestFriendCache:
    @pytest.mark.asyncio
    async def test_get_returns_none_when_not_set(self, patch_get_redis):
        result = await get_user_friend_ids_cache("unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_then_get(self, patch_get_redis):
        await set_user_friend_ids_cache("u1", ["f1", "f2", "f3"])
        result = await get_user_friend_ids_cache("u1")
        assert result is not None
        assert set(result) == {"f1", "f2", "f3"}

    @pytest.mark.asyncio
    async def test_set_empty_list(self, patch_get_redis):
        """Empty friend list means key is deleted → returns None."""
        await set_user_friend_ids_cache("u2", [])
        result = await get_user_friend_ids_cache("u2")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalidate(self, patch_get_redis):
        await set_user_friend_ids_cache("u3", ["f1"])
        await invalidate_user_friend_cache("u3")
        result = await get_user_friend_ids_cache("u3")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalidate_nonexistent_key_no_error(self, patch_get_redis):
        """Invalidating a non-existent key should not raise."""
        await invalidate_user_friend_cache("nope")  # Should not raise
