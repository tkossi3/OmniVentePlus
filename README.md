# OmniVente+

**Vendre plus aisément.** OmniVente+ est une place de marché qui permet aux vendeurs de présenter leurs produits et aux clients de découvrir les boutiques, de commander et de contacter directement un vendeur. Le paiement se fait à la livraison ; aucun paiement en ligne n’est activé dans cette version.

## Fonctionnalités

- **Catalogue public :** recherche par nom, catégorie et boutique, consultation des produits et des vendeurs.
- **Comptes :** inscription et connexion pour les clients et les vendeurs, avec un accès séparé pour l’administration.
- **Espace vendeur :** création et publication de produits, gestion du stock et ajout de jusqu’à huit images par produit.
- **Commandes :** le client indique ses coordonnées et son adresse de livraison, avec partage facultatif de sa position GPS. Le vendeur suit les commandes et met leur état à jour.
- **Conversations :** échanges privés entre client et vendeur autour d’un produit.
- **Administration :** aperçu du marché, gestion des comptes et modération des annonces.
- **Interface responsive :** navigation adaptée au bureau et au téléphone.

## Technologies

- Frontend : React 18, Vite et lucide-react (`frontend/`).
- Backend : FastAPI, SQLAlchemy et PostgreSQL (`backend/`).
- Images : stockage S3-compatible facultatif.

## Démarrage rapide

Consultez [LOCAL_SETUP.md](LOCAL_SETUP.md) pour les prérequis, la configuration PostgreSQL et les étapes Windows détaillées.

En résumé :

1. Configurez `backend/.env` avec `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` et les origines CORS.
2. Dans `backend/`, installez les dépendances, initialisez la base, créez le compte administrateur et lancez FastAPI :

   ```powershell
   python -m pip install -r requirements.txt
   python -m scripts.init_db
   python -m scripts.create_admin
   uvicorn app.main:app --reload
   ```

3. Dans un autre terminal, installez les dépendances du frontend et démarrez Vite :

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

Le site est servi par défaut à `http://127.0.0.1:5173`. L’API est à `http://localhost:8000`, sa vérification de santé à `/health` et sa documentation interactive à `/docs`.

## Configuration

- Le frontend utilise `http://localhost:8000/api` par défaut. Définissez `VITE_API_URL` dans `frontend/.env.local` pour utiliser une autre API.
- L’envoi des images nécessite un bucket S3-compatible. Configurez les variables `S3_*` et `AWS_*` dans `backend/.env` et autorisez l’origine du frontend, la méthode `PUT` et l’en-tête `Content-Type` dans les règles CORS du bucket.
- Si `S3_PUBLIC_BASE_URL` n’est pas défini, l’API crée des liens de lecture temporaires pour les images.
- Créez l’administrateur avec `python -m scripts.create_admin`. L’inscription publique ne permet pas d’obtenir le rôle administrateur.
- `python -m scripts.init_db` crée les tables manquantes sans supprimer les tables ou données existantes. Les anciennes données et fichiers CSV de démonstration ne sont pas importés.
- En production, utilisez HTTPS, une clé `JWT_SECRET` aléatoire d’au moins 32 caractères, des origines CORS précises et des identifiants de stockage limités. Ne publiez jamais de fichier `.env`.

## API principale

| Méthode | Route | Accès |
|---|---|---|
| `POST` | `/api/auth/register`, `/api/auth/login` | Public |
| `GET` | `/api/products` | Public |
| `POST` | `/api/seller/products` | Vendeur |
| `POST` | `/api/seller/products/{id}/images` | Vendeur |
| `POST` | `/api/products/{id}/conversations` | Client |
| `GET`, `POST` | `/api/conversations/{id}/messages` | Participants |
| `POST` | `/api/orders` | Client |
| `GET` | `/api/orders` | Client ou vendeur |
| `GET` | `/api/admin/overview` | Administrateur |

## Vérification

Depuis `frontend/`, lancez `npm run build` pour vérifier et compiler l’interface de production. Le dépôt ne contient pas encore de suite de tests automatisés dédiée. Les tests de parcours doivent être exécutés avec l’API et une base configurées, ou avec une API de test.

## Limites actuelles

Les paiements en ligne, le retrait en boutique, les notifications de livraison et les profils de boutique avec leurs propres photos ne sont pas encore pris en charge par l’API actuelle. Le partage GPS est facultatif et nécessite l’autorisation du navigateur ; en production, il requiert HTTPS.
