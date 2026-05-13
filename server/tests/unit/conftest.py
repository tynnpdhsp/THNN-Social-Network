"""
Unit test conftest — Sprint 0 infrastructure.

Provides lightweight, isolated fixtures that do NOT touch real databases,
Redis, SMTP, or MinIO. Every test gets its own fresh mocks.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, ExitStack
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
import pytest_asyncio

from tests._fakes.redis import MockRedis


# ──────────────────────────────────────────────────────────────────────────────
# Marker: every test file under tests/unit/ automatically gets the 'unit' mark
# ──────────────────────────────────────────────────────────────────────────────


def pytest_collection_modifyitems(items):
    """Auto-add the ``unit`` marker to every test collected from tests/unit/."""
    for item in items:
        if "/tests/unit/" in str(item.fspath):
            item.add_marker(pytest.mark.unit)


# ──────────────────────────────────────────────────────────────────────────────
# MockRedis fixture (fresh per test)
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_redis() -> MockRedis:
    """A brand-new in-memory Redis for every test."""
    return MockRedis()


@pytest.fixture()
def patch_get_redis(mock_redis: MockRedis):
    """Monkey-patch ``get_redis`` everywhere it is bound after import.

    ``from app.core.redis import get_redis`` copies the reference into each
    module's namespace, so patching only ``app.core.redis.get_redis`` is not
    enough for ``app.core.cache`` / ``app.utils.email``.
    """
    async def _fake_get_redis():
        return mock_redis

    targets = (
        "app.core.redis.get_redis",
        "app.core.cache.get_redis",
        "app.utils.email.get_redis",
    )
    with ExitStack() as stack:
        for target in targets:
            stack.enter_context(patch(target, new=_fake_get_redis))
        yield mock_redis


# ──────────────────────────────────────────────────────────────────────────────
# Mock Prisma DB
# ──────────────────────────────────────────────────────────────────────────────

# Prisma model tables used in the codebase
_PRISMA_TABLES = [
    "user",
    "post",
    "like",
    "comment",
    "friendship",
    "userblock",
    "report",
    "boardtag",
    "postimage",
    "refreshtoken",
    "otpcode",
    "role",
    "privacysetting",
    "notificationsetting",
    "notification",
    "conversation",
    "conversationmember",
    "message",
    "shopcategory",
    "shopitem",
    "itemimage",
    "order",
    "cartitem",
    "review",
    "documentcategory",
    "document",
    "placecategory",
    "place",
    "placeimage",
    "placebookmark",
    "schedule",
    "scheduleentry",
    "coursesection",
    "studynote",
    "auditlog",
]


def _make_table_mock() -> AsyncMock:
    """Create an AsyncMock that behaves like a Prisma model delegate."""
    m = AsyncMock()
    # Common Prisma methods
    for method in (
        "find_unique",
        "find_first",
        "find_many",
        "create",
        "update",
        "delete",
        "upsert",
        "count",
        "update_many",
        "delete_many",
    ):
        setattr(m, method, AsyncMock())
    return m


@pytest.fixture()
def mock_db() -> MagicMock:
    """A MagicMock that mimics ``prisma.Prisma`` with every table as an
    ``AsyncMock`` sub-attribute.

    Also provides a ``tx`` async context manager that yields itself
    (transaction shares the same mock tables).
    """
    db = MagicMock()

    for table in _PRISMA_TABLES:
        setattr(db, table, _make_table_mock())

    # Transaction context manager: ``async with db.tx() as tx:``
    @asynccontextmanager
    async def _fake_tx():
        yield db  # Transaction re-uses the same mock tables

    db.tx = _fake_tx

    return db


# ──────────────────────────────────────────────────────────────────────────────
# Mock repositories — thin wrappers so services can be instantiated easily
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_account_repo(mock_db):
    """AsyncMock pretending to be ``AccountRepository``."""
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_social_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_notification_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_admin_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_shop_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_document_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_place_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


@pytest.fixture()
def mock_schedule_repo(mock_db):
    repo = AsyncMock()
    repo.db = mock_db
    return repo


# ──────────────────────────────────────────────────────────────────────────────
# Mock scheduler (APScheduler)
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_scheduler():
    """A MagicMock mimicking ``apscheduler.schedulers.asyncio.AsyncIOScheduler``."""
    scheduler = MagicMock()
    scheduler.add_job = MagicMock()
    scheduler.remove_job = MagicMock()
    scheduler.get_job = MagicMock(return_value=None)
    return scheduler


# ──────────────────────────────────────────────────────────────────────────────
# Service factories — build services with mocked dependencies
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def account_service(mock_account_repo):
    from app.modules.account.service import AccountService
    return AccountService(mock_account_repo)


@pytest.fixture()
def notification_service(mock_notification_repo):
    from app.modules.notification.service import NotificationService
    return NotificationService(mock_notification_repo)


@pytest.fixture()
def social_service(mock_social_repo, notification_service):
    from app.modules.social.service import SocialService
    return SocialService(mock_social_repo, notification_service)


@pytest.fixture()
def admin_service(mock_admin_repo):
    from app.modules.admin.service import AdminService
    return AdminService(mock_admin_repo)


@pytest.fixture()
def shop_service(mock_shop_repo):
    from app.modules.shop.service import ShopService
    return ShopService(mock_shop_repo)


@pytest.fixture()
def document_service(mock_document_repo):
    from app.modules.documents.service import DocumentService
    return DocumentService(mock_document_repo)


@pytest.fixture()
def place_service(mock_place_repo):
    from app.modules.place.service import PlaceService
    return PlaceService(mock_place_repo)


@pytest.fixture()
def schedule_service(mock_schedule_repo, notification_service, mock_scheduler):
    from app.modules.schedule.service import ScheduleService
    return ScheduleService(mock_schedule_repo, notification_service, mock_scheduler)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers: patching datetime, send_otp_email, MinIO
# ──────────────────────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_send_otp_email():
    """Patch ``send_otp_email`` in both its definition module and re-exported
    locations so no SMTP traffic occurs."""
    mock = AsyncMock()
    with patch("app.utils.email.send_otp_email", new=mock), \
         patch("app.modules.account.service.send_otp_email", new=mock):
        yield mock


@pytest.fixture()
def mock_minio_client():
    """Patch ``get_minio_client`` to return a MagicMock Minio client."""
    client = MagicMock()
    client.bucket_exists.return_value = True
    client.put_object.return_value = None
    client.remove_object.return_value = None
    with patch("app.utils.storage.get_minio_client", return_value=client):
        yield client


@pytest.fixture()
def freeze_time():
    """Context manager fixture to freeze ``datetime.now(timezone.utc)``.

    Usage::

        def test_something(freeze_time):
            frozen = datetime(2025, 1, 1, tzinfo=timezone.utc)
            with freeze_time(frozen):
                ...
    """
    from contextlib import contextmanager

    @contextmanager
    def _freeze(dt: datetime):
        """Temporarily make ``datetime.now()`` always return *dt*."""

        class _FakeDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return dt

        with patch("datetime.datetime", _FakeDatetime):
            yield dt

    return _freeze


# ──────────────────────────────────────────────────────────────────────────────
# Fake Prisma model objects — tiny namespaces useful for return values
# ──────────────────────────────────────────────────────────────────────────────


def make_fake_user(**overrides) -> MagicMock:
    """Return a MagicMock that looks like a Prisma ``User`` record."""
    defaults = dict(
        id="user-id-1",
        email="user@example.com",
        fullName="Test User",
        phoneNumber="0901234567",
        passwordHash="$2b$12$hashed",
        emailVerified=True,
        isLocked=False,
        lockReason=None,
        deletedAt=None,
        roleId="role-student",
        roleRef=None,
        avatarUrl=None,
        coverUrl=None,
        bio=None,
        createdAt=datetime(2025, 1, 1, tzinfo=timezone.utc),
        updatedAt=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    user = MagicMock()
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def make_fake_role(**overrides) -> MagicMock:
    defaults = dict(id="role-admin", role="admin")
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj
