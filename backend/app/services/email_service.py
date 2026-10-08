"""Email sending behind a small backend interface. Email must never break a request, so failures are only logged."""
import logging
import smtplib
import threading
from abc import ABC, abstractmethod
from email.message import EmailMessage

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import settings

log = logging.getLogger("email")
OUTBOX: list[dict] = []  # filled by the "memory" backend (used in tests)


class EmailBackend(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleBackend(EmailBackend):
    def send(self, to, subject, body):
        log.info("EMAIL to=%s subject=%s\n%s", to, subject, body)


class MemoryBackend(EmailBackend):
    def send(self, to, subject, body):
        OUTBOX.append({"to": to, "subject": subject, "body": body})


class SmtpBackend(EmailBackend):
    def send(self, to, subject, body):
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = settings.EMAIL_FROM, to, subject
        msg.set_content(body)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
            if settings.SMTP_TLS:
                s.starttls()
            if settings.SMTP_USER:
                s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            s.send_message(msg)


BACKENDS = {"console": ConsoleBackend, "memory": MemoryBackend, "smtp": SmtpBackend}


def _deliver(items: list[tuple[str, str, str]]) -> None:
    try:
        backend = BACKENDS[settings.EMAIL_BACKEND]()
    except KeyError:
        log.error("Unknown EMAIL_BACKEND %s", settings.EMAIL_BACKEND)
        return
    for to, subject, body in items:
        try:
            backend.send(to, subject, body)
        except Exception:
            log.exception("Could not send email to %s", to)


def send_email(to: str, subject: str, body: str) -> None:
    _dispatch([(to, subject, body)])


def _dispatch(items: list[tuple[str, str, str]]) -> None:
    if settings.EMAIL_BACKEND == "smtp":  # real SMTP can be slow, so do not make the user wait for it
        threading.Thread(target=_deliver, args=(items,), daemon=True).start()
    else:
        _deliver(items)


def queue_after_commit(db: Session, to: str, subject: str, body: str) -> None:
    """Emails are sent only once the transaction that caused them has committed."""
    db.info.setdefault("pending_emails", []).append((to, subject, body))


@event.listens_for(Session, "after_commit")
def _send_pending(session: Session) -> None:
    items = session.info.pop("pending_emails", None)
    if items:
        _dispatch(items)


@event.listens_for(Session, "after_rollback")
def _drop_pending(session: Session) -> None:
    session.info.pop("pending_emails", None)
