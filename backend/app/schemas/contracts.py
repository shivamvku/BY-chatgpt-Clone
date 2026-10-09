import re
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Import lazily to avoid circular imports at module load time.
def _valid_model_ids() -> set[str]:
    from app.services import provider  # noqa: PLC0415
    return set(provider.MODELS.keys()) | set(provider._LEGACY_ALIAS.keys())


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def email_format(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    appearance: Literal["light", "dark", "system"] = "system"
    contrast: Literal["standard", "high"] = "standard"
    bio: str = Field(default="", max_length=500)
    timezone: str = Field(default="UTC", max_length=80)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid timezone") from None
        return value

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()


class UserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: str
    active: bool
    verified_user: bool
    bio: str
    timezone: str
    appearance: str
    contrast: str
    created_at: int


class AdminUserView(UserView):
    plan: str | None
    plan_name: str | None
    subscription_status: str | None
    subscription_owner: bool


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=120)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    archived: bool | None = None


class ConversationView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    archived: bool
    created_at: int
    updated_at: int


class MessageView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    parent_id: str | None
    role: str
    content: str
    status: str
    model: str
    created_at: int
    updated_at: int


class SendMessage(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    parent_id: str | None = None
    request_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    model: str = Field(default="auto", max_length=80)

    @field_validator("model")
    @classmethod
    def model_must_be_known(cls, value: str) -> str:
        if value not in _valid_model_ids():
            raise ValueError("Unknown model ID. Choose a model from the available list.")
        return value


class Regenerate(BaseModel):
    request_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    model: str = Field(default="auto", max_length=80)

    @field_validator("model")
    @classmethod
    def model_must_be_known(cls, value: str) -> str:
        if value not in _valid_model_ids():
            raise ValueError("Unknown model ID. Choose a model from the available list.")
        return value


class AdminUpdate(BaseModel):
    role: Literal["user", "admin"]
    active: bool


class AdminSummary(BaseModel):
    total_users: int
    active_users: int
    verified_users: int
    administrators: int


class AuthState(BaseModel):
    user: UserView | None
    csrf: str


class SessionView(BaseModel):
    created_at: int
    expires_at: int
    current: bool
    source: str
    last_active_at: int


class ConversationPage(BaseModel):
    items: list[ConversationView]
    next_cursor: str | None


class ModelChoice(BaseModel):
    id: str
    name: str
    available: bool


class Capabilities(BaseModel):
    images: str
    tools: bool


class ModelInfo(BaseModel):
    configured: bool
    models: list[ModelChoice]
    capabilities: Capabilities


class UsageView(BaseModel):
    day: str
    requests: int
    reserved_tokens: int
    request_limit: int
    token_limit: int


class ImageView(BaseModel):
    id: str
    name: str
    created_at: int
    size: int


class UploadedImage(BaseModel):
    id: str
    name: str
    url: str
