"""Create missing marketplace tables without dropping or rewriting existing data."""
from app.database import Base, engine
from app.marketplace_models import (  # noqa: F401 — register marketplace tables.
    MarketplaceConversation,
    MarketplaceMessage,
    MarketplaceOrder,
    MarketplaceProduct,
    ProductImage,
    User,
)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Tables OmniVente vérifiées. Aucune donnée existante n’a été supprimée.")


if __name__ == "__main__":
    main()
