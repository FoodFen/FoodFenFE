# MoMo Payment Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pick PayOS or MoMo on the Premium payment screen; MoMo hands off to the MoMo app and FoodFen detects the payment on return.

**Architecture:** The backend's single `PaymentProviderProtocol` becomes a `dict[PaymentProvider, PaymentProviderProtocol]` of the configured providers; each payment row remembers its provider, and status/cancel/webhook route by it. A new `MomoPaymentProvider` speaks MoMo's v2 `captureWallet` API over httpx. The client adds a method picker, opens MoMo's `deeplink` (web `checkoutUrl` fallback), and keeps its existing polling.

**Tech Stack:** Backend: Python 3.11+, FastAPI, async SQLAlchemy 2, Alembic, Pydantic v2, httpx, pytest, `uv`. Client: Expo SDK 57, expo-router, TanStack Query, Zod v4, NativeWind.

**Spec:** `docs/superpowers/specs/2026-10-05-momo-payment-design.md`

## Global Constraints

- Implementers are Sonnet subagents. Opus only plans and reviews (both repos' `CLAUDE.md`).
- Two repos: **Part A** in `E:\Dev\FoodFen\FoodFenBE`, **Part B** in `E:\Dev\FoodFen\FoodFenFE`. Both on branch `feat/momo-payment`. Part A ships first.
- Provider wire values: exactly `"payos"` and `"momo"`. Missing `provider` in a checkout request means `"payos"`.
- MoMo order id = `"FF" + str(order_code)`. MoMo `requestType` = `"captureWallet"`, `lang` = `"vi"`.
- Return deep link: `foodfen://premium/return` (app scheme `foodfen`, `app.config.ts:96`).
- MoMo IPN route `POST /payments/webhook/momo` answers `204`. `POST /payments/webhook` stays PayOS's, unchanged (`200 {"code":"00"}`).
- A provider that isn't enabled → `422`.
- Backend: follow `FoodFenBE/CLAUDE.md` (no fastapi/sqlalchemy/pydantic in `src/application/`, ports are `Protocol`, DI only in `src/infrastructure/di/`, bare CHECK names in migrations). Done = `uv run pytest` + `uv run lint-imports` green.
- Client: no new dependencies, no new tests, `src/lib/i18n/vi.ts` is the type source (add every key there and in `en.ts`). Done = `npm run verify` green.
- No comments in test files (either repo).

## Review Focus

1. **MoMo query on an order the user hasn't opened yet** returns `resultCode 1000`. That must stay `pending`, never flip the row to `failed`. Pinned by Task 3's `test_query_maps_result_codes`.
2. **Checkout with `provider: "zalopay"` (unknown) or a known-but-disabled `"momo"`** → `422`, and no payment row is created. Pinned by Task 2's API tests.
3. **A forged, tampered or malformed MoMo IPN** → `401`, the payment is not touched. Pinned by Task 3's `verify_webhook` tests and Task 2's `test_momo_webhook_with_invalid_signature_is_rejected`.
4. **A status poll or cancel for a MoMo payment must hit MoMo, not PayOS.** Pinned by Task 2's `test_status_of_a_momo_payment_reconciles_with_momo` and `test_cancelling_a_momo_payment_goes_to_momo`.
5. **A paywall cached on-device by an older build has no `providers`, and a newer backend may list a provider this build doesn't know.** The screen must fall back to `['payos']` and drop unknown values, not crash. The client has no test suite by owner preference, so this is guarded in Task 5 (schema) + Task 6 (`?? ['payos']`) and checked in Task 7's manual run.

---

# Part A — FoodFenBE (`E:\Dev\FoodFen\FoodFenBE`)

Before Task 1: `git checkout -b feat/momo-payment` in FoodFenBE.

### Task 1: `provider` on the payment (domain, port, ORM, migration)

**Files:**
- Modify: `src/domain/enums.py` (after `PaymentStatus`)
- Modify: `src/domain/entities/payment.py`
- Modify: `src/domain/exceptions.py`
- Modify: `src/adapters/exception_handlers.py` (`EXCEPTION_STATUS`)
- Modify: `src/application/ports/payment_provider.py` (`CheckoutLinkResult`)
- Modify: `src/infrastructure/db/models/payment_model.py`
- Create: `alembic/versions/0020_payments_provider.py`
- Test: `tests/unit/test_payment_entity.py`

**Interfaces:**
- Produces: `PaymentProvider` (`StrEnum`: `PAYOS="payos"`, `MOMO="momo"`); `Payment.provider: PaymentProvider` (default `PAYOS`); `Payment.create(user_id, plan_type, amount, provider=PaymentProvider.PAYOS)`; `Payment.attach_checkout(payment_link_id: str, checkout_url: str, qr_code: str | None)`; `CheckoutLinkResult(payment_link_id: str, checkout_url: str, qr_code: str | None, deeplink: str | None = None)`; `PaymentProviderUnavailableException` → HTTP 422.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/test_payment_entity.py`; add imports `from src.domain.enums import PaymentProvider` if missing)

```python
def test_create_defaults_to_payos():
    payment = Payment.create(1, PlanType.MONTHLY, 49000)
    assert payment.provider is PaymentProvider.PAYOS


def test_create_records_the_chosen_provider():
    payment = Payment.create(1, PlanType.MONTHLY, 49000, PaymentProvider.MOMO)
    assert payment.provider is PaymentProvider.MOMO


def test_attach_checkout_accepts_no_qr_code():
    payment = Payment.create(1, PlanType.MONTHLY, 49000, PaymentProvider.MOMO)
    payment.attach_checkout("FF1", "https://pay.momo/x", None)
    assert payment.qr_code is None
    assert payment.checkout_url == "https://pay.momo/x"
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest tests/unit/test_payment_entity.py -v`
Expected: FAIL — `ImportError: cannot import name 'PaymentProvider'`.

- [ ] **Step 3: Implement**

`src/domain/enums.py`, after `class PaymentStatus`:

```python
class PaymentProvider(StrEnum):
    PAYOS = "payos"
    MOMO = "momo"
```

`src/domain/entities/payment.py` — import `PaymentProvider` alongside `PaymentStatus, PlanType`; change the module and class docstrings from "PayOS checkout" to "checkout"; add the field right after `status`:

```python
    status: PaymentStatus
    provider: PaymentProvider = PaymentProvider.PAYOS
    order_code: int | None = None
```

`create` gains the parameter and passes it through:

```python
    @classmethod
    def create(
        cls,
        user_id: int,
        plan_type: PlanType,
        amount: Decimal | int | str,
        provider: PaymentProvider = PaymentProvider.PAYOS,
    ) -> Payment:
        return cls(
            id=uuid4(),
            user_id=user_id,
            plan_type=plan_type,
            amount=Decimal(str(amount)),
            status=PaymentStatus.PENDING,
            provider=provider,
        )
```

`attach_checkout` signature only: `qr_code: str | None`.

`src/domain/exceptions.py`, next to `PaymentNotFoundException` (subclass the base `DomainException` directly):

```python
class PaymentProviderUnavailableException(DomainException):
    """The requested payment provider isn't configured on this server."""
```

`src/adapters/exception_handlers.py` — import it and add to `EXCEPTION_STATUS` above the `(DomainException, 400)` catch-all:

```python
    (PaymentProviderUnavailableException, 422),
```

`src/application/ports/payment_provider.py` — module docstring "Port for a payment provider (PayOS, MoMo)."; `CheckoutLinkResult` becomes:

```python
@dataclass(frozen=True)
class CheckoutLinkResult:
    payment_link_id: str
    checkout_url: str
    qr_code: str | None
    deeplink: str | None = None
```

`src/infrastructure/db/models/payment_model.py` — import `PaymentProvider`; add after `status`:

```python
    provider: Mapped[PaymentProvider] = mapped_column(
        enum_column(PaymentProvider, "payment_provider"),
        nullable=False,
        server_default=PaymentProvider.PAYOS.value,
    )
```

and pass `provider=self.provider` in `to_domain`, `provider=payment.provider` in `from_domain`.

`alembic/versions/0020_payments_provider.py`:

```python
"""payments.provider: which gateway a checkout went through

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-05
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("provider", sa.String(length=5), server_default="payos", nullable=False),
    )
    op.create_check_constraint("payment_provider", "payments", "provider IN ('payos', 'momo')")


def downgrade() -> None:
    op.drop_constraint("payment_provider", "payments", type_="check")
    op.drop_column("payments", "provider")
```

- [ ] **Step 4: Run tests, then check the migration matches the model**

Run: `uv run pytest tests/unit/test_payment_entity.py -v` → PASS.
Run: `uv run alembic upgrade 0019:0020 --sql` and compare the `provider` column type, default and CHECK name (`ck_payments_payment_provider`) against what `Base.metadata` renders for `PaymentORM` (`FoodFenBE/CLAUDE.md` → "Schema rules"). They must match; fix the migration if not.
Run: `uv run pytest` → all PASS (existing payment tests still pass: every new field has a default).

- [ ] **Step 5: Commit**

```bash
git add src/domain src/adapters/exception_handlers.py src/application/ports/payment_provider.py src/infrastructure/db/models/payment_model.py alembic/versions/0020_payments_provider.py tests/unit/test_payment_entity.py
git commit -m "feat(payments): record which provider a payment went through"
```

---

### Task 2: Route payments by provider (use cases, DTOs, wire schemas, controller, DI)

**Files:**
- Modify: `src/application/dtos/payment.py`
- Modify: `src/application/use_cases/create_checkout.py`, `get_payment_status.py`, `cancel_payment.py`, `handle_payment_webhook.py`, `list_plans.py`
- Modify: `src/adapters/schemas/payment_schemas.py`
- Modify: `src/adapters/controllers/payment_controller.py`
- Modify: `src/infrastructure/di/security.py`, `src/infrastructure/di/use_cases.py`, `src/infrastructure/di/__init__.py`
- Modify: `tests/api/conftest.py`
- Modify: every unit test that builds a payment use case with `provider=` (find them: `grep -rn "provider=" tests/unit`)
- Test: `tests/api/test_payment_endpoints.py`, `tests/api/test_plans_endpoint.py`

**Interfaces:**
- Consumes: Task 1's `PaymentProvider`, `Payment.create(..., provider)`, `CheckoutLinkResult.deeplink`, `PaymentProviderUnavailableException`.
- Produces: `get_payment_providers() -> dict[PaymentProvider, PaymentProviderProtocol]` and `PaymentProvidersDep` (replace `get_payment_provider` / `PaymentProviderDep` everywhere); `HandlePaymentWebhookUseCase.execute(provider: PaymentProvider, raw_body: bytes)`; `ListPlansUseCase.execute() -> PlansOutputDTO`. Task 3 adds MoMo inside `_payment_providers()`.

- [ ] **Step 1: Update the test fakes** — `tests/api/conftest.py`

Import `PaymentProvider` from `src.domain.enums` and `get_payment_providers` (instead of `get_payment_provider`) from `src.infrastructure.di`. Replace `FakePaymentProvider.__init__` / `create_checkout_link` and the `payment_provider` fixture with:

```python
class FakePaymentProvider:
    """Scripted payment provider — no real network call."""

    def __init__(self, momo: bool = False) -> None:
        self.momo = momo
        self.status_by_order_code: dict[int, ProviderPaymentStatus] = {}
        self.cancelled: list[int] = []
        self.next_webhook: WebhookPayload | None = None
        self.webhook_should_fail_signature = False

    async def create_checkout_link(self, order_code, amount, description, cancel_url, return_url):
        return CheckoutLinkResult(
            payment_link_id=f"link-{order_code}",
            checkout_url=f"https://pay.example/{order_code}",
            qr_code=None if self.momo else f"qr-{order_code}",
            deeplink=f"momo://pay/{order_code}" if self.momo else None,
        )
```

(keep `get_payment_status`, `cancel`, `verify_webhook` as they are)

```python
@pytest_asyncio.fixture
def payment_providers():
    fakes = {
        PaymentProvider.PAYOS: FakePaymentProvider(),
        PaymentProvider.MOMO: FakePaymentProvider(momo=True),
    }
    app.dependency_overrides[get_payment_providers] = lambda: fakes
    yield fakes
    app.dependency_overrides.pop(get_payment_providers, None)


@pytest_asyncio.fixture
def payment_provider(payment_providers):
    return payment_providers[PaymentProvider.PAYOS]
```

The `client` fixture keeps `payment_provider` in its parameter list (it now pulls in `payment_providers`).

- [ ] **Step 2: Write the failing API tests**

Append to `tests/api/test_payment_endpoints.py` (add imports `from src.application.ports.payment_provider import ProviderPaymentStatus` and `from src.domain.enums import PaymentProvider, PaymentStatus`):

```python
async def test_checkout_without_provider_defaults_to_payos(client, signed_up):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}

    body = (
        await client.post("/payments/checkout", json={"planType": "monthly"}, headers=headers)
    ).json()

    assert body["provider"] == "payos"
    assert body["qrCode"] == f"qr-{body['orderCode']}"
    assert body["deeplink"] is None


async def test_checkout_with_momo_returns_a_deeplink_and_no_qr(client, signed_up):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}

    resp = await client.post(
        "/payments/checkout", json={"planType": "monthly", "provider": "momo"}, headers=headers
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "momo"
    assert body["deeplink"] == f"momo://pay/{body['orderCode']}"
    assert body["qrCode"] is None
    assert body["checkoutUrl"].startswith("https://pay.example/")


async def test_checkout_with_an_unknown_provider_is_rejected(client, signed_up):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}

    resp = await client.post(
        "/payments/checkout", json={"planType": "monthly", "provider": "zalopay"}, headers=headers
    )

    assert resp.status_code == 422


async def test_checkout_with_a_disabled_provider_is_rejected(client, signed_up, payment_providers):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}
    del payment_providers[PaymentProvider.MOMO]

    resp = await client.post(
        "/payments/checkout", json={"planType": "monthly", "provider": "momo"}, headers=headers
    )

    assert resp.status_code == 422


async def test_momo_webhook_marks_a_momo_payment_paid(client, signed_up, payment_providers):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}
    checkout = (
        await client.post(
            "/payments/checkout", json={"planType": "monthly", "provider": "momo"}, headers=headers
        )
    ).json()

    payment_providers[PaymentProvider.MOMO].next_webhook = WebhookPayload(
        order_code=checkout["orderCode"], succeeded=True
    )
    resp = await client.post("/payments/webhook/momo", content=b"raw-ipn-body")

    assert resp.status_code == 204
    status_resp = await client.get(f"/payments/{checkout['orderCode']}", headers=headers)
    assert status_resp.json()["status"] == "paid"


async def test_momo_webhook_with_invalid_signature_is_rejected(client, payment_providers):
    payment_providers[PaymentProvider.MOMO].webhook_should_fail_signature = True

    resp = await client.post("/payments/webhook/momo", content=b"raw-ipn-body")

    assert resp.status_code == 401


async def test_status_of_a_momo_payment_reconciles_with_momo(client, signed_up, payment_providers):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}
    checkout = (
        await client.post(
            "/payments/checkout", json={"planType": "monthly", "provider": "momo"}, headers=headers
        )
    ).json()
    order_code = checkout["orderCode"]
    payment_providers[PaymentProvider.MOMO].status_by_order_code[order_code] = ProviderPaymentStatus(
        order_code=order_code, status=PaymentStatus.PAID, succeeded=True
    )

    resp = await client.get(f"/payments/{order_code}", headers=headers)

    assert resp.json()["status"] == "paid"


async def test_cancelling_a_momo_payment_goes_to_momo(client, signed_up, payment_providers):
    headers = {"Authorization": f"Bearer {signed_up['accessToken']}"}
    checkout = (
        await client.post(
            "/payments/checkout", json={"planType": "monthly", "provider": "momo"}, headers=headers
        )
    ).json()
    order_code = checkout["orderCode"]

    resp = await client.post(f"/payments/{order_code}/cancel", json={}, headers=headers)

    assert resp.json()["status"] == "cancelled"
    assert order_code in payment_providers[PaymentProvider.MOMO].cancelled
    assert order_code not in payment_providers[PaymentProvider.PAYOS].cancelled
```

In `tests/api/test_plans_endpoint.py`, the expected body of `test_plans_are_public_and_list_the_configured_prices` gains `"providers": ["payos", "momo"]`.

- [ ] **Step 3: Run to verify they fail**

Run: `uv run pytest tests/api/test_payment_endpoints.py tests/api/test_plans_endpoint.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_payment_providers'`.

- [ ] **Step 4: Implement**

`src/application/dtos/payment.py` — import `PaymentProvider`; replace `CreateCheckoutInputDTO` and `CheckoutOutputDTO`, add `PlansOutputDTO`:

```python
@dataclass(frozen=True)
class CreateCheckoutInputDTO:
    user_id: int
    plan_type: PlanType
    provider: PaymentProvider = PaymentProvider.PAYOS


@dataclass(frozen=True)
class CheckoutOutputDTO:
    order_code: int
    provider: PaymentProvider
    checkout_url: str
    qr_code: str | None
    deeplink: str | None
    amount: Decimal
    plan_type: PlanType
    status: PaymentStatus

    @classmethod
    def from_entity(cls, payment: Payment, deeplink: str | None) -> CheckoutOutputDTO:
        assert payment.order_code is not None
        assert payment.checkout_url is not None
        return cls(
            order_code=payment.order_code,
            provider=payment.provider,
            checkout_url=payment.checkout_url,
            qr_code=payment.qr_code,
            deeplink=deeplink,
            amount=payment.amount,
            plan_type=payment.plan_type,
            status=payment.status,
        )
```

```python
@dataclass(frozen=True)
class PlansOutputDTO:
    plans: list[PlanOutputDTO]
    providers: list[PaymentProvider]
```

`src/application/use_cases/create_checkout.py` — docstring "start a checkout for a plan purchase"; `provider: PaymentProviderProtocol` → `providers: dict[PaymentProvider, PaymentProviderProtocol]`; `execute`:

```python
    async def execute(self, input_dto: CreateCheckoutInputDTO) -> CheckoutOutputDTO:
        provider = self.providers.get(input_dto.provider)
        if provider is None:
            raise PaymentProviderUnavailableException(
                f"payment provider {input_dto.provider} is not enabled"
            )
        amount = self._price_for(input_dto.plan_type)
        payment = Payment.create(input_dto.user_id, input_dto.plan_type, amount, input_dto.provider)
        payment = await self.payments.create(payment)
        assert payment.order_code is not None  # DB identity column, assigned on insert

        link = await provider.create_checkout_link(
            order_code=payment.order_code,
            amount=amount,
            description=f"FoodFen {input_dto.plan_type.value} premium",
            cancel_url=self.cancel_url,
            return_url=self.return_url,
        )
        payment.attach_checkout(link.payment_link_id, link.checkout_url, link.qr_code)
        payment = await self.payments.update(payment)
        return CheckoutOutputDTO.from_entity(payment, link.deeplink)
```

`get_payment_status.py` — `providers: dict[PaymentProvider, PaymentProviderProtocol]`; the reconcile block:

```python
        provider = self.providers.get(payment.provider)
        if payment.status is PaymentStatus.PENDING and provider is not None:
            provider_status = await provider.get_payment_status(order_code)
            if provider_status.status is not PaymentStatus.PENDING:
                payment = await apply_payment_result(
                    payment, provider_status.succeeded, self.payments, self.subscriptions, self.users
                )
```

`cancel_payment.py` — `providers: dict[PaymentProvider, PaymentProviderProtocol]`; replace `await self.provider.cancel(order_code, reason)` with:

```python
        provider = self.providers.get(payment.provider)
        if provider is not None:
            await provider.cancel(order_code, reason)
```

`handle_payment_webhook.py` — docstring "apply an incoming provider webhook (IPN) call"; `providers: dict[PaymentProvider, PaymentProviderProtocol]`; `execute`:

```python
    async def execute(self, provider: PaymentProvider, raw_body: bytes) -> None:
        adapter = self.providers.get(provider)
        if adapter is None:
            raise PaymentProviderUnavailableException(f"payment provider {provider} is not enabled")
        webhook = adapter.verify_webhook(raw_body)  # raises InvalidWebhookSignatureException
        payment = await self.payments.get_by_order_code(webhook.order_code)
        if payment is None:
            raise PaymentNotFoundException(f"no payment for order_code {webhook.order_code}")
        await apply_payment_result(
            payment, webhook.succeeded, self.payments, self.subscriptions, self.users
        )
```

`list_plans.py`:

```python
@dataclass
class ListPlansUseCase:
    monthly_price_vnd: int
    annual_price_vnd: int
    providers: list[PaymentProvider]

    def execute(self) -> PlansOutputDTO:
        return PlansOutputDTO(
            plans=[
                PlanOutputDTO(PlanType.MONTHLY, self.monthly_price_vnd),
                PlanOutputDTO(PlanType.ANNUAL, self.annual_price_vnd),
            ],
            providers=self.providers,
        )
```

`src/adapters/schemas/payment_schemas.py` — import `PaymentProvider`, `PlansOutputDTO`:

```python
class CreateCheckoutRequest(CamelModel):
    # coin_redeem is not purchasable — it would be priced as an annual plan.
    plan_type: Literal[PlanType.MONTHLY, PlanType.ANNUAL]
    provider: PaymentProvider = PaymentProvider.PAYOS


class CheckoutResponse(CamelModel):
    order_code: int
    provider: PaymentProvider
    checkout_url: str
    qr_code: str | None
    deeplink: str | None
    amount: MoneyField
    plan_type: PlanType
    status: PaymentStatus

    @classmethod
    def from_dto(cls, dto: CheckoutOutputDTO) -> CheckoutResponse:
        return cls(
            order_code=dto.order_code,
            provider=dto.provider,
            checkout_url=dto.checkout_url,
            qr_code=dto.qr_code,
            deeplink=dto.deeplink,
            amount=dto.amount,
            plan_type=dto.plan_type,
            status=dto.status,
        )
```

```python
class PlansResponse(CamelModel):
    plans: list[PlanResponse]
    providers: list[PaymentProvider]

    @classmethod
    def from_dto(cls, dto: PlansOutputDTO) -> PlansResponse:
        return cls(plans=[PlanResponse(**vars(d)) for d in dto.plans], providers=dto.providers)
```

`src/adapters/controllers/payment_controller.py` — docstring "Payment endpoints (PayOS, MoMo)."; import `Response` from fastapi and `PaymentProvider` from `src.domain.enums`:

```python
    result = await use_case.execute(
        CreateCheckoutInputDTO(user_id=user.id, plan_type=body.plan_type, provider=body.provider)
    )
```

```python
    return PlansResponse.from_dto(use_case.execute())
```

```python
@router.post("/webhook", status_code=200)
async def payment_webhook(
    request: Request, use_case: HandlePaymentWebhookUseCaseDep
) -> dict[str, str]:
    await use_case.execute(PaymentProvider.PAYOS, await request.body())
    return {"code": "00"}


# MoMo's IPN contract expects an empty 204 acknowledgement.
@router.post("/webhook/momo", status_code=204)
async def momo_webhook(request: Request, use_case: HandlePaymentWebhookUseCaseDep) -> Response:
    await use_case.execute(PaymentProvider.MOMO, await request.body())
    return Response(status_code=204)
```

`src/infrastructure/di/security.py` — import `PaymentProvider`; replace `_payment_provider` / `get_payment_provider` / `PaymentProviderDep` with:

```python
@lru_cache
def _payment_providers() -> dict[PaymentProvider, PaymentProviderProtocol]:
    """Only providers with credentials configured — the rest are simply not offered."""
    providers: dict[PaymentProvider, PaymentProviderProtocol] = {}
    if settings.payos_client_id and settings.payos_api_key and settings.payos_checksum_key:
        from payos import AsyncPayOS

        client = AsyncPayOS(
            client_id=settings.payos_client_id,
            api_key=settings.payos_api_key,
            checksum_key=settings.payos_checksum_key,
        )
        providers[PaymentProvider.PAYOS] = PayOsPaymentProvider(
            client=client, checksum_key=settings.payos_checksum_key
        )
    return providers


def get_payment_providers() -> dict[PaymentProvider, PaymentProviderProtocol]:
    return _payment_providers()


PaymentProvidersDep = Annotated[
    dict[PaymentProvider, PaymentProviderProtocol], Depends(get_payment_providers)
]
```

`src/infrastructure/di/use_cases.py` — every `provider: PaymentProviderDep` → `providers: PaymentProvidersDep` and `provider=provider` → `providers=providers` (checkout, webhook, status, cancel). The plans provider:

```python
def get_list_plans_use_case(providers: PaymentProvidersDep) -> ListPlansUseCase:
    return ListPlansUseCase(
        monthly_price_vnd=settings.payos_monthly_price_vnd,
        annual_price_vnd=settings.payos_annual_price_vnd,
        providers=list(providers),
    )
```

`src/infrastructure/di/__init__.py` — rename `PaymentProviderDep` → `PaymentProvidersDep` and `get_payment_provider` → `get_payment_providers` in both the import list and `__all__`.

Unit tests found by `grep -rn "provider=" tests/unit`: change each `provider=fake` to `providers={PaymentProvider.PAYOS: fake}`, and each webhook `execute(raw)` call to `execute(PaymentProvider.PAYOS, raw)`. No behaviour change in those tests.

- [ ] **Step 5: Run everything**

Run: `uv run pytest` → all PASS.
Run: `uv run lint-imports` → all contracts kept.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(payments): route checkout, status, cancel and webhooks by provider"
```

---

### Task 3: `MomoPaymentProvider`

**Files:**
- Create: `src/infrastructure/payments/momo_provider.py`
- Modify: `src/infrastructure/config.py` (after the PayOS block)
- Modify: `src/infrastructure/di/security.py` (`_payment_providers`)
- Modify: `pyproject.toml` / `uv.lock` (httpx from dev to runtime — already installed, transitively required by `payos` and `google-genai`)
- Test: `tests/unit/test_momo_provider.py`

**Interfaces:**
- Consumes: Task 1's `CheckoutLinkResult(..., qr_code=None, deeplink=...)`; Task 2's `_payment_providers()`.
- Produces: `MomoPaymentProvider(http: httpx.AsyncClient, partner_code: str, access_key: str, secret_key: str, redirect_url: str, ipn_url: str)` implementing `PaymentProviderProtocol`.

- [ ] **Step 1: Move httpx to runtime dependencies**

Run: `uv add "httpx>=0.27"` then `uv remove --dev httpx`.

- [ ] **Step 2: Write the failing tests** — `tests/unit/test_momo_provider.py`

```python
from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal

import httpx
import pytest

from src.domain.enums import PaymentStatus
from src.domain.exceptions import InvalidWebhookSignatureException
from src.infrastructure.payments.momo_provider import MomoPaymentProvider

SECRET = "secret"


def _provider(handler) -> MomoPaymentProvider:
    return MomoPaymentProvider(
        http=httpx.AsyncClient(base_url="https://momo.test", transport=httpx.MockTransport(handler)),
        partner_code="PARTNER",
        access_key="ACCESS",
        secret_key=SECRET,
        redirect_url="foodfen://premium/return",
        ipn_url="https://api.test/payments/webhook/momo",
    )


def _sign(raw: str) -> str:
    return hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()


async def test_create_signs_the_documented_raw_string_and_returns_the_deeplink():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200, json={"resultCode": 0, "payUrl": "https://pay.momo/x", "deeplink": "momo://x"}
        )

    link = await _provider(handler).create_checkout_link(
        42, Decimal("49000"), "FoodFen monthly premium", "unused", "unused"
    )

    body = seen["body"]
    assert seen["path"] == "/v2/gateway/api/create"
    assert body["partnerCode"] == "PARTNER"
    assert body["orderId"] == "FF42"
    assert body["amount"] == 49000
    assert body["requestType"] == "captureWallet"
    assert body["redirectUrl"] == "foodfen://premium/return"
    assert body["ipnUrl"] == "https://api.test/payments/webhook/momo"
    assert "accessKey" not in body
    assert body["signature"] == _sign(
        "accessKey=ACCESS&amount=49000&extraData=&ipnUrl=https://api.test/payments/webhook/momo"
        "&orderId=FF42&orderInfo=FoodFen monthly premium&partnerCode=PARTNER"
        "&redirectUrl=foodfen://premium/return&requestId=FF42&requestType=captureWallet"
    )
    assert link.checkout_url == "https://pay.momo/x"
    assert link.deeplink == "momo://x"
    assert link.qr_code is None


async def test_create_raises_when_momo_rejects_the_order():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"resultCode": 22, "message": "bad amount"})

    with pytest.raises(RuntimeError):
        await _provider(handler).create_checkout_link(42, Decimal("49000"), "x", "u", "u")


@pytest.mark.parametrize(
    ("result_code", "expected"),
    [
        (0, PaymentStatus.PAID),
        (1000, PaymentStatus.PENDING),
        (7000, PaymentStatus.PENDING),
        (7002, PaymentStatus.PENDING),
        (9000, PaymentStatus.PENDING),
        (1006, PaymentStatus.FAILED),
        (1005, PaymentStatus.FAILED),
    ],
)
async def test_query_maps_result_codes(result_code, expected):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"resultCode": result_code})

    status = await _provider(handler).get_payment_status(42)

    body = seen["body"]
    assert seen["path"] == "/v2/gateway/api/query"
    assert body["orderId"] == "FF42"
    assert body["signature"] == _sign(
        f"accessKey=ACCESS&orderId=FF42&partnerCode=PARTNER&requestId={body['requestId']}"
    )
    assert status.order_code == 42
    assert status.status is expected
    assert status.succeeded is (expected is PaymentStatus.PAID)


async def test_cancel_makes_no_request():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("cancel must not call MoMo")

    await _provider(handler).cancel(42, "changed my mind")


IPN_RAW = (
    "accessKey=ACCESS&amount=49000&extraData=&message=ok&orderId=FF42"
    "&orderInfo=FoodFen monthly premium&orderType=momo_wallet&partnerCode=PARTNER&payType=qr"
    "&requestId=FF42&responseTime=1700000000000&resultCode={code}&transId=123"
)


def _ipn(code: int = 0, **overrides) -> bytes:
    data = {
        "partnerCode": "PARTNER",
        "orderId": "FF42",
        "requestId": "FF42",
        "amount": 49000,
        "orderInfo": "FoodFen monthly premium",
        "orderType": "momo_wallet",
        "transId": 123,
        "resultCode": code,
        "message": "ok",
        "payType": "qr",
        "responseTime": 1700000000000,
        "extraData": "",
        "signature": _sign(IPN_RAW.format(code=code)),
    }
    return json.dumps({**data, **overrides}).encode()


def _unused(request: httpx.Request) -> httpx.Response:
    raise AssertionError("verify_webhook must not call MoMo")


def test_verify_webhook_accepts_a_signed_successful_ipn():
    payload = _provider(_unused).verify_webhook(_ipn(0))

    assert payload.order_code == 42
    assert payload.succeeded is True


def test_verify_webhook_reports_a_signed_failed_ipn():
    payload = _provider(_unused).verify_webhook(_ipn(1006))

    assert payload.order_code == 42
    assert payload.succeeded is False


def test_verify_webhook_rejects_a_tampered_amount():
    with pytest.raises(InvalidWebhookSignatureException):
        _provider(_unused).verify_webhook(_ipn(0, amount=1000))


def test_verify_webhook_rejects_a_missing_field():
    body = json.loads(_ipn(0))
    del body["transId"]

    with pytest.raises(InvalidWebhookSignatureException):
        _provider(_unused).verify_webhook(json.dumps(body).encode())


def test_verify_webhook_rejects_malformed_json():
    with pytest.raises(InvalidWebhookSignatureException):
        _provider(_unused).verify_webhook(b"not json")
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run pytest tests/unit/test_momo_provider.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.infrastructure.payments.momo_provider'`.

- [ ] **Step 4: Implement** — `src/infrastructure/payments/momo_provider.py`

```python
"""MoMo adapter (v2 gateway, captureWallet): implements PaymentProviderProtocol over httpx.

Raw signature strings are MoMo's documented field order, which is alphabetical —
so ``_sign`` sorts the keys rather than hard-coding each order.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from src.application.ports.payment_provider import (
    CheckoutLinkResult,
    ProviderPaymentStatus,
    WebhookPayload,
)
from src.domain.enums import PaymentStatus
from src.domain.exceptions import InvalidWebhookSignatureException

_ORDER_ID_PREFIX = "FF"
# MoMo result codes meaning "not finished": 1000 awaiting the user, 7000/7002 processing,
# 9000 authorized but not yet captured. Everything else except 0 is a final failure.
_PENDING_RESULT_CODES = frozenset({1000, 7000, 7002, 9000})
_IPN_SIGNED_FIELDS = (
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
)


def _status_for(result_code: int) -> PaymentStatus:
    if result_code == 0:
        return PaymentStatus.PAID
    if result_code in _PENDING_RESULT_CODES:
        return PaymentStatus.PENDING
    return PaymentStatus.FAILED


@dataclass
class MomoPaymentProvider:
    http: httpx.AsyncClient
    partner_code: str
    access_key: str
    secret_key: str
    redirect_url: str
    ipn_url: str

    def _sign(self, fields: dict[str, Any]) -> str:
        raw = "&".join(f"{key}={fields[key]}" for key in sorted(fields))
        return hmac.new(self.secret_key.encode(), raw.encode(), hashlib.sha256).hexdigest()

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = await self.http.post(path, json=body, timeout=30)
        response.raise_for_status()
        return response.json()

    async def create_checkout_link(
        self, order_code: int, amount: Decimal, description: str, cancel_url: str, return_url: str
    ) -> CheckoutLinkResult:
        # MoMo sends the user back to self.redirect_url; PayOS's return/cancel URLs don't apply.
        order_id = f"{_ORDER_ID_PREFIX}{order_code}"
        fields: dict[str, Any] = {
            "accessKey": self.access_key,
            "amount": int(amount),
            "extraData": "",
            "ipnUrl": self.ipn_url,
            "orderId": order_id,
            "orderInfo": description,
            "partnerCode": self.partner_code,
            "redirectUrl": self.redirect_url,
            "requestId": order_id,
            "requestType": "captureWallet",
        }
        body = {k: v for k, v in fields.items() if k != "accessKey"}
        data = await self._post(
            "/v2/gateway/api/create", {**body, "lang": "vi", "signature": self._sign(fields)}
        )
        if data.get("resultCode") != 0:
            raise RuntimeError(f"MoMo create failed: {data.get('resultCode')} {data.get('message')}")
        return CheckoutLinkResult(
            payment_link_id=order_id,
            checkout_url=data["payUrl"],
            qr_code=None,
            deeplink=data.get("deeplink"),
        )

    async def get_payment_status(self, order_code: int) -> ProviderPaymentStatus:
        order_id = f"{_ORDER_ID_PREFIX}{order_code}"
        request_id = uuid.uuid4().hex
        signature = self._sign(
            {
                "accessKey": self.access_key,
                "orderId": order_id,
                "partnerCode": self.partner_code,
                "requestId": request_id,
            }
        )
        data = await self._post(
            "/v2/gateway/api/query",
            {
                "partnerCode": self.partner_code,
                "requestId": request_id,
                "orderId": order_id,
                "lang": "vi",
                "signature": signature,
            },
        )
        status = _status_for(data["resultCode"])
        return ProviderPaymentStatus(
            order_code=order_code, status=status, succeeded=status is PaymentStatus.PAID
        )

    async def cancel(self, order_code: int, reason: str | None) -> None:
        # MoMo has no cancel for an unpaid order; it expires on MoMo's side.
        return None

    def verify_webhook(self, raw_body: bytes) -> WebhookPayload:
        try:
            data = json.loads(raw_body)
            fields = {key: data[key] for key in _IPN_SIGNED_FIELDS}
            signature = str(data["signature"])
            order_code = int(str(data["orderId"]).removeprefix(_ORDER_ID_PREFIX))
        except (ValueError, KeyError, TypeError) as exc:
            raise InvalidWebhookSignatureException("malformed MoMo IPN") from exc
        expected = self._sign({**fields, "accessKey": self.access_key})
        if not hmac.compare_digest(expected, signature):
            raise InvalidWebhookSignatureException("MoMo IPN signature mismatch")
        return WebhookPayload(order_code=order_code, succeeded=data["resultCode"] == 0)
```

`src/infrastructure/config.py`, after the PayOS block:

```python
    # MoMo (v2 gateway, captureWallet). Offered only when partner code, both keys and the IPN URL are set.
    momo_partner_code: str = ""
    momo_access_key: str = ""
    momo_secret_key: str = ""
    momo_endpoint: str = "https://test-payment.momo.vn"
    # Where MoMo sends the user after paying: the app's deep link (or an HTTPS bounce to it).
    momo_redirect_url: str = "foodfen://premium/return"
    # Public URL of POST /payments/webhook/momo.
    momo_ipn_url: str = ""
```

`src/infrastructure/di/security.py` — import `httpx` and `MomoPaymentProvider`; in `_payment_providers()`, before `return providers`:

```python
    if (
        settings.momo_partner_code
        and settings.momo_access_key
        and settings.momo_secret_key
        and settings.momo_ipn_url
    ):
        providers[PaymentProvider.MOMO] = MomoPaymentProvider(
            http=httpx.AsyncClient(base_url=settings.momo_endpoint),
            partner_code=settings.momo_partner_code,
            access_key=settings.momo_access_key,
            secret_key=settings.momo_secret_key,
            redirect_url=settings.momo_redirect_url,
            ipn_url=settings.momo_ipn_url,
        )
```

If `.env.example` exists, add the six `MOMO_*` keys to it (empty values, `MOMO_ENDPOINT`/`MOMO_REDIRECT_URL` with the defaults above).

- [ ] **Step 5: Run everything**

Run: `uv run pytest tests/unit/test_momo_provider.py -v` → PASS.
Run: `uv run pytest` → all PASS. Run: `uv run lint-imports` → kept.

- [ ] **Step 6: Commit**

```bash
git add src tests pyproject.toml uv.lock .env.example
git commit -m "feat(payments): MoMo captureWallet provider"
```

---

### Task 4: MoMo sandbox smoke (manual — the owner runs this)

No code unless step 3 fails.

- [ ] **Step 1:** Get sandbox credentials (partner code, access key, secret key) from MoMo's developer portal (developers.momo.vn) and install MoMo's UAT test app on a phone.
- [ ] **Step 2:** Expose the local backend publicly (e.g. `cloudflared tunnel --url http://localhost:8000`) and set `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_IPN_URL=<tunnel>/payments/webhook/momo` in `.env`. Run `make dev`. `GET /payments/plans` must list `"momo"`.
- [ ] **Step 3:** Signed in via Swagger (`/docs`), `POST /payments/checkout {"planType":"monthly","provider":"momo"}`. Expect `200` with a `checkoutUrl` and a `deeplink`.
  - **If it fails because MoMo rejects `redirectUrl`** (`resultCode` naming the redirect URL): add this route to `payment_controller.py` (import `RedirectResponse` from `fastapi.responses`), set `MOMO_REDIRECT_URL=<public base>/payments/return/momo`, and retry:

    ```python
    # MoMo only accepts http(s) redirect URLs; bounce to the app's deep link.
    @router.get("/return/momo", include_in_schema=False)
    async def momo_return() -> RedirectResponse:
        return RedirectResponse("foodfen://premium/return")
    ```
    Declare it **above** `@router.get("/{order_code}")` so `return` isn't parsed as an order code. Commit: `fix(payments): bounce MoMo's redirect to the app deep link`.
- [ ] **Step 4:** Open the `checkoutUrl` and pay with the UAT app. Then `GET /payments/{orderCode}` → `"paid"`, and the IPN shows in the server log with `204`.
- [ ] **Step 5:** Repeat Step 3 and cancel inside MoMo. `GET /payments/{orderCode}` → `"failed"`.

---

# Part B — FoodFenFE (`E:\Dev\FoodFen\FoodFenFE`, branch `feat/momo-payment` already exists)

### Task 5: Contract doc + API layer

**Files:**
- Modify: `docs/backend-contracts/premium-entitlements.md`
- Modify: `src/api/schemas.ts` (`paymentPlansResponseSchema` ~line 306, `checkoutResponseSchema` ~line 247, types ~line 389)
- Modify: `src/api/endpoints/payments.ts`
- Modify: `src/features/premium/queries.ts` (`useCheckout`)

**Interfaces:**
- Consumes: Part A's wire contract.
- Produces: `paymentProviderSchema`, `type PaymentProvider = 'payos' | 'momo'` (exported from `@/api/schemas`); `RemoteCheckoutResponse` now has `provider: PaymentProvider`, `qrCode: string | null`, `deeplink?: string | null`; `paymentPlansResponseSchema` output has `providers: PaymentProvider[]`; `useCheckout().mutateAsync({ planType, provider })`.

- [ ] **Step 1: Update the contract doc** — in `premium-entitlements.md`:
  - In "A product decision this contract assumes", after the PayOS paragraph, add: "**MoMo is a second, optional provider** (spec `docs/superpowers/specs/2026-10-05-momo-payment-design.md`). The user picks the method; MoMo hands off to the MoMo app via `deeplink` and redirects back to `foodfen://premium/return`. Status polling, cancel and `GET /subscriptions/me` work the same for both."
  - `GET /payments/plans`: add `"providers": ["payos", "momo"]` to the example and a bullet: "`providers` — the methods enabled server-side, in display order. A provider is listed only when configured. Clients must ignore values they don't know."
  - `POST /payments/checkout`: request becomes `{ "planType": "monthly" | "annual", "provider": "payos" | "momo" }` with a note "`provider` defaults to `\"payos\"` when omitted; a provider that isn't enabled → `422`". Response example gains `"provider"` and `"deeplink": "string | null"`, `qrCode` becomes `"string | null"`. Bullets: "`checkoutUrl` — the provider's hosted page (PayOS checkout, or MoMo's `payUrl`)", "`qrCode` — PayOS only; `null` for MoMo", "`deeplink` — MoMo only: opens the MoMo app with the order prefilled".
  - `POST /payments/{orderCode}/cancel`: add "For MoMo this only marks the row `cancelled`; MoMo has no cancel API for an unpaid order (it expires on MoMo's side)."
  - Auth section: "**except** `POST /payments/webhook` (PayOS) and `POST /payments/webhook/momo` (MoMo IPN, answers `204`), which the gateways call directly, verified by their own signatures."

- [ ] **Step 2: Schemas** — `src/api/schemas.ts`

Next to `paymentStatusSchema`:

```ts
export const paymentProviderSchema = z.enum(['payos', 'momo']);
```

Replace `paymentPlansResponseSchema`:

```ts
export const paymentPlansResponseSchema = z.object({
  plans: z.array(
    z.object({
      planType: planTypeSchema,
      priceVnd: z.number().int().nonnegative(),
    }),
  ),
  // Unknown providers are dropped, not rejected: a backend that adds one must not break this build's paywall.
  providers: z
    .array(z.string())
    .default(['payos'])
    .transform((list) =>
      list.flatMap((value) => {
        const parsed = paymentProviderSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});
```

Replace `checkoutResponseSchema`:

```ts
export const checkoutResponseSchema = z.object({
  orderCode: z.number().int(),
  provider: paymentProviderSchema.default('payos'),
  checkoutUrl: z.url(),
  qrCode: z.string().nullable(),
  deeplink: z.string().nullish(),
  amount: z.number().nonnegative(),
  planType: planTypeSchema,
  status: paymentStatusSchema,
});
```

Next to `RemoteCheckoutResponse`:

```ts
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
```

- [ ] **Step 3: Endpoint + hook**

`src/api/endpoints/payments.ts` — import `PaymentProvider` from `@/api/schemas`; docstring "PayOS (VietQR) or MoMo checkout — not native Apple/Google IAP."; replace `checkout`:

```ts
  checkout: (planType: PlanType, provider: PaymentProvider): Promise<RemoteCheckoutResponse> =>
    api.post('payments/checkout', { planType, provider }, { schema: checkoutResponseSchema }),
```

`src/features/premium/queries.ts` — import `type { PaymentProvider } from '@/api/schemas'`; replace `useCheckout`:

```ts
/** Starts a checkout for one plan through the chosen provider. */
export function useCheckout() {
  return useMutation({
    mutationFn: ({ planType, provider }: { planType: PlanType; provider: PaymentProvider }) =>
      paymentsApi.checkout(planType, provider),
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exactly one error, in `app/premium/payment.tsx` (`checkout.mutateAsync(planType)`), fixed in Task 6. Anything else → fix here.

- [ ] **Step 5: Commit**

```bash
git add docs/backend-contracts/premium-entitlements.md src/api/schemas.ts src/api/endpoints/payments.ts src/features/premium/queries.ts
git commit -m "Accept a payment provider in the checkout contract"
```

---

### Task 6: Payment screen — method picker, MoMo hand-off, single navigation owner

**Files:**
- Modify: `app/premium/payment.tsx` (full replacement below)
- Modify: `app/premium/return.tsx` (the `useEffect`)
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts` (`premiumPayment`)

**Interfaces:**
- Consumes: Task 5's `PaymentProvider`, `RemoteCheckoutResponse`, `useCheckout().mutateAsync({ planType, provider })`, `usePaymentPlans().data.providers`.

- [ ] **Step 1: Strings** — in `premiumPayment`, change `terms` and add six keys.

`vi.ts`:

```ts
    terms: 'Thanh toán an toàn.',
    methodTitle: 'Phương thức thanh toán',
    methodPayos: 'Chuyển khoản ngân hàng (VietQR)',
    methodMomo: 'Ví MoMo',
    payWithMomo: 'Thanh toán bằng MoMo',
    momoWaitingTitle: 'Hoàn tất thanh toán trên MoMo',
    momoWaitingDescription: 'Thanh toán xong bạn quay lại đây, app sẽ tự xác nhận.',
    openMomoAgain: 'Mở lại MoMo',
```

`en.ts`:

```ts
    terms: 'Secure payment.',
    methodTitle: 'Payment method',
    methodPayos: 'Bank transfer (VietQR)',
    methodMomo: 'MoMo wallet',
    payWithMomo: 'Pay with MoMo',
    momoWaitingTitle: 'Finish paying in MoMo',
    momoWaitingDescription: 'Come back here when you’re done — we’ll confirm it automatically.',
    openMomoAgain: 'Open MoMo again',
```

- [ ] **Step 2: Replace `app/premium/payment.tsx`**

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { isApiError } from '@/api/errors';
import type { PaymentProvider, RemoteCheckoutResponse } from '@/api/schemas';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import {
  useCancelPayment,
  useCheckout,
  usePaymentPlans,
  usePaymentStatus,
  useRefreshSubscription,
} from '@/features/premium/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { PlanType } from '@/types/models';

type Stage = 'idle' | 'checking-out' | 'awaiting-payment' | 'error';

// Must match the backend's MOMO_REDIRECT_URL so the in-app browser closes itself on return.
const RETURN_URL = 'foodfen://premium/return';

const METHOD_LABEL = { payos: 'methodPayos', momo: 'methodMomo' } as const;
const PAY_LABEL = { payos: 'subscribeButton', momo: 'payWithMomo' } as const;

/** MoMo's app if installed, otherwise its web checkout, which redirects back to RETURN_URL. */
async function openMomo(order: RemoteCheckoutResponse) {
  const opened = order.deeplink
    ? await Linking.openURL(order.deeplink).then(
        () => true,
        () => false,
      )
    : false;

  if (!opened) await WebBrowser.openAuthSessionAsync(order.checkoutUrl, RETURN_URL);
}

/**
 * Checkout for the plan chosen on the Premium popup, through PayOS or MoMo.
 *
 * Neither is native IAP (see `docs/backend-contracts/premium-entitlements.md`).
 * PayOS renders the checkout's VietQR `qrCode` inline; MoMo hands off to the
 * MoMo app. Either way the gateway confirms payment to our backend via a
 * webhook, never to the client, so this screen polls until the status leaves
 * "pending" — and, while mounted, it alone navigates to the welcome screen.
 */
export default function PremiumPaymentScreen() {
  const { plan, label, price, period } = useLocalSearchParams<{
    plan: string;
    label: string;
    price: string;
    period: string;
  }>();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const session = useAuthStore((state) => state.session);
  const available = canUseRemote();
  // The one `canUseRemote()` reason worth its own affordance: everything else
  // about the build/connection is fine, only signing in is missing (mirrors
  // `app/chat.tsx`'s gating) — redeeming a purchase requires a FoodFend
  // account so it follows the account, not the device.
  const isNoSessionReason = env.hasBackend && onlineManager.isOnline() && !session;

  const { data: planData } = usePaymentPlans();
  // A paywall cached by an older build has no `providers`.
  const providers: PaymentProvider[] = planData?.providers ?? ['payos'];
  const [chosenProvider, setChosenProvider] = useState<PaymentProvider | null>(null);
  const provider =
    chosenProvider && providers.includes(chosenProvider)
      ? chosenProvider
      : (providers[0] ?? 'payos');

  const [stage, setStage] = useState<Stage>('idle');
  const [order, setOrder] = useState<RemoteCheckoutResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Guards against handling the same "left pending" status twice — the
  // status query can re-render after its effect already fired.
  const handledStatusRef = useRef(false);

  const checkout = useCheckout();
  const cancelPayment = useCancelPayment();
  const refreshSubscription = useRefreshSubscription();
  const paymentStatus = usePaymentStatus(order?.orderCode ?? null, {
    enabled: stage === 'awaiting-payment',
  });

  // A non-"paid" terminal status is rendered straight from the query below
  // (`pollFailed`) rather than copied into `stage` here — only the "paid"
  // case needs an effect at all, to call the external `refreshSubscription`
  // mutation exactly once per checkout.
  useEffect(() => {
    if (paymentStatus.data?.status !== 'paid' || handledStatusRef.current) return;

    handledStatusRef.current = true;

    refreshSubscription.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        router.dismissAll();
        router.replace('/premium/welcome');
      },
      onError: () => {
        setStage('error');
        setErrorMessage(t('common', 'somethingWentWrong'));
      },
    });
  }, [paymentStatus.data?.status, refreshSubscription, t]);

  const pollFailed =
    stage === 'awaiting-payment' &&
    paymentStatus.data !== undefined &&
    paymentStatus.data.status !== 'pending' &&
    paymentStatus.data.status !== 'paid';

  const onPressCheckout = async () => {
    setErrorMessage(null);
    setStage('checking-out');
    handledStatusRef.current = false;

    try {
      const planType: PlanType = plan === 'yearly' ? 'annual' : 'monthly';
      const result = await checkout.mutateAsync({ planType, provider });

      setOrder(result);
      setStage('awaiting-payment');
      if (result.provider === 'momo') void openMomo(result);
    } catch (error) {
      setStage('error');
      setErrorMessage(isApiError(error) ? error.userMessage : t('common', 'somethingWentWrong'));
    }
  };

  const onCancelCheckout = () => {
    if (order) cancelPayment.mutate({ orderCode: order.orderCode });

    setStage('idle');
    setOrder(null);
    handledStatusRef.current = false;
  };

  const onRetry = () => {
    setStage('idle');
    setOrder(null);
    setErrorMessage(null);
    handledStatusRef.current = false;
  };

  if (!available) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader
          title={t('premiumPayment', 'layoutTitle')}
          icon="arrow-back"
          onPress={() => router.back()}
          accessibilityLabel={t('common', 'back')}
        />
        {isNoSessionReason ? (
          <EmptyState
            icon="🔒"
            title={t('premiumPayment', 'unavailableTitle')}
            description={t('premiumPayment', 'unavailableDescription')}
            actionLabel={t('premiumPayment', 'signIn')}
            onAction={() => router.push('/sign-in')}
          />
        ) : (
          <ErrorState
            title={t('premiumPayment', 'unavailableTitle')}
            description={t('premiumPayment', 'unavailableDescription')}
          />
        )}
      </View>
    );
  }

  const isMomo = order?.provider === 'momo';

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        title={t('premiumPayment', 'layoutTitle')}
        icon="arrow-back"
        onPress={() => router.back()}
        accessibilityLabel={t('common', 'back')}
      />

      <View className="flex-1 gap-4 p-4">
        <Card className="gap-2">
          <Text variant="caption" tone="muted">
            {t('premiumPayment', 'orderSummary')}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text variant="label">{label}</Text>
            <Text variant="label">
              {price}
              {period}
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-2">
            <Text variant="body" tone="muted">
              {t('premiumPayment', 'totalToday')}
            </Text>
            <Text variant="heading">{price}</Text>
          </View>
        </Card>

        {stage === 'awaiting-payment' && order && !pollFailed ? (
          <Card className="items-center gap-3 py-6">
            {order.qrCode ? (
              <View className="rounded-card bg-white p-3">
                <QRCode value={order.qrCode} size={220} />
              </View>
            ) : null}
            <Text variant="heading" className="text-center">
              {t('premiumPayment', isMomo ? 'momoWaitingTitle' : 'waitingTitle')}
            </Text>
            <Text variant="body" tone="muted" className="text-center">
              {t('premiumPayment', isMomo ? 'momoWaitingDescription' : 'waitingDescription')}
            </Text>
            {isMomo ? (
              <Button
                label={t('premiumPayment', 'openMomoAgain')}
                onPress={() => void openMomo(order)}
                size="sm"
              />
            ) : null}
            <View className="flex-row gap-3 pt-2">
              <Button
                label={t('premiumPayment', 'checkStatus')}
                variant="secondary"
                size="sm"
                onPress={() => void paymentStatus.refetch()}
              />
              <Button
                label={t('common', 'cancel')}
                variant="ghost"
                size="sm"
                onPress={onCancelCheckout}
              />
            </View>
          </Card>
        ) : stage === 'error' || pollFailed ? (
          <ErrorState
            description={errorMessage ?? t('premiumPayment', 'checkoutFailed')}
            onRetry={onRetry}
          />
        ) : (
          <>
            {providers.length > 1 ? (
              <View className="gap-2">
                <Text variant="caption" tone="muted">
                  {t('premiumPayment', 'methodTitle')}
                </Text>
                {providers.map((option) => {
                  const isSelected = option === provider;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        haptics.selection();
                        setChosenProvider(option);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      className={cn(
                        'flex-row items-center justify-between rounded-card border-2 bg-surface p-4',
                        isSelected ? 'border-brand' : 'border-border',
                      )}
                    >
                      <Text variant="label">{t('premiumPayment', METHOD_LABEL[option])}</Text>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? colors.brand : colors.fgSubtle}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Button
              label={t('premiumPayment', PAY_LABEL[provider])}
              onPress={() => void onPressCheckout()}
              loading={stage === 'checking-out'}
              fullWidth
              size="lg"
            />
            <Text variant="caption" tone="subtle" className="text-center">
              {t('premiumPayment', 'terms')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: `app/premium/return.tsx`** — replace the doc comment's first paragraph and the start of the `useEffect`:

```tsx
/**
 * Deep-link landing for `foodfen://premium/return` — where PayOS and MoMo
 * send the user after checkout.
 *
 * When it lands on top of an open payment screen, that screen is already
 * polling and owns navigation, so this just steps back to it. Only on a cold
 * launch (nothing to go back to) does it re-check entitlement itself — and
 * even then it doesn't assume success: a redirect only means the checkout
 * page closed, not that the webhook has necessarily been processed yet.
 */
export default function PremiumReturnScreen() {
  const { t } = useTranslation();
  const refreshSubscription = useRefreshSubscription();

  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    refreshSubscription.mutate(undefined, {
```

(the rest of the effect, the eslint-disable line and the JSX stay as they are)

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: typecheck, lint (0 warnings) and the existing jest suite all pass.

- [ ] **Step 5: Commit**

```bash
git add app/premium/payment.tsx app/premium/return.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "Let users pay for Premium with MoMo"
```

---

### Task 7: Device check (manual — the owner runs this)

Needs Part A running with MoMo sandbox config (Task 4) and a dev build (`npm run android` / `npm run ios`) pointed at it via `.env.local`.

- [ ] **Step 1:** With MoMo's UAT app installed: Premium → plan → payment screen shows the picker (PayOS, MoMo). Pick MoMo → "Pay with MoMo" → the MoMo UAT app opens with the amount. Pay → FoodFen comes back on its own → welcome screen, shown **once**.
- [ ] **Step 2:** Start a MoMo payment, switch back to FoodFen by hand without paying → still "Finish paying in MoMo"; "Open MoMo again" reopens it.
- [ ] **Step 3:** Cancel inside MoMo → back in FoodFen the error state shows with retry.
- [ ] **Step 4:** Uninstall the MoMo app → "Pay with MoMo" opens MoMo's web checkout in the in-app browser.
- [ ] **Step 5:** Pick PayOS → inline QR exactly as before.
- [ ] **Step 6:** Unset `MOMO_*` on the backend, reopen the paywall → no picker, PayOS only.
