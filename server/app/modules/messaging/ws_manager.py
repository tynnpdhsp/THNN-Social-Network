import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket
from app.core.redis import get_redis
from app.core.cache import add_online_user, remove_online_user, get_online_users
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # user_id -> set of active websockets (user might have multiple tabs)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.pubsub_task = None

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        await add_online_user(user_id)
        await self.broadcast_online_users()

    async def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                await remove_online_user(user_id)
                await self.broadcast_online_users()

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be closed
                    pass

    async def broadcast_to_user(self, user_id: str, payload: dict):
        """
        Send to all connections of a specific user.
        """
        await self.send_personal_message(payload, user_id)

    async def broadcast_online_users(self):
        """
        Broadcast the list of online users to all connected users.
        """
        online_users = await get_online_users()
        payload = {
            "type": "ONLINE_USERS_LIST",
            "data": online_users
        }
        for user_id in self.active_connections:
            await self.broadcast_to_user(user_id, payload)

    async def start_pubsub(self):
        """
        Listen to Redis for cross-instance communication with retry logic.
        """
        while True:
            try:
                redis = await get_redis()
                pubsub = redis.pubsub()
                await pubsub.subscribe("chat_updates")
                
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = json.loads(message["data"])
                        target_user_ids = data.get("target_user_ids", [])
                        payload = data.get("payload")
                        
                        for uid in target_user_ids:
                            await self.broadcast_to_user(uid, payload)
            except Exception as e:
                logger.warning(f"Redis Pub/Sub error: {e}. Retrying in 5s...")
                await asyncio.sleep(5)

manager = ConnectionManager()

async def notify_user_locked(user_id: str):
    """
    Publish a lock event to Redis to notify all instances to kick the user.
    """
    redis = await get_redis()
    payload = {
        "target_user_ids": [user_id],
        "payload": {"type": "ACCOUNT_LOCKED"}
    }
    await redis.publish("chat_updates", json.dumps(payload))

async def broadcast_online_users_list(manager: ConnectionManager):
    """
    Broadcast the list of online users to all connected users.
    """
    online_users = await get_online_users()
    payload = {
        "type": "ONLINE_USERS_LIST",
        "data": online_users
    }
    for user_id in manager.active_connections:
        await manager.broadcast_to_user(user_id, payload)

async def cleanup_stale_online_users():
    """
    Cleanup job to remove users from online list who are not actually connected.
    This handles cases where server crashes or restarts without proper disconnect.
    """
    redis = await get_redis()
    online_users = await get_online_users()
    
    # Remove users who are not in active_connections
    stale_users = set(online_users) - set(manager.active_connections.keys())
    
    for user_id in stale_users:
        await remove_online_user(user_id)
    
    if stale_users:
        logger.info(f"Cleaned up {len(stale_users)} stale online users")
        await broadcast_online_users_list(manager)
