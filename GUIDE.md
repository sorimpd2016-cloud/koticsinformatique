# Kotic's Informatique — site + admin

Vrai site web (pas juste un fichier HTML) : un petit serveur gère le catalogue, et une page `/admin` protégée par mot de passe permet d'ajouter, modifier et supprimer des produits (avec plusieurs photos par produit).

## Ce que contient le dossier

```
kotics-site/
  server.js          → le serveur (Node.js/Express)
  package.json       → liste des dépendances
  .env                → tes réglages (mot de passe admin, numéro WhatsApp...)
  data/products.json  → tes produits (modifiés automatiquement par l'admin)
  public/
    index.html         → le site public
    admin.html          → la page admin (/admin)
    images/              → logo
  uploads/products/       → les photos de chaque produit
```

## 1. Lancer le site sur ton ordinateur

Il te faut [Node.js](https://nodejs.org) installé (version 18 ou plus).

```bash
cd kotics-site
npm install
```

Ouvre le fichier `.env` et change au minimum :

```
ADMIN_PASSWORD=ton-mot-de-passe-a-toi
JWT_SECRET=une-longue-phrase-aleatoire-que-tu-inventes
WHATSAPP_NUMBER=221785314117
```

Puis démarre le serveur :

```bash
npm start
```

- Site public : http://localhost:3000
- Page admin : http://localhost:3000/admin (mot de passe = celui mis dans `.env`)

## 2. Utiliser la page admin

Sur `/admin`, entre ton mot de passe. Tu arrives sur la liste des produits :

- **+ Ajouter un produit** : nom, catégorie, prix, caractéristiques (une ligne par ligne, avec emoji si tu veux — comme sur WhatsApp), et tu peux téléverser plusieurs photos d'un coup.
- **Modifier** : change n'importe quel champ, ajoute de nouvelles photos, ou supprime une photo existante avec le ✕.
- **Supprimer** : retire le produit et toutes ses photos.

Tout est enregistré automatiquement dans `data/products.json` et le site public se met à jour immédiatement (rafraîchis la page).

Le champ "Caractéristiques" accepte n'importe quel texte, une ligne = une caractéristique affichée. Exemple :

```
⚙️ Processeur Intel Core i5-8565U (Quad-Core 1.8 GHz / 4.6 GHz Turbo)
🛡️ Ram 8 Go DDR4 (extensible à 32 Go)
📀 Disque Dur SSD 256 Go (Extensible à 512 Go)
💻 Écran Full HD 15.6 pouces
🔋 Excellente autonomie
```

## 3. Mettre le site en ligne — ce qu'il faut savoir

Comme il y a maintenant un vrai serveur avec une page admin qui écrit des fichiers (produits + photos), il faut un hébergement qui **garde ces fichiers en mémoire en continu**. Ce n'est plus un simple fichier qu'on héberge gratuitement n'importe où.

**Important à savoir** : les hébergements réellement gratuits (comme Render en offre gratuite) ne gardent pas les fichiers de façon fiable — ils peuvent être effacés à chaque redémarrage du serveur, ce qui ferait disparaître tes produits ajoutés depuis l'admin. Pour un vrai site de vente, il faut un hébergement avec **stockage persistant**, ce qui coûte généralement un petit montant.

Options recommandées :

- **Railway** (https://railway.app) — le plus simple à mettre en place. Après l'essai gratuit, compte environ **5 $/mois** pour un plan avec stockage persistant (volume). Étapes : crée un compte, "New Project" → "Deploy from GitHub repo" (ou "Empty Project" + upload), ajoute un volume monté sur `/app/uploads` et un sur `/app/data`, renseigne les variables d'environnement (`ADMIN_PASSWORD`, `JWT_SECRET`, `WHATSAPP_NUMBER`), déploie.
- **Un petit VPS** (Hostinger, Contabo, DigitalOcean...) — à partir de 4-6 $/mois, tu installes Node.js toi-même (ou je peux te guider), et tout reste stocké normalement puisque c'est ton propre serveur.

Je peux te guider pas à pas sur l'une de ces options quand tu es prêt à mettre le site en ligne — dis-moi simplement laquelle tu préfères.

## 4. Sécurité de la page admin

- Change `ADMIN_PASSWORD` dans `.env` avant de mettre le site en ligne (ne garde pas "change-moi").
- Change aussi `JWT_SECRET` (une longue phrase aléatoire, différente du mot de passe).
- Le lien vers `/admin` est discret en bas du site public ("Gérer le site"), mais reste accessible à qui devine l'adresse — le mot de passe est ce qui protège réellement l'accès.
- Ne partage ce mot de passe qu'avec les personnes qui doivent gérer le catalogue.
