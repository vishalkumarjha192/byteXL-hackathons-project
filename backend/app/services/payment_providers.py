"""Payment provider abstraction. Business logic only talks to PaymentProvider, never to a specific gateway.

To add Stripe or Razorpay: subclass PaymentProvider, implement the five methods, register it in PROVIDERS,
then set PAYMENT_PROVIDER in .env.
"""
import uuid
from abc import ABC, abstractmethod

from app.config import settings


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_payment(self, amount: float, currency: str, reference: str) -> str:
        """Create a payment/intent and return the provider's payment id."""

    @abstractmethod
    def capture_payment(self, provider_payment_id: str) -> None:
        """Take the money from the brand and hold it."""

    @abstractmethod
    def refund_payment(self, provider_payment_id: str, amount: float) -> str:
        """Return held money to the brand. Returns a refund id."""

    @abstractmethod
    def transfer_to_creator(self, provider_payment_id: str, amount: float, currency: str) -> str:
        """Move the creator's share to their balance. Returns a transfer id."""

    @abstractmethod
    def payout(self, user_ref: str, amount: float, currency: str) -> str:
        """Pay a creator's balance out to their bank. Returns a payout id."""


class MockProvider(PaymentProvider):
    """Always succeeds and moves no real money. For development and tests."""

    name = "mock"

    @staticmethod
    def _id(kind: str) -> str:
        return f"mock_{kind}_{uuid.uuid4().hex[:12]}"

    def create_payment(self, amount, currency, reference):
        return self._id("pay")

    def capture_payment(self, provider_payment_id):
        return None

    def refund_payment(self, provider_payment_id, amount):
        return self._id("refund")

    def transfer_to_creator(self, provider_payment_id, amount, currency):
        return self._id("transfer")

    def payout(self, user_ref, amount, currency):
        return self._id("payout")


PROVIDERS: dict[str, type[PaymentProvider]] = {"mock": MockProvider}


def get_provider() -> PaymentProvider:
    try:
        return PROVIDERS[settings.PAYMENT_PROVIDER]()
    except KeyError:
        raise RuntimeError(f"Unknown PAYMENT_PROVIDER '{settings.PAYMENT_PROVIDER}'. Available: {', '.join(PROVIDERS)}")
