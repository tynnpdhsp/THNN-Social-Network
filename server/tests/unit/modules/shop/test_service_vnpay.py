"""VNPay create payment, signature verify, callback."""

from __future__ import annotations

import hashlib
import hmac
import urllib.parse
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import BadRequestException, NotFoundException
from app.modules.shop.schemas import VNPayCreatePaymentRequest

from .conftest import make_order_row


def _sign_like_create(params: dict, secret: str) -> str:
    """Match ``create_vnpay_payment`` (``urlencode`` without ``quote_via``)."""
    sorted_params = sorted(params.items())
    hash_data = urllib.parse.urlencode(sorted_params)
    return hmac.new(
        secret.encode("utf-8"),
        hash_data.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()


def _vnpay_sign_verify_style(params: dict, secret: str) -> str:
    """Match ``_verify_vnpay_signature`` (``urlencode(..., quote_via=urllib.parse.quote)``)."""
    sorted_params = sorted(params.items())
    hash_data = urllib.parse.urlencode(sorted_params, quote_via=urllib.parse.quote)
    return hmac.new(
        secret.encode("utf-8"),
        hash_data.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()


@pytest.mark.asyncio
class TestCreateVnpayPayment:
    async def test_order_not_found(self, shop_service, mock_shop_repo, shop_vnpay_settings):
        mock_shop_repo.get_order_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.create_vnpay_payment(
                VNPayCreatePaymentRequest(order_id="x", ip_addr="1.1.1.1"),
                "u1",
            )

        assert exc.value.error_code == "ORDER_NOT_FOUND"

    async def test_amount_scaled_and_signature_verifiable(
        self, shop_service, mock_shop_repo, shop_vnpay_settings
    ):
        order = make_order_row(amount=12.34)
        mock_shop_repo.get_order_by_id = AsyncMock(return_value=order)

        out = await shop_service.create_vnpay_payment(
            VNPayCreatePaymentRequest(order_id="ord-1", ip_addr="192.168.0.1", order_type="other"),
            "u1",
        )

        assert out.txn_ref == "TXNREF123456"
        parsed = urllib.parse.urlparse(out.payment_url)
        flat = dict(urllib.parse.parse_qsl(parsed.query))
        received = flat.pop("vnp_SecureHash")
        vnp_only = {k: v for k, v in flat.items() if k.startswith("vnp_")}
        expected = _sign_like_create(vnp_only, shop_vnpay_settings.VNPAY_HASH_SECRET)
        assert expected.lower() == received.lower()
        assert int(vnp_only["vnp_Amount"]) == int(12.34 * 100)
        assert vnp_only["vnp_TmnCode"] == "TEST_TMN"


@pytest.mark.asyncio
class TestHandleVnpayCallback:
    async def test_missing_signature(self, shop_service):
        with pytest.raises(BadRequestException) as exc:
            await shop_service.handle_vnpay_callback({"vnp_TxnRef": "x"})

        assert exc.value.error_code == "VNPAY_MISSING_SIGNATURE"

    async def test_invalid_signature(self, shop_service, shop_vnpay_settings):
        params = {
            "vnp_TxnRef": "REF1",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_Amount": "100",
            "vnp_SecureHash": "deadbeef",
        }

        with pytest.raises(BadRequestException) as exc:
            await shop_service.handle_vnpay_callback(params)

        assert exc.value.error_code == "VNPAY_INVALID_SIGNATURE"

    async def test_order_not_found_after_verify(self, shop_service, mock_shop_repo, shop_vnpay_settings):
        base = {"vnp_TxnRef": "MISSING", "vnp_ResponseCode": "00", "vnp_TransactionStatus": "00"}
        sig = _vnpay_sign_verify_style(base, shop_vnpay_settings.VNPAY_HASH_SECRET)
        mock_shop_repo.get_order_by_vnpay_ref = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException) as exc:
            await shop_service.handle_vnpay_callback({**base, "vnp_SecureHash": sig})

        assert exc.value.error_code == "ORDER_NOT_FOUND"

    async def test_success_updates_paid(self, shop_service, mock_shop_repo, shop_vnpay_settings):
        order = make_order_row(vnpayTxnRef="GOODREF")
        base = {
            "vnp_TxnRef": "GOODREF",
            "vnp_ResponseCode": "00",
            "vnp_TransactionStatus": "00",
            "vnp_Amount": "1000",
        }
        sig = _vnpay_sign_verify_style(base, shop_vnpay_settings.VNPAY_HASH_SECRET)
        mock_shop_repo.get_order_by_vnpay_ref = AsyncMock(return_value=order)
        updated = make_order_row(status="paid", vnpayResponseCode="00")
        mock_shop_repo.update_order = AsyncMock(return_value=updated)

        out = await shop_service.handle_vnpay_callback({**base, "vnp_SecureHash": sig})

        assert out["success"] is True
        assert out["status"] == "paid"
        mock_shop_repo.update_order.assert_awaited()
        call_kw = mock_shop_repo.update_order.await_args[0][1]
        assert call_kw["status"] == "paid"

    async def test_failure_codes_mark_failed(self, shop_service, mock_shop_repo, shop_vnpay_settings):
        order = make_order_row(vnpayTxnRef="BADPAY")
        base = {
            "vnp_TxnRef": "BADPAY",
            "vnp_ResponseCode": "51",
            "vnp_TransactionStatus": "02",
        }
        sig = _vnpay_sign_verify_style(base, shop_vnpay_settings.VNPAY_HASH_SECRET)
        mock_shop_repo.get_order_by_vnpay_ref = AsyncMock(return_value=order)
        updated = make_order_row(status="failed", vnpayResponseCode="51")
        mock_shop_repo.update_order = AsyncMock(return_value=updated)

        out = await shop_service.handle_vnpay_callback({**base, "vnp_SecureHash": sig})

        assert out["success"] is False
        call_kw = mock_shop_repo.update_order.await_args[0][1]
        assert call_kw["status"] == "failed"


@pytest.mark.asyncio
class TestVerifyVnpaySignature:
    async def test_case_insensitive_hex_compare(self, shop_service, shop_vnpay_settings):
        data = {"vnp_A": "1", "vnp_B": "2"}
        sig = _vnpay_sign_verify_style(data, shop_vnpay_settings.VNPAY_HASH_SECRET)
        assert shop_service._verify_vnpay_signature(data, sig.upper()) is True
        assert shop_service._verify_vnpay_signature(data, "0" * 128) is False
