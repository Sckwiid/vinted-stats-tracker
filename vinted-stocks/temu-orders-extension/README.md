# Temu Orders Exporter

Extension Chrome Manifest V3 pour exporter les articles visibles depuis une page commandes Temu.

## Installation locale

1. Ouvre `chrome://extensions`.
2. Active `Mode developpeur`.
3. Clique `Charger l'extension non empaquetee`.
4. Selectionne ce dossier:

```text
temu-orders-extension
```

## Utilisation

1. Va sur la page commandes Temu.
2. Fais charger les commandes que tu veux exporter.
3. Clique sur l'extension.
4. Clique `Scanner commandes Temu`.
5. Importe le fichier `temu-orders-YYYY-MM-DD.json` dans le site via `Modifier les stocks > Importer commandes Temu`.

## Format exporte

```json
{
  "source": "temu-orders-extension",
  "schemaVersion": 1,
  "exportedAt": "2026-06-13T12:00:00.000Z",
  "pageUrl": "https://www.temu.com/...",
  "items": [
    {
      "title": "Nom produit",
      "purchasePrice": 1.76,
      "quantity": 2,
      "imageUrl": "https://...",
      "productUrl": "https://www.temu.com/...",
      "orderPageUrl": "https://www.temu.com/bg_order_detail.html?...",
      "orderId": "OPTIONNEL",
      "orderDate": "OPTIONNEL",
      "variant": "rose / Taille de l'etiquette: M",
      "color": "rose",
      "importKey": "cle-stable",
      "currency": "EUR"
    }
  ]
}
```

## Notes

- L'extension ne contacte aucun serveur externe.
- Elle lit seulement la page active quand tu cliques sur le bouton.
- Si Temu change son HTML, il faudra peut-etre ajuster `content-scan.js`.
