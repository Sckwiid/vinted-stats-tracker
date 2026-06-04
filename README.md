# Site GitHub Pages

Ce dossier contient le dashboard statique publié par GitHub Pages.

Pages disponibles :

- `index.html` : commandes en cours et changement de statut.
- `statistiques.html` : statistiques par groupe d'article.
- `articles.html` : gestion des groupes et association des ventes.

Le site lit directement :

- `data/sales.json`
- `data/groups.json`
- `data/meta.json`

Les actions qui modifient les données passent par le serveur Node.js. Le site demande l'URL de l'API et la clé admin dans l'interface, puis les garde dans `localStorage`.
