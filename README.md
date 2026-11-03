# Résidence Blessing — Administration portable

Application d'édition des informations de la page de la **Résidence Blessing**
(appartement meublé à Cocotomey, Abomey-Calavi, Bénin). Version portable
classique : **Node.js avec la bibliothèque standard uniquement** — aucune
dépendance npm, aucune étape de build.

## Contenu

- `server.js` — serveur HTTP : sert l'interface, les photos et l'API.
- `public/index.html` — interface d'administration (onglets Infos, Tarifs,
  Équipements, Photos, FAQ, Posts, Avis, Liens/SEO), avec aperçu visiteur et
  simulation tarifaire.
- `public/visitor.html` — aperçu visiteur simple, lisant les données de l'API.
- `assets/` — les 8 photos de la page (fichiers JPEG d'origine).
- `data.json` — toutes les données éditables (infos, tarifs, équipements,
  photos et leurs légendes, FAQ, posts, avis et réponses, liens Airbnb/Booking,
  titres SEO). Une sauvegarde `data.json.bak` est créée à chaque enregistrement.

## Lancer en local

```bash
node server.js
```

Puis ouvrir http://localhost:3000 (administration) et
http://localhost:3000/visitor.html (aperçu visiteur).

Aucune installation n'est nécessaire : `node server.js` suffit (Node.js 18
ou plus récent recommandé).

## Variables d'environnement

- `PORT` — port d'écoute (défaut : `3000`).
- `ADMIN_PASSWORD` — mot de passe administrateur. Quand cette variable est
  définie, l'écriture (`POST /api/data`) exige une session : l'interface
  affiche un formulaire de connexion et vérifie le mot de passe via
  `POST /api/login` (cookie de session httpOnly, valable 24 h). Quand elle
  n'est **pas** définie, l'interface affiche un avertissement visible mais
  laisse fonctionner en local.

Exemple :

```bash
ADMIN_PASSWORD='mot-de-passe-solide' PORT=3000 node server.js
```

## API

- `GET /api/status` — `{ authRequired, authenticated }`.
- `GET /api/data` — lecture des données (publique, en lecture seule).
- `POST /api/data` — écriture des données (JSON complet ; exige une session
  si `ADMIN_PASSWORD` est définie).
- `POST /api/login` — `{ "password": "..." }`, crée la session.

## Déployer sur Render

1. Poussez ce dossier dans un dépôt GitHub.
2. Sur Render, créez un **Web Service** depuis ce dépôt, environnement
   **Node**, commande de démarrage : `node server.js`.
3. Render définit `PORT` automatiquement : le serveur l'utilise déjà.
4. Dans les variables d'environnement du service, définissez
   `ADMIN_PASSWORD` avec un mot de passe solide.
5. Déployez : l'interface est accessible à l'URL fournie par Render.

## Déployer sur Railway

1. Poussez ce dossier dans un dépôt GitHub.
2. Sur Railway, créez un projet depuis ce dépôt (détection Node automatique).
3. Commande de démarrage : `node server.js` (Railway définit `PORT`).
4. Ajoutez la variable `ADMIN_PASSWORD`.
5. Générez un domaine public dans les réglages du service.

## Déployer sur un VPS

1. Installez Node.js sur le serveur.
2. Copiez ce dossier (par exemple dans `/opt/residence-blessing-admin`).
3. Lancez avec un gestionnaire de processus, par exemple :

```bash
ADMIN_PASSWORD='mot-de-passe-solide' PORT=3000 node server.js
```

4. Pour l'exposer proprement, placez un reverse proxy (nginx, Caddy) devant
   le port 3000 avec HTTPS, et limitez l'accès à l'administration si besoin.

## Avertissements importants

- **Les modifications faites ici ne se reportent pas automatiquement** sur la
  page Muse ni sur GitHub Pages : ces copies sont figées et exigent chacune
  un nouvel export / redéploiement pour refléter un changement.
- **Ne déployez jamais cette application sans `ADMIN_PASSWORD`** sur une URL
  publique : sans mot de passe, n'importe qui pourrait modifier les données.
- **Aucune coordonnée** (téléphone, WhatsApp, e-mail) n'est stockée dans cette
  application : les réservations passent uniquement par les liens Airbnb et
  Booking.com.
