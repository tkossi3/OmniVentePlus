# Démarrage local OmniVente+ (Windows)

## Prérequis

- Python 3.11 ou plus récent
- PostgreSQL 14 ou plus récent
- Node.js 20.19 ou plus récent (requis par Vite 8)
- Un bucket S3-compatible pour activer les photos produits

## 1. Créer une base PostgreSQL

Depuis PowerShell ou le terminal PostgreSQL, créez un rôle et une base **seulement s’ils n’existent pas déjà** :

```powershell
psql -U postgres -c "CREATE USER omnivente WITH PASSWORD 'changez-ce-mot-de-passe';"
psql -U postgres -c "CREATE DATABASE omnivente_db OWNER omnivente;"
```

Ne relancez pas ces commandes si la base ou le rôle existe. L’application n’a plus de script `DROP DATABASE` et ne charge ni ancien catalogue ni données d’exemple.

## 2. Configurer et lancer FastAPI

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Dans `backend/.env`, renseignez au minimum :

```env
DATABASE_URL=postgresql+psycopg2://omnivente:changez-ce-mot-de-passe@localhost:5432/omnivente_db
JWT_SECRET=remplacez-par-une-cle-aleatoire-d-au-moins-32-caracteres
ADMIN_EMAIL=votre-adresse@example.com
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

Pour les photos, ajoutez les paramètres du bucket dans le même fichier :

```env
S3_BUCKET=
S3_REGION=
S3_ENDPOINT_URL=
S3_PUBLIC_BASE_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

AWS S3 et les fournisseurs compatibles S3 sont acceptés. Si le bucket est privé, laissez `S3_PUBLIC_BASE_URL` vide : l’API générera des liens de lecture temporaires. Configurez la règle CORS du bucket pour autoriser le frontend, `PUT` et `Content-Type`.

Initialisez les nouvelles tables sans effacer les tables ou données déjà présentes. Créez ensuite le compte administrateur depuis le terminal (le mot de passe est saisi sans être affiché), puis démarrez l’API :

```powershell
python -m scripts.init_db
python -m scripts.create_admin
uvicorn app.main:app --reload
```

L’API est sur `http://localhost:8000`, Swagger sur `http://localhost:8000/docs`. Le rôle administrateur n’est jamais attribué par l’inscription publique.

## 3. Lancer React

Dans un deuxième terminal :

```powershell
cd frontend
npm install
npm run dev
```

Ouvrez `http://127.0.0.1:5173`. L’URL par défaut de l’API est `http://localhost:8000/api`. Pour la changer, créez `frontend/.env.local` :

```env
VITE_API_URL=https://votre-api.example.com/api
```

## Vérification

- `GET http://localhost:8000/health` affiche l’état de l’API et de la configuration du stockage.
- `npm run build` compile le frontend de production.
- La publication d’un produit nécessite au moins une photo. Les formats JPG, PNG et WEBP sont acceptés ; le parcours vendeur permet jusqu’à huit images.

Les conversations sont actualisées périodiquement. Le partage GPS est facultatif et nécessite l’autorisation du navigateur (HTTPS en production). Les clients envoient une demande de commande, mais aucun paiement en ligne n’est prélevé dans cette version.
