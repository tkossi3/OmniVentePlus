"""Create the first administrator from the local command line."""
from getpass import getpass

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.marketplace_auth import hash_password
from app.marketplace_models import User


def main() -> None:
    email = (settings.admin_email or "").strip().lower()
    if not email:
        raise SystemExit("Définissez ADMIN_EMAIL dans le fichier .env avant de créer l’administrateur.")
    first_name = input("Prénom de l’administrateur : ").strip()
    last_name = input("Nom de l’administrateur : ").strip()
    password = getpass("Mot de passe (10 caractères minimum) : ")
    if len(password) < 10:
        raise SystemExit("Le mot de passe doit contenir au moins 10 caractères.")
    if password != getpass("Confirmez le mot de passe : "):
        raise SystemExit("Les mots de passe ne correspondent pas.")
    if not first_name or not last_name:
        raise SystemExit("Le prénom et le nom sont obligatoires.")

    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == email)):
            raise SystemExit(f"Un compte existe déjà pour {email}.")
        db.add(User(email=email, password_hash=hash_password(password), role="admin",
                    first_name=first_name, last_name=last_name))
        db.commit()
    print(f"Compte administrateur créé pour {email}.")


if __name__ == "__main__":
    main()
