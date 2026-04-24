import json
from typing import Optional, List, Dict, Any
from app.core.redis import get_redis

# --- Account Cache ---

async def get_user_profile_cache(user_id: str) -> Optional[dict]:
    r = await get_redis()
    data = await r.hgetall(f"user:profile:{user_id}")
    if not data:
        return None
    if "email_verified" in data:
        data["email_verified"] = data["email_verified"].lower() == "true"
    return data

async def set_user_profile_cache(user_id: str, data: dict):
    r = await get_redis()
    key = f"user:profile:{user_id}"
    str_data = {}
    for k, v in data.items():
        if isinstance(v, bool):
            str_data[k] = "true" if v else "false"
        elif v is not None:
            str_data[k] = str(v)
    if str_data:
        for k, v in str_data.items():
            await r.hset(key, k, v)
        await r.expire(key, 3600)

async def get_user_privacy_cache(user_id: str) -> Optional[dict]:
    r = await get_redis()
    data = await r.hgetall(f"user:privacy:{user_id}")
    return data if data else None

async def set_user_privacy_cache(user_id: str, data: dict):
    r = await get_redis()
    key = f"user:privacy:{user_id}"
    str_data = {k: str(v) for k, v in data.items() if v is not None}
    if str_data:
        for k, v in str_data.items():
            await r.hset(key, k, v)
        await r.expire(key, 1800)

async def get_user_notif_settings_cache(user_id: str) -> Optional[dict]:
    r = await get_redis()
    data = await r.hgetall(f"user:notif_settings:{user_id}")
    if not data:
        return None
    return {k: v.lower() == "true" for k, v in data.items()}

async def set_user_notif_settings_cache(user_id: str, data: dict):
    r = await get_redis()
    key = f"user:notif_settings:{user_id}"
    str_data = {k: "true" if v else "false" for k, v in data.items() if v is not None}
    if str_data:
        for k, v in str_data.items():
            await r.hset(key, k, v)
        await r.expire(key, 1800)

# --- Social Cache ---

async def increment_post_like(post_id: str, amount: int = 1):
    r = await get_redis()
    key = f"social:post_counter:{post_id}"
    if await r.exists(key):
        await r.hincrby(key, "like_count", amount)

async def increment_post_comment(post_id: str, amount: int = 1):
    r = await get_redis()
    key = f"social:post_counter:{post_id}"
    if await r.exists(key):
        await r.hincrby(key, "comment_count", amount)

async def get_post_counters(post_id: str) -> Optional[dict]:
    r = await get_redis()
    data = await r.hgetall(f"social:post_counter:{post_id}")
    if not data:
        return None
    return {
        "like_count": int(data.get("like_count", 0)),
        "comment_count": int(data.get("comment_count", 0)),
    }

async def set_post_counters(post_id: str, like_count: int, comment_count: int):
    r = await get_redis()
    key = f"social:post_counter:{post_id}"
    await r.hset(key, "like_count", str(like_count))
    await r.hset(key, "comment_count", str(comment_count))
    await r.expire(key, 3600)

async def push_to_newsfeed(user_id: str, post_id: str, timestamp: int):
    r = await get_redis()
    key = f"feed:newsfeed:{user_id}"
    await r.zadd(key, {post_id: timestamp})
    await r.zremrangebyrank(key, 0, -201)
    await r.expire(key, 900)

async def get_newsfeed(user_id: str, skip: int = 0, limit: int = 20) -> List[str]:
    r = await get_redis()
    key = f"feed:newsfeed:{user_id}"
    if not await r.exists(key):
        return []
    results = await r.zrevrange(key, skip, skip + limit - 1)
    return results
