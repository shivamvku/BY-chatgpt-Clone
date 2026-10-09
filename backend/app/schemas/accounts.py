from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.contracts import Credentials


class EmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    email_format = field_validator("email")(Credentials.email_format.__func__)


class TokenRequest(BaseModel):
    token: str = Field(min_length=40, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")


class PasswordReset(TokenRequest):
    password: str = Field(min_length=10, max_length=128)


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=10, max_length=128)
    password: str = Field(min_length=10, max_length=128)


class Notice(BaseModel):
    message: str


class SubscriptionUpdate(BaseModel):
    plan: Literal["basic", "pro", "pro_max"]
    status: Literal["active", "suspended"] = "active"
    expires_at: int | None = Field(default=None, ge=1)


class PlanUpdate(BaseModel):
    daily_requests: int = Field(ge=0, le=1000)
    daily_tokens: int = Field(ge=0, le=1000000)


class PlanView(PlanUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    seats: int
    retention_days: int | None
    storage_bytes: int
    version: int


class SubscriptionView(BaseModel):
    id: str
    plan: str
    plan_name: str
    status: str
    expires_at: int | None
    owner: bool
    seats: int
    members: int
    retention_days: int | None
    storage_bytes: int
    daily_requests: int
    daily_tokens: int
    billing_mode: str
    payment_collection_enabled: bool


class UsageEventView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    model: str
    reserved_tokens: int
    status: str
    created_at: int


class AuditView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    actor_id: str
    target_id: str
    action: str
    created_at: int
