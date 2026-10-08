from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/marketplace"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 30
    REFRESH_TOKEN_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    PLATFORM_FEE_PERCENT: float = 20.0  # configurable commission
    AI_PROVIDER: str = "auto"  # "auto" uses Anthropic when ANTHROPIC_API_KEY is set, otherwise the built-in template
    ANTHROPIC_API_KEY: str = "" # Add API key
    AI_MODEL: str = "" # add model of ai which you want to use
    MATCHING_STRATEGY: str = "rules"
    EMAIL_BACKEND: str = "console"  # console (logs only), smtp, or memory (tests)
    EMAIL_FROM: str = "Creatorly <no-reply@creatorly.local>"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    UPLOAD_DIR: str = "uploads"  # used when S3_BUCKET is empty
    S3_REGION: str = "us-east-1"
    PUBLIC_BASE_URL: str = ""  # e.g. https://api.example.com. Empty means "use the request's host"
    PAYMENT_PROVIDER: str = "mock"  # add "stripe" / "razorpay" in app/services/payment_providers.py
    S3_ENDPOINT: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET: str = ""


settings = Settings()
