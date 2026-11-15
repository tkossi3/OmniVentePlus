# OmniVente

**Le marché local, tout près.** OmniVente met en relation des clients et des vendeurs : découverte de produits, galeries photo, commandes avec coordonnées de livraison et conversations privées.

## Nouvelle direction

- **Frontend :** React 18 + Vite (`frontend/`).
- **Backend :** FastAPI + SQLAlchemy (`backend/`).
- **Comptes :** client, vendeur et administrateur. Les mots de passe sont hachés ; les accès API utilisent un jeton signé.
- **Produits :** annonces, stock et jusqu’à huit photos par produit. Les photos utilisent un stockage S3-compatible configurable.
- **Commandes :** le client renseigne son nom, téléphone, ville et adresse, et peut partager sa position GPS. La commande est transmise au vendeur ; le paiement s’effectue directement auprès de celui-ci.
- **Conversations :** le client et le vendeur échangent dans un fil privé lié au produit.
- **Administration :** aperçu du marché, comptes et modération des annonces.

Les anciennes données ne sont plus importées. Le catalogue et le script de démonstration CSV de l’application ont été retirés. Les fichiers historiques de `Docs/` sont conservés et ne sont pas chargés par le serveur. Le nouvel initialiseur crée uniquement les tables manquantes : il ne supprime pas la base existante.

## Lancer en local (Windows)

Voir [LOCAL_SETUP.md](LOCAL_SETUP.md) pour les commandes détaillées. En bref :

1. Créez une base PostgreSQL, copiez `backend/.env.example` vers `backend/.env`, puis renseignez `DATABASE_URL`, `JWT_SECRET` et `ADMIN_EMAIL`.
2. Dans `backend/`, installez les paquets Python, puis exécutez `python -m scripts.init_db` et `uvicorn app.main:app --reload`.
3. Configurez un bucket S3-compatible dans `backend/.env` pour activer l’envoi des photos.
4. Dans `frontend/`, lancez `npm install` puis `npm run dev`.

L’API et sa documentation interactive sont disponibles sur `http://localhost:8000` et `http://localhost:8000/docs`. Le frontend est servi sur `http://127.0.0.1:5173`.

## Configuration initiale

- Créez le compte administrateur avec `python -m scripts.create_admin` après avoir défini `ADMIN_EMAIL`. Cette commande locale évite de donner le rôle administrateur via une inscription publique.
- Les photos sont envoyées directement du navigateur vers le bucket avec une URL temporaire. Configurez les règles CORS du bucket pour autoriser l’origine du frontend, la méthode `PUT` et l’en-tête `Content-Type`.
- Si `S3_PUBLIC_BASE_URL` est défini, les images sont servies par cette URL. Sinon, l’API produit des liens de lecture temporaires.
- `VITE_API_URL` permet de remplacer l’URL par défaut `http://localhost:8000/api`.

En production, définissez `APP_ENV=production`, un `JWT_SECRET` aléatoire d’au moins 32 caractères, une origine CORS précise, HTTPS et des identifiants de stockage limités au bucket. Ne publiez jamais de fichier `.env`.

## Routes principales

| Méthode | Route | Accès |
|---|---|---|
| `POST` | `/api/auth/register`, `/api/auth/login` | Public |
| `GET` | `/api/products` | Public |
| `POST` | `/api/seller/products` | Vendeur |
| `POST` | `/api/seller/products/{id}/images` | Vendeur |
| `POST` | `/api/products/{id}/conversations` | Client |
| `GET/POST` | `/api/conversations/{id}/messages` | Participants |
| `POST` | `/api/orders` | Client |
| `GET` | `/api/orders` | Client ou vendeur |
| `GET` | `/api/admin/overview` | Administrateur |

Les échanges sont actualisés périodiquement dans l’interface. Aucun paiement en ligne n’est activé dans cette première version.
