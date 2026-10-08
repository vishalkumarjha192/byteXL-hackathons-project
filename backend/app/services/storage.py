"""File storage behind one interface: local disk for development, S3-compatible storage when S3_BUCKET is set."""
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Iterator

from app.config import settings

CHUNK = 256 * 1024


class Storage(ABC):
    @abstractmethod
    def put(self, key: str, fileobj: BinaryIO, content_type: str) -> None: ...

    @abstractmethod
    def open(self, key: str) -> Iterator[bytes]: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...


class LocalStorage(Storage):
    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:  # keys are generated server-side, but never trust that blindly
            raise ValueError("Invalid storage key")
        return p

    def put(self, key, fileobj, content_type):
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "wb") as out:
            shutil.copyfileobj(fileobj, out, CHUNK)

    def open(self, key):
        with open(self._path(key), "rb") as f:
            while chunk := f.read(CHUNK):
                yield chunk

    def delete(self, key):
        self._path(key).unlink(missing_ok=True)


class S3Storage(Storage):
    def __init__(self):
        import boto3

        kwargs: dict = {"region_name": settings.S3_REGION}
        if settings.S3_ENDPOINT:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT
        if settings.S3_ACCESS_KEY:
            kwargs.update(aws_access_key_id=settings.S3_ACCESS_KEY, aws_secret_access_key=settings.S3_SECRET_KEY)
        self.client, self.bucket = boto3.client("s3", **kwargs), settings.S3_BUCKET

    def put(self, key, fileobj, content_type):
        self.client.upload_fileobj(fileobj, self.bucket, key, ExtraArgs={"ContentType": content_type})

    def open(self, key):
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].iter_chunks(CHUNK)

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)


def get_storage() -> Storage:
    return S3Storage() if settings.S3_BUCKET else LocalStorage(settings.UPLOAD_DIR)
