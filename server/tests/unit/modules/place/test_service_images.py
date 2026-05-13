"""Place images: upload, rollback, delete."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException

from .conftest import make_place_image_row, make_place_row, make_upload_file_mock


@pytest.mark.asyncio
class TestCreatePlaceImages:
    async def test_place_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.create_place_images("p1", [], "u1")
        assert exc.value.error_code == "PLACE_NOT_FOUND"

    async def test_not_owner_forbidden(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="a"))

        with pytest.raises(ForbiddenException) as exc:
            await place_service.create_place_images(
                "p1", [make_upload_file_mock()], "b"
            )
        assert exc.value.error_code == "NOT_PLACE_OWNER"

    async def test_upload_then_db_failure_deletes_files(
        self, place_service, mock_place_repo
    ):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        mock_place_repo.create_place_images = AsyncMock(side_effect=RuntimeError("db"))

        f1 = make_upload_file_mock(b"a", "a.jpg")
        f2 = make_upload_file_mock(b"b", "b.jpg")

        with patch(
            "app.modules.place.service.upload_files",
            new_callable=AsyncMock,
            return_value=["https://s/a.jpg", "https://s/b.jpg"],
        ) as up, patch(
            "app.modules.place.service.delete_file", new_callable=AsyncMock
        ) as df:
            with pytest.raises(RuntimeError):
                await place_service.create_place_images("p1", [f1, f2], "me")

        up.assert_awaited_once()
        assert df.await_count == 2
        urls = {c.args[0] for c in df.await_args_list if c.args}
        assert urls == {"https://s/a.jpg", "https://s/b.jpg"}

    async def test_success(self, place_service, mock_place_repo):
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        imgs = [
            make_place_image_row("i1", "p1", "https://s/1.jpg", 0),
            make_place_image_row("i2", "p1", "https://s/2.jpg", 1),
        ]
        mock_place_repo.create_place_images = AsyncMock(return_value=imgs)

        with patch(
            "app.modules.place.service.upload_files",
            new_callable=AsyncMock,
            return_value=["https://s/1.jpg", "https://s/2.jpg"],
        ):
            out = await place_service.create_place_images(
                "p1",
                [make_upload_file_mock(b"x", "1.jpg"), make_upload_file_mock(b"y", "2.jpg")],
                "me",
            )

        assert len(out) == 2
        assert out[0].image_url == "https://s/1.jpg"
        mock_place_repo.create_place_images.assert_awaited_once()
        payload = mock_place_repo.create_place_images.await_args[0][0]
        assert len(payload) == 2
        assert payload[0]["displayOrder"] == 0
        assert payload[1]["displayOrder"] == 1


@pytest.mark.asyncio
class TestGetPlaceImages:
    async def test_lists(self, place_service, mock_place_repo):
        mock_place_repo.get_place_images = AsyncMock(
            return_value=[make_place_image_row()]
        )

        out = await place_service.get_place_images("p1")

        assert len(out) == 1


@pytest.mark.asyncio
class TestDeletePlaceImage:
    async def test_image_not_found(self, place_service, mock_place_repo):
        mock_place_repo.get_place_image_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.delete_place_image("i1", "u1")
        assert exc.value.error_code == "IMAGE_NOT_FOUND"

    async def test_place_missing_after_image(self, place_service, mock_place_repo):
        im = make_place_image_row()
        mock_place_repo.get_place_image_by_id = AsyncMock(return_value=im)
        mock_place_repo.get_place_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await place_service.delete_place_image("i1", "u1")
        assert exc.value.error_code == "PLACE_NOT_FOUND"

    async def test_not_owner(self, place_service, mock_place_repo):
        im = make_place_image_row()
        mock_place_repo.get_place_image_by_id = AsyncMock(return_value=im)
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="a"))

        with pytest.raises(ConflictException) as exc:
            await place_service.delete_place_image("i1", "b")
        assert exc.value.error_code == "NOT_PLACE_OWNER"

    async def test_storage_error_still_deletes_db(self, place_service, mock_place_repo):
        im = make_place_image_row(url="https://s/x.jpg")
        mock_place_repo.get_place_image_by_id = AsyncMock(return_value=im)
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        deleted = make_place_image_row()
        mock_place_repo.delete_place_image = AsyncMock(return_value=deleted)

        with patch(
            "app.modules.place.service.delete_file",
            new_callable=AsyncMock,
            side_effect=OSError("storage"),
        ) as df:
            out = await place_service.delete_place_image("i1", "me")

        df.assert_awaited_once_with("https://s/x.jpg")
        mock_place_repo.delete_place_image.assert_awaited_once_with("i1")
        assert out.id == deleted.id

    async def test_happy_path(self, place_service, mock_place_repo):
        im = make_place_image_row()
        mock_place_repo.get_place_image_by_id = AsyncMock(return_value=im)
        mock_place_repo.get_place_by_id = AsyncMock(return_value=make_place_row(userId="me"))
        mock_place_repo.delete_place_image = AsyncMock(return_value=im)

        with patch("app.modules.place.service.delete_file", new_callable=AsyncMock) as df:
            await place_service.delete_place_image("i1", "me")

        df.assert_awaited_once()
