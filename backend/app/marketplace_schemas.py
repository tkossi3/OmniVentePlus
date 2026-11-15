"""Request contracts for the marketplace API."""
import re
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=128)
    role: Literal["buyer", "seller"]
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Adresse e-mail invalide.")
        return normalized

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Ce champ est obligatoire.")
        return normalized


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(min_length=1, max_length=5000)
    category: str = Field(min_length=2, max_length=80)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    stock: int = Field(ge=0, le=100_000)

    @field_validator("name", "description", "category")
    @classmethod
    def trim_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Ce champ est obligatoire.")
        return normalized


class ProductUpdateIn(ProductIn):
    status: Literal["draft", "published"]


class ProductImageIn(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    alt_text: str = Field(default="", max_length=160)


class OrderIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=5, max_length=40)
    delivery_address: str = Field(min_length=5, max_length=240)
    city: str = Field(min_length=2, max_length=100)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, max_digits=9, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, max_digits=9, decimal_places=6)

    @field_validator("first_name", "last_name", "phone", "delivery_address", "city")
    @classmethod
    def trim_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Ce champ est obligatoire.")
        return normalized


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def trim_body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Le message ne peut pas être vide.")
        return value

class OrderStatusIn(BaseModel):
    status: Literal["confirmed", "preparing", "shipped", "completed", "cancelled"]


class ProfileUpdateIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=240)

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Ce champ est obligatoire.")
        return normalized


class AdminRoleIn(BaseModel):
    role: Literal["buyer", "seller"]


class AdminProductStatusIn(BaseModel):
    status: Literal["draft", "published"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    first_name: str
    last_name: str
    phone: str | None
    city: str | None
    address: str | None
