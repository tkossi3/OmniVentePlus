"""Persistence models for the marketplace experience."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "marketplace_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(20), default="buyer")
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(40))
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(240))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    products: Mapped[list["MarketplaceProduct"]] = relationship(back_populates="seller")


class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    seller: Mapped[User] = relationship(back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.position"
    )


class ProductImage(Base):
    __tablename__ = "marketplace_product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("marketplace_products.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    alt_text: Mapped[str] = mapped_column(String(160), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_uploaded: Mapped[bool] = mapped_column(Boolean, default=False)

    product: Mapped[MarketplaceProduct] = relationship(back_populates="images")


class MarketplaceConversation(Base):
    __tablename__ = "marketplace_conversations"
    __table_args__ = (
        UniqueConstraint("product_id", "buyer_id", name="uq_marketplace_conversation_buyer_product"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("marketplace_products.id", ondelete="CASCADE"), index=True
    )
    buyer_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id", ondelete="CASCADE"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[MarketplaceProduct] = relationship()
    buyer: Mapped[User] = relationship(foreign_keys=[buyer_id])
    seller: Mapped[User] = relationship(foreign_keys=[seller_id])
    messages: Mapped[list["MarketplaceMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan",
        order_by="MarketplaceMessage.created_at"
    )


class MarketplaceMessage(Base):
    __tablename__ = "marketplace_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("marketplace_conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[MarketplaceConversation] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()


class MarketplaceOrder(Base):
    __tablename__ = "marketplace_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("marketplace_users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("marketplace_products.id"))
    product_name: Mapped[str] = mapped_column(String(160))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(40))
    delivery_address: Mapped[str] = mapped_column(String(240))
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    buyer: Mapped[User] = relationship(foreign_keys=[buyer_id])
    seller: Mapped[User] = relationship(foreign_keys=[seller_id])
    product: Mapped[MarketplaceProduct] = relationship()
