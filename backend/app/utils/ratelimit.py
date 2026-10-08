import time
from collections import defaultdict, deque

from app.utils.responses import AppError


ALL: list["RateLimiter"] = []


class RateLimiter:
    """Sliding-window limiter kept in process memory.

    Fine for one backend instance. With several instances, swap `hits` for a shared store such as Redis
    and keep the same `check()` interface.
    """

    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        ALL.append(self)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise AppError("RATE_LIMITED", "Too many requests. Please wait a minute and try again.", 429)
        q.append(now)
