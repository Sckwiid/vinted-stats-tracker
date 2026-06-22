# Vinted Stocks (GitHub Pages + Firebase Functions)

Mini app statique pour gerer vos stocks Vinted a 3 utilisateurs:

- `anthony`
- `julien`
- `compte pro` ou `compte-pro`

Le site GitHub Pages ne contient pas de mot de passe, pas de hash et pas de config Firebase.
La sync passe par une Firebase Function qui garde les secrets cote serveur.

## Architecture

- GitHub Pages sert le frontend: `index.html`, `app.js`, `styles.css`, `config.js`.
- Firebase Functions expose une API HTTPS.
- Firebase Admin SDK ecrit/lit dans Realtime Database depuis la Function.
- Le frontend voit seulement `API_BASE_URL`, l'URL publique de la Function.

Endpoints de la Function:

- `POST /login`
- `GET /products`
- `PUT /products`
- `PUT /products/:id`
- `DELETE /products/:id`

## Setup Firebase Functions

Important: Firebase Functions demande le plan Blaze (pay-as-you-go).
Pour un petit usage perso, ca peut rester dans les quotas gratuits, mais Firebase exige quand meme un compte de facturation.
La Function est limitee a `maxInstances: 1` pour reduire le risque de cout en cas de spam.

### 1. Se connecter a Firebase CLI

Si tu avais deja copie `.firebaserc` avec `TON_PROJECT_ID_FIREBASE`, corrige-le ou supprime-le avant le login:

```bash
rm .firebaserc
```

```bash
npx firebase-tools@latest login
```

Ne fais pas `npm install -g firebase-tools` si ton Mac refuse l'acces a `/usr/local/lib/node_modules`.
`npx` lance Firebase CLI sans installation globale.

### 2. Lier le projet Firebase

Option simple: laisse Firebase CLI creer le fichier `.firebaserc`:

```bash
npx firebase-tools@latest use --add
```

Choisis ton projet Firebase, puis donne l'alias `default`.

Option manuelle: copie le fichier exemple:

```bash
cp .firebaserc.example .firebaserc
```

Puis remplace `ton-project-id-firebase` dans `.firebaserc` par ton `projectId`.
Le `projectId` doit etre en minuscules.

### 3. Activer Realtime Database

Dans Firebase Console:

1. Va dans `Realtime Database`.
2. Cree une base.
3. Copie l'URL de la base, par exemple:

```text
https://ton-project-id-default-rtdb.europe-west1.firebasedatabase.app
```

Tu peux fermer l'acces public avec ces regles, car seule la Firebase Function utilise l'Admin SDK:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

### 4. Mettre les secrets Functions

Depuis la racine du projet:

```bash
npx firebase-tools@latest functions:secrets:set ANTHONY_PASSWORD
npx firebase-tools@latest functions:secrets:set JULIEN_PASSWORD
npx firebase-tools@latest functions:secrets:set COMPTE_PRO_PASSWORD
npx firebase-tools@latest functions:secrets:set SESSION_SECRET
npx firebase-tools@latest functions:secrets:set DATABASE_URL
```

Valeurs attendues:

- `ANTHONY_PASSWORD`: mot de passe Anthony
- `JULIEN_PASSWORD`: mot de passe Julien
- `COMPTE_PRO_PASSWORD`: mot de passe Compte pro
- `SESSION_SECRET`: longue chaine aleatoire, par exemple 40+ caracteres
- `DATABASE_URL`: URL Realtime Database copiee a l'etape 3

### 5. Installer les dependances Functions

```bash
cd functions
npm install
cd ..
```

### 6. Deployer la Function

```bash
npx firebase-tools@latest deploy --only functions
```

Apres le deploy, Firebase affiche une URL du style:

```text
https://europe-west1-TON_PROJECT_ID.cloudfunctions.net/api
```

Garde cette URL: c'est ton `API_BASE_URL`.

## Setup GitHub Pages

Dans GitHub `Settings > Secrets and variables > Actions`, mets:

- `API_SYNC_ENABLED`: `true`
- `API_BASE_URL`: URL de ta Function, par exemple `https://europe-west1-TON_PROJECT_ID.cloudfunctions.net/api`

Tu peux supprimer les anciens secrets `FIREBASE_*` du repo GitHub: ils ne servent plus au frontend.

Ensuite:

1. Va dans `Settings > Pages`.
2. Mets `Source` sur `GitHub Actions`.
3. Va dans `Actions > Deploy static content to Pages`.
4. Lance `Run workflow`.
5. Ouvre `https://sckwiid.github.io/vinted-stocks/`.

Le badge doit afficher `Sync partage`.

## Verifier la config publique

Ouvre:

```text
https://sckwiid.github.io/vinted-stocks/config.js
```

Tu dois voir seulement:

- `provider: "api"`
- `enabled: true`
- `api.baseUrl: "https://...cloudfunctions.net/api"`

Tu ne dois pas voir:

- mot de passe
- hash
- `FIREBASE_API_KEY`
- `DATABASE_URL`
- service account

## Test local

Lancer le frontend:

```bash
python3 -m http.server 8080
```

Puis ouvrir:

```text
http://localhost:8080
```

Pour tester avec la Function deployee, mets temporairement dans `config.js`:

```js
sync: {
  provider: "api",
  enabled: true,
  api: {
    baseUrl: "https://europe-west1-TON_PROJECT_ID.cloudfunctions.net/api"
  }
}
```

Ne mets pas de secret dans `config.js`.

## Notes securite

Avec Firebase Functions:

- les mots de passe restent dans Firebase Secret Manager;
- `DATABASE_URL` reste cote Function;
- le frontend n'a qu'une URL publique d'API;
- les requetes stock utilisent un token de session signe cote Function.
- le endpoint `/login` est limite contre le bruteforce: 8 erreurs en 15 minutes bloquent IP + utilisateur pendant 15 minutes.

Si quelqu'un ouvre le code du site, il ne peut pas recuperer tes mots de passe ni les credentials Firebase serveur.
L'URL de la Function reste publique par definition, mais les endpoints stock refusent les requetes sans token valide.

## Si ca bloque

### Le site affiche `Sync local`

- Verifie que `API_SYNC_ENABLED=true` est bien dans GitHub Actions.
- Verifie que `API_BASE_URL` est bien rempli.
- Verifie que GitHub Pages utilise `Source: GitHub Actions`.
- Relance le workflow Pages.

### Le login est refuse

- Verifie les secrets `ANTHONY_PASSWORD`, `JULIEN_PASSWORD`, `COMPTE_PRO_PASSWORD`.
- Redeploie les Functions apres modification des secrets si Firebase le demande.

### Lecture/ecriture impossible

- Verifie que `DATABASE_URL` est exact.
- Verifie que Realtime Database existe.
- Lance:

```bash
npx firebase-tools@latest functions:log
```
