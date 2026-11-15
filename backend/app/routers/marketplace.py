"""Marketplace accounts, catalog, orders, conversations and administration."""
from datetime import datetime
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.marketplace_auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    require_seller,
    verify_password,
)
from app.marketplace_models import (
    MarketplaceConversation,
    MarketplaceMessage,
    MarketplaceOrder,
    MarketplaceProduct,
    ProductImage,
    User,
)
from app.marketplace_schemas import (
    AdminProductStatusIn,
    AdminRoleIn,
    LoginIn,
    MessageIn,
    OrderIn,
    OrderStatusIn,
    ProfileUpdateIn,
    ProductImageIn,
    ProductIn,
    ProductUpdateIn,
    RegisterIn,
    UserOut,
)

router = APIRouter(prefix="/api", tags=["Marketplace"])


def _account(user: User) -> dict:
    return {"access_token": create_access_token(user), "token_type": "bearer",
            "user": UserOut.model_validate(user).model_dump()}


def _storage_client():
    if not settings.s3_bucket:
        raise HTTPException(503, "Le stockage d’images S3 n’est pas encore configuré.")
    options = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "endpoint_url": settings.s3_endpoint_url,
    }
    if settings.aws_access_key_id:
        options["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        options["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client(**options)


def _image_url(image: ProductImage) -> str | None:
    if not settings.s3_bucket:
        return None
    if settings.s3_public_base_url:
        return f"{settings.s3_public_base_url.rstrip('/')}/{image.storage_key}"
    try:
        return _storage_client().generate_presigned_url(
            "get_object", Params={"Bucket": settings.s3_bucket, "Key": image.storage_key},
            ExpiresIn=3600,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(503, "Impossible de générer le lien d’une image.") from exc


def _product_out(product: MarketplaceProduct) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "price": str(product.price),
        "stock": product.stock,
        "status": product.status,
        "created_at": product.created_at,
        "seller": {"id": product.seller.id, "name": f"{product.seller.first_name} {product.seller.last_name}"},
        "images": [
            {"id": image.id, "url": _image_url(image), "alt_text": image.alt_text, "position": image.position}
            for image in product.images if image.is_uploaded
        ],
    }


def _product_query():
    return select(MarketplaceProduct).options(
        joinedload(MarketplaceProduct.seller), joinedload(MarketplaceProduct.images)
    )


def _conversation_for(db: Session, conversation_id: int, user: User) -> MarketplaceConversation:
    conversation = db.scalar(
        select(MarketplaceConversation).where(MarketplaceConversation.id == conversation_id)
        .options(joinedload(MarketplaceConversation.product),
                 joinedload(MarketplaceConversation.buyer),
                 joinedload(MarketplaceConversation.seller))
    )
    if conversation is None:
        raise HTTPException(404, "Conversation introuvable.")
    if user.role != "admin" and user.id not in (conversation.buyer_id, conversation.seller_id):
        raise HTTPException(403, "Cette conversation ne vous appartient pas.")
    return conversation


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if settings.admin_email and payload.email == settings.admin_email.strip().lower():
        raise HTTPException(403, "Le compte administrateur doit être créé depuis le terminal.")
    if db.scalar(select(User.id).where(User.email == payload.email)):
        raise HTTPException(409, "Cette adresse e-mail est déjà utilisée.")
    user = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role,
                first_name=payload.first_name.strip(), last_name=payload.last_name.strip(),
                phone=payload.phone.strip() if payload.phone else None)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _account(user)


@router.post("/auth/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Adresse e-mail ou mot de passe incorrect.")
    return _account(user)


@router.get("/auth/me", response_model=UserOut)
def read_account(user: User = Depends(get_current_user)):
    return user


@router.put("/auth/me", response_model=UserOut)
def update_account(payload: ProfileUpdateIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.phone = payload.phone
    user.city = payload.city
    user.address = payload.address
    db.commit()
    db.refresh(user)
    return user


@router.get("/products")
def list_products(q: str | None = Query(default=None, max_length=100),
                  category: str | None = Query(default=None, max_length=80),
                  db: Session = Depends(get_db)):
    query = _product_query().where(
        MarketplaceProduct.status == "published", MarketplaceProduct.stock > 0
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(MarketplaceProduct.name.ilike(term),
                                MarketplaceProduct.description.ilike(term)))
    if category and category.strip():
        query = query.where(MarketplaceProduct.category.ilike(category.strip()))
    products = db.scalars(query.order_by(MarketplaceProduct.created_at.desc())).unique().all()
    return [_product_out(product) for product in products]


@router.patch("/admin/products/{product_id}")
def moderate_product(product_id: int, payload: AdminProductStatusIn,
                     db: Session = Depends(get_db), _: User = Depends(require_admin)):
    product = db.scalar(select(MarketplaceProduct).where(
        MarketplaceProduct.id == product_id
    ))
    if product is None:
        raise HTTPException(404, "Produit introuvable.")
    if payload.status == "published" and not any(image.is_uploaded for image in product.images):
        raise HTTPException(422, "Ajoutez au moins une photo avant de publier le produit.")
    product.status = payload.status
    db.commit()
    return {"id": product.id, "status": product.status}


@router.patch("/admin/users/{user_id}/role", response_model=UserOut)
def update_user_role(user_id: int, payload: AdminRoleIn, db: Session = Depends(get_db),
                     admin: User = Depends(require_admin)):
    account = db.scalar(select(User).where(User.id == user_id))
    if account is None:
        raise HTTPException(404, "Compte introuvable.")
    if account.id == admin.id:
        raise HTTPException(409, "Vous ne pouvez pas modifier votre propre rôle administrateur.")
    account.role = payload.role
    db.commit()
    db.refresh(account)
    return account


@router.get("/products/{product_id}")
def read_product(product_id: int, db: Session = Depends(get_db)):
    product = db.scalars(_product_query().where(
        MarketplaceProduct.id == product_id, MarketplaceProduct.status == "published"
    )).unique().first()
    if product is None:
        raise HTTPException(404, "Produit introuvable.")
    return _product_out(product)


@router.get("/seller/products")
def seller_products(db: Session = Depends(get_db), user: User = Depends(require_seller)):
    products = db.scalars(_product_query().where(
        MarketplaceProduct.seller_id == user.id
    ).order_by(MarketplaceProduct.created_at.desc())).unique().all()
    return [_product_out(product) for product in products]


@router.post("/seller/products", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductIn, db: Session = Depends(get_db),
                   user: User = Depends(require_seller)):
    product = MarketplaceProduct(seller_id=user.id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    product = db.scalars(_product_query().where(
        MarketplaceProduct.id == product.id
    )).unique().first()
    return _product_out(product)


@router.put("/seller/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdateIn, db: Session = Depends(get_db),
                   user: User = Depends(require_seller)):
    product = db.scalar(select(MarketplaceProduct).where(MarketplaceProduct.id == product_id))
    if product is None or (user.role != "admin" and product.seller_id != user.id):
        raise HTTPException(404, "Produit introuvable.")
    if payload.status == "published" and not any(image.is_uploaded for image in product.images):
        raise HTTPException(422, "Ajoutez au moins une photo avant de publier le produit.")
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    db.commit()
    product = db.scalars(_product_query().where(
        MarketplaceProduct.id == product_id
    )).unique().first()
    return _product_out(product)


@router.delete("/seller/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require_seller)):
    product = db.scalar(select(MarketplaceProduct).where(MarketplaceProduct.id == product_id))
    if product is None or (user.role != "admin" and product.seller_id != user.id):
        raise HTTPException(404, "Produit introuvable.")
    if db.scalar(select(MarketplaceOrder.id).where(
        MarketplaceOrder.product_id == product.id
    ).limit(1)):
        raise HTTPException(409, "Un produit commandé ne peut pas être supprimé. Mettez-le en brouillon.")
    db.delete(product)
    db.commit()


@router.post("/seller/products/{product_id}/images", status_code=status.HTTP_201_CREATED)
def create_image_upload(product_id: int, payload: ProductImageIn, db: Session = Depends(get_db),
                        user: User = Depends(require_seller)):
    product = db.scalar(select(MarketplaceProduct).where(MarketplaceProduct.id == product_id))
    if product is None or (user.role != "admin" and product.seller_id != user.id):
        raise HTTPException(404, "Produit introuvable.")
    if len(product.images) >= 8:
        raise HTTPException(409, "Un produit peut contenir au maximum 8 photos.")
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[payload.content_type]
    key = f"products/{product.id}/{uuid4().hex}.{extension}"
    try:
        client = _storage_client()
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": payload.content_type},
            ExpiresIn=600,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(503, "Impossible de préparer l’envoi de la photo.") from exc
    image = ProductImage(storage_key=key, alt_text=payload.alt_text.strip(),
                         position=len(product.images), product=product)
    db.add(image)
    db.commit()
    db.refresh(image)
    return {"image_id": image.id, "upload_url": upload_url,
            "method": "PUT", "content_type": payload.content_type}


@router.post("/seller/images/{image_id}/complete")
def complete_image_upload(image_id: int, db: Session = Depends(get_db),
                          user: User = Depends(require_seller)):
    image = db.scalar(select(ProductImage).where(ProductImage.id == image_id))
    if image is None:
        raise HTTPException(404, "Photo introuvable.")
    if user.role != "admin" and image.product.seller_id != user.id:
        raise HTTPException(403, "Cette photo ne vous appartient pas.")
    client = _storage_client()
    try:
        uploaded = client.head_object(Bucket=settings.s3_bucket, Key=image.storage_key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            raise HTTPException(409, "La photo n’a pas encore été reçue par le stockage.") from exc
        raise HTTPException(503, "Impossible de vérifier la photo dans le stockage.") from exc
    except BotoCoreError as exc:
        raise HTTPException(503, "Impossible de vérifier la photo dans le stockage.") from exc
    if uploaded.get("ContentLength", 0) > 10 * 1024 * 1024:
        try:
            client.delete_object(Bucket=settings.s3_bucket, Key=image.storage_key)
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(503, "La photo dépasse 10 Mo et n’a pas pu être supprimée.") from exc
        raise HTTPException(413, "Chaque photo doit peser au maximum 10 Mo.")
    image.is_uploaded = True
    db.commit()
    return {"image_id": image.id, "status": "ready", "url": _image_url(image)}


@router.post("/products/{product_id}/conversations", status_code=status.HTTP_201_CREATED)
def start_conversation(product_id: int, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    if user.role not in ("buyer", "admin"):
        raise HTTPException(403, "Un compte client est requis pour contacter un vendeur.")
    product = db.scalar(select(MarketplaceProduct).where(
        MarketplaceProduct.id == product_id, MarketplaceProduct.status == "published"
    ))
    if product is None:
        raise HTTPException(404, "Produit introuvable.")
    if product.seller_id == user.id:
        raise HTTPException(400, "Vous ne pouvez pas démarrer une conversation sur votre propre annonce.")
    conversation = db.scalar(select(MarketplaceConversation).where(
        MarketplaceConversation.product_id == product.id,
        MarketplaceConversation.buyer_id == user.id,
    ))
    if conversation is None:
        conversation = MarketplaceConversation(product_id=product.id, buyer_id=user.id,
                                               seller_id=product.seller_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    return {"id": conversation.id, "product_id": product.id, "product_name": product.name,
            "seller_name": f"{product.seller.first_name} {product.seller.last_name}"}


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(MarketplaceConversation).options(
        joinedload(MarketplaceConversation.product),
        joinedload(MarketplaceConversation.buyer),
        joinedload(MarketplaceConversation.seller),
    )
    if user.role != "admin":
        query = query.where(or_(MarketplaceConversation.buyer_id == user.id,
                                MarketplaceConversation.seller_id == user.id))
    conversations = db.scalars(query.order_by(MarketplaceConversation.created_at.desc())).unique().all()
    return [{
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product.name,
        "buyer_name": f"{item.buyer.first_name} {item.buyer.last_name}",
        "seller_name": f"{item.seller.first_name} {item.seller.last_name}",
        "created_at": item.created_at,
    } for item in conversations]


@router.get("/conversations/{conversation_id}/messages")
def read_messages(conversation_id: int, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    _conversation_for(db, conversation_id, user)
    messages = db.scalars(select(MarketplaceMessage).where(
        MarketplaceMessage.conversation_id == conversation_id
    ).order_by(MarketplaceMessage.created_at)).all()
    return [{"id": item.id, "sender_id": item.sender_id, "body": item.body,
             "created_at": item.created_at} for item in messages]


@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(conversation_id: int, payload: MessageIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    conversation = _conversation_for(db, conversation_id, user)
    message = MarketplaceMessage(conversation_id=conversation.id, sender_id=user.id,
                                 body=payload.body)
    db.add(message)
    db.commit()
    db.refresh(message)
    return {"id": message.id, "sender_id": message.sender_id,
            "body": message.body, "created_at": message.created_at}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if user.role not in ("buyer", "admin"):
        raise HTTPException(403, "Un compte client est requis pour commander.")
    product = db.scalar(select(MarketplaceProduct).where(
        MarketplaceProduct.id == payload.product_id
    ).with_for_update())
    if product is None or product.status != "published":
        raise HTTPException(404, "Ce produit n’est plus disponible.")
    if product.seller_id == user.id:
        raise HTTPException(400, "Vous ne pouvez pas commander votre propre produit.")
    if product.stock < payload.quantity:
        raise HTTPException(409, "Le stock disponible ne permet pas cette quantité.")
    product.stock -= payload.quantity
    order = MarketplaceOrder(
        reference=f"OV-{datetime.now().year}-{uuid4().hex[:16].upper()}",
        buyer_id=user.id, seller_id=product.seller_id, product_id=product.id,
        product_name=product.name, quantity=payload.quantity, unit_price=product.price,
        first_name=payload.first_name.strip(), last_name=payload.last_name.strip(),
        phone=payload.phone.strip(), delivery_address=payload.delivery_address.strip(),
        city=payload.city.strip(), latitude=payload.latitude, longitude=payload.longitude,
    )
    user.first_name = order.first_name
    user.last_name = order.last_name
    user.phone = order.phone
    user.address = order.delivery_address
    user.city = order.city
    db.add(order)
    db.commit()
    return _order_out(order)


def _order_out(order: MarketplaceOrder) -> dict:
    return {
        "id": order.id, "reference": order.reference, "product_id": order.product_id,
        "product_name": order.product_name, "quantity": order.quantity,
        "unit_price": str(order.unit_price), "total": str(order.unit_price * order.quantity),
        "status": order.status, "first_name": order.first_name, "last_name": order.last_name,
        "phone": order.phone, "delivery_address": order.delivery_address, "city": order.city,
        "latitude": float(order.latitude) if order.latitude is not None else None,
        "longitude": float(order.longitude) if order.longitude is not None else None,
        "created_at": order.created_at,
        "buyer": f"{order.first_name} {order.last_name}",
        "seller": f"{order.seller.first_name} {order.seller.last_name}",
    }


@router.get("/orders")
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(MarketplaceOrder).options(
        joinedload(MarketplaceOrder.buyer), joinedload(MarketplaceOrder.seller)
    )
    if user.role == "seller":
        query = query.where(MarketplaceOrder.seller_id == user.id)
    elif user.role == "buyer":
        query = query.where(MarketplaceOrder.buyer_id == user.id)
    orders = db.scalars(query.order_by(MarketplaceOrder.created_at.desc())).unique().all()
    return [_order_out(order) for order in orders]


@router.patch("/seller/orders/{order_id}")
def update_order(order_id: int, payload: OrderStatusIn, db: Session = Depends(get_db),
                 user: User = Depends(require_seller)):
    order = db.scalar(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    if order is None or (user.role != "admin" and order.seller_id != user.id):
        raise HTTPException(404, "Commande introuvable.")
    transitions = {
        "pending": {"confirmed", "cancelled"},
        "confirmed": {"preparing", "cancelled"},
        "preparing": {"shipped", "cancelled"},
        "shipped": {"completed"},
        "completed": set(),
        "cancelled": set(),
    }
    if payload.status not in transitions.get(order.status, set()):
        raise HTTPException(409, "Cette étape de commande n’est pas autorisée.")
    if payload.status == "cancelled":
        product = db.scalar(select(MarketplaceProduct).where(
            MarketplaceProduct.id == order.product_id
        ).with_for_update())
        if product:
            product.stock += order.quantity
    order.status = payload.status
    db.commit()
    return {"id": order.id, "reference": order.reference, "status": order.status}


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return {
        "users": db.scalar(select(func.count(User.id))) or 0,
        "sellers": db.scalar(select(func.count(User.id)).where(User.role == "seller")) or 0,
        "products": db.scalar(select(func.count(MarketplaceProduct.id))) or 0,
        "orders": db.scalar(select(func.count(MarketplaceOrder.id))) or 0,
    }


@router.get("/admin/users", response_model=list[UserOut])
def admin_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.scalars(select(User).order_by(User.created_at.desc())).all()


@router.get("/admin/products")
def admin_products(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    products = db.scalars(_product_query().order_by(
        MarketplaceProduct.created_at.desc()
    )).unique().all()
    return [_product_out(product) for product in products]
