## LabLens

LabLens est une application complète pour **explorer, filtrer et analyser des données de laboratoire** à l’aide d’une API FastAPI (backend) et d’une interface web moderne en Next.js/React (frontend).

Le projet est structuré en deux parties principales :

- **backend** : API FastAPI, moteur de calcul (statistiques, panels, répétitions, co‑occurrence, vues/cohortes), accès DuckDB, logique de validation.
- **frontend** : application Next.js (TypeScript) avec des pages d’exploration (`/explorer`), assistant (`/assistant`), upload (`/upload`) et accueil (`/`).

---

## 1. Prérequis

- **Python** ≥ 3.10
- **Node.js** ≥ 18 + **npm**
- (Optionnel) **Docker** et **docker‑compose**

---

## 2. Installation rapide

Cloner le dépôt, puis se placer à la racine du projet :

```bash
cd lablens
```

### 2.1. Backend (FastAPI)

Créer un environnement virtuel (recommandé) et installer les dépendances :

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # sous Windows
pip install -r requirements.txt
```

Lancer le serveur backend :

```bash
uvicorn app.main:app --reload --port 8000
```

Par défaut l’API est disponible sur : `http://localhost:8000`

Les principaux endpoints sont exposés sous le préfixe `/api` (ingest, subset, stats, panels, repeats, coorder, views, llm).

### 2.2. Frontend (Next.js)

Dans un autre terminal, installer les dépendances et lancer le serveur de développement :

```bash
cd frontend
npm install
npm run dev
```

L’interface web est accessible sur : `http://localhost:3000`

---

## 3. Démarrage via Docker (optionnel)

Si vous utilisez Docker, vous pouvez lancer l’ensemble (backend + frontend + base DuckDB) avec :

```bash
docker-compose up --build
```

Ensuite :

- Frontend : `http://localhost:3000`
- Backend API : `http://localhost:8000`

---

## 4. Structure du projet (simplifiée)

- `backend/app/api` : endpoints FastAPI (`ingest.py`, `subset.py`, `stats.py`, `panels.py`, `repeats.py`, `coorder.py`, `views.py`, `llm.py`).
- `backend/app/services` : logique métier (moteurs de stats, panels, répétitions, co‑occurrence, etc.).
- `backend/app/db` : modèles, session et accès DuckDB.
- `frontend/src/pages` : pages Next.js (`index.tsx`, `explorer.tsx`, `assistant.tsx`, `upload.tsx`, `_app.tsx`).
- `frontend/src/components` : composants UI (charts, tables, filtres…).

Les anciens fichiers Markdown techniques (spécifications internes, diagnostics, etc.) ont été nettoyés pour alléger le dépôt.

---

## 5. Tests

Des tests backend sont disponibles dans le dossier `tests` à la racine du projet.

Pour les exécuter (après avoir activé l’environnement virtuel Python dans `backend`) :

```bash
pytest
```

---

## 6. Notes de développement

- Le backend expose une API REST documentée automatiquement par FastAPI sur :
  - `http://localhost:8000/docs` (Swagger UI)
  - `http://localhost:8000/redoc`
- Le frontend consomme ces endpoints via `fetch`/`axios` côté Next.js.

Si vous modifiez la structure des endpoints ou ajoutez de nouveaux services, pensez à mettre à jour les appels dans les pages `frontend/src/pages/*.tsx`.


