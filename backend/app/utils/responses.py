from typing import Any


def ok(data: Any = None, message: str = "OK") -> dict:
    return {"success": True, "data": data, "message": message}


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code, self.message, self.status_code = code, message, status_code
