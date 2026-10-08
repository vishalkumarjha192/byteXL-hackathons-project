"""Live chat connections. Kept in process memory, so it fits a single backend instance.
To run several instances, replace broadcast() with a Redis pub/sub publish and have each instance forward to its own sockets."""
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, project_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms[project_id].add(ws)

    def disconnect(self, project_id: str, ws: WebSocket) -> None:
        self.rooms[project_id].discard(ws)
        if not self.rooms[project_id]:
            self.rooms.pop(project_id, None)

    async def broadcast(self, project_id: str, payload: dict) -> None:
        for ws in list(self.rooms.get(project_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(project_id, ws)


manager = ConnectionManager()
