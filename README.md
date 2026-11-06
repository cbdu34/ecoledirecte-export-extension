# Export EcoleDirecte pour l'IA

Extension Chrome (Manifest V3) qui exporte en un clic les données d'un compte élève EcoleDirecte dans un seul fichier JSON structuré, prêt à être donné à une IA.

## Ce que fait l'extension

- Récupère les **notes** : matière, note, barème, note ramenée sur 20, coefficient, intitulé, date, période, moyenne de classe, notes min/max.
- Récupère les **devoirs** du cahier de textes : date limite, matière, description complète (texte + HTML), statut `fait` / `à faire`, date de donnée, pièces jointes (noms uniquement).
- Récupère la **boîte de réception** : date, expéditeur, sujet, contenu textuel, pièces jointes (noms uniquement).
- Récupère les **espaces de travail** : nom, description, type, appartenance, arborescence des dossiers et **noms des fichiers**. Aucun fichier n'est téléchargé.
- Télécharge automatiquement `export_ecoledirecte.json` dans le dossier de téléchargements de Chrome.

L'extension utilise la session EcoleDirecte déjà ouverte dans le navigateur. Elle ne demande ni ne stocke le mot de passe.

## Installation en 2 minutes

> Compatible avec **Chrome, Edge, Brave et Opera** (navigateurs Chromium). Firefox n'est pas pris en charge.

### Étape 1 — Télécharger l'extension (30 secondes)

1. Aller sur la page GitHub du projet :
   **https://github.com/cbdu34/ecoledirecte-export-extension**
2. Cliquer sur le bouton vert **`<> Code`** puis sur **`Download ZIP`**.
3. Ouvrir le fichier ZIP téléchargé et **l'extraire** :
   - Windows : clic droit sur le ZIP → **Extraire tout…**
   - macOS : double-clic sur le ZIP
   - Linux : clic droit → **Extraire ici**
4. Un dossier nommé `ecoledirecte-export-extension-main` apparaît. **Ne pas supprimer ce dossier** : l'extension en a besoin pour fonctionner, même après l'installation.

> ⚠️ Il faut sélectionner le **dossier extrait**, pas le fichier ZIP.

### Étape 2 — Charger l'extension dans Chrome (30 secondes)

1. Ouvrir un nouvel onglet et taper dans la barre d'adresse :
   ```
   chrome://extensions
   ```
   (Sur Edge : `edge://extensions`. Sur Brave : `brave://extensions`.)
2. En haut à droite, activer l'interrupteur **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Dans la fenêtre qui s'ouvre, sélectionner le dossier **`ecoledirecte-export-extension-main`** (celui qui contient directement le fichier `manifest.json`), puis valider.

La carte « Export EcoleDirecte pour l'IA » doit apparaître dans la liste.

> Si Chrome affiche « Fichier manifest introuvable » : vous avez sélectionné le ZIP ou le dossier parent. Recommencez en ouvrant le dossier extrait jusqu'à voir `manifest.json`, puis sélectionnez ce dossier.

### Étape 3 — Épingler l'extension (10 secondes)

1. Cliquer sur l'icône **puzzle** 🧩 à droite de la barre d'adresse.
2. Cliquer sur l'épingle à côté de **Export EcoleDirecte pour l'IA**.

L'icône de l'extension apparaît maintenant en permanence dans la barre d'outils.

### Étape 4 — Recharger EcoleDirecte (10 secondes)

1. Ouvrir **https://www.ecoledirecte.com** et se connecter normalement (identifiant + mot de passe, comme d'habitude).
2. Une fois connecté, **recharger la page** avec `F5` ou `Ctrl+R` (`Cmd+R` sur Mac).

> Cette étape est indispensable après l'installation : elle permet à l'extension de récupérer la session EcoleDirecte déjà ouverte. L'extension ne demande jamais le mot de passe.

### Étape 5 — Lancer l'export (30 secondes)

1. Rester sur **n'importe quelle page EcoleDirecte** (accueil, notes, cahier de textes…).
2. Cliquer sur l'icône de l'extension dans la barre d'outils.
3. Vérifier que le popup affiche :
   - le **nom de l'élève** ;
   - l'**établissement** et la **classe** ;
   - le badge vert **« Session active »**.
4. Cliquer sur **« Exporter mes données pour l'IA »**.
5. Attendre la fin de la barre de progression. Le fichier **`export_ecoledirecte.json`** est téléchargé automatiquement dans le dossier **Téléchargements**.

L'export prend généralement **20 à 60 secondes** : l'extension interroge EcoleDirecte pour chaque journée de devoirs, chaque message et chaque espace de travail.

### Vérification rapide

L'installation est réussie si :

- ✅ l'icône de l'extension est visible dans la barre d'outils ;
- ✅ le popup affiche le nom de l'élève et le badge **« Session active »** ;
- ✅ le bouton d'export est cliquable ;
- ✅ le fichier `export_ecoledirecte.json` apparaît dans les téléchargements.

### Si le bouton est grisé

Le bouton ne fonctionne que sur un onglet EcoleDirecte. Ouvrir `https://www.ecoledirecte.com`, se connecter, puis rouvrir le popup.

### Si le nom de l'élève n'apparaît pas

Recharger la page EcoleDirecte (`F5`), attendre 2 secondes, puis rouvrir le popup.

### Après un redémarrage de Chrome

L'extension reste installée. Si Chrome affiche un message demandant de désactiver les extensions en mode développeur, cliquer sur **Conserver**. Ne pas déplacer ni supprimer le dossier `ecoledirecte-export-extension-main`.

## Structure du fichier JSON

Le fichier contient exactement cinq catégories principales :

```json
{
  "eleve": {
    "id": 1234,
    "nom": "PRÉNOM NOM",
    "etablissement": "Nom de l'établissement",
    "classe": "5 eme A",
    "code_classe": "5A",
    "exporte_le": "2026-11-06T18:00:00.000Z",
    "source": "EcoleDirecte",
    "format_version": "1.0.0",
    "avertissements": []
  },
  "notes": [
    {
      "id": 123,
      "matiere": "FRANCAIS",
      "note": "18",
      "bareme": 20,
      "note_sur_20": 18,
      "coefficient": 1,
      "intitule": "Évaluation de lecture",
      "date": "2026-09-17",
      "periode": "1er Semestre",
      "code_periode": "A001",
      "type": null,
      "commentaire": null,
      "en_lettre": false,
      "non_significatif": false,
      "moyenne_classe": 15.83,
      "note_min_classe": 9,
      "note_max_classe": 19
    }
  ],
  "devoirs": [
    {
      "id": 456,
      "date_limite": "2026-11-09",
      "matiere": "FRANCAIS",
      "description": "Faire les questions...",
      "description_html": "<p>Faire les questions...</p>",
      "statut": "à faire",
      "effectue": false,
      "a_faire": true,
      "donne_le": "2026-11-05",
      "interrogation": false,
      "rendre_en_ligne": false,
      "documents_a_faire": false,
      "pieces_jointes": ["document.pdf"],
      "tags": [],
      "detail_disponible": true
    }
  ],
  "messages": [
    {
      "id": 789,
      "date": "2026-11-05 14:44:26",
      "expediteur": "Mme DUPONT A.",
      "sujet": "Sortie scolaire du 12 mars",
      "contenu": "Bonjour,\n\nvoici les informations...",
      "contenu_html": "<p>Bonjour,...</p>",
      "lu": true,
      "boite": "reception",
      "pieces_jointes": [],
      "contenu_disponible": true
    }
  ],
  "espace_de_travail": [
    {
      "id": 42,
      "nom": "ESPACE FRANCAIS",
      "description": "Documents et ressources de la classe",
      "type": "LIBRE",
      "membre": true,
      "admin": false,
      "acces_ouvert": false,
      "cloud": true,
      "arborescence_disponible": true,
      "nb_dossiers": 1,
      "nb_fichiers": 3,
      "arborescence": [
        {
          "type": "dossier",
          "nom": "Chapitre 1",
          "enfants": [
            { "type": "fichier", "nom": "cours.pdf" }
          ]
        },
        { "type": "fichier", "nom": "consignes.docx" }
      ]
    }
  ]
}
```

Les champs `contenu_html` et `description_html` sont fournis en complément du texte pour conserver la mise en forme. Les images intégrées dans les messages sont supprimées afin de ne pas gonfler le fichier.

## Confidentialité et permissions

L'extension fonctionne localement et n'envoie les données à aucun serveur autre que l'API EcoleDirecte elle-même.

Permissions demandées :

- `activeTab` : lire l'onglet EcoleDirecte actif au moment où vous cliquez sur l'extension.
- `downloads` : télécharger le fichier JSON.
- `storage` : conserver temporairement le jeton de session et l'état de l'export dans `chrome.storage.session`. Ces données sont effacées à la fermeture de Chrome.
- `webRequest` : lire l'en-tête `X-Token` des requêtes EcoleDirecte pour réutiliser la session déjà ouverte. Aucune requête n'est modifiée ni bloquée.

Accès réseau limité à `https://*.ecoledirecte.com/*`.

## Points importants

- **Messages marqués comme lus** : pour récupérer le contenu textuel, l'extension ouvre chaque message de la boîte de réception. Ils peuvent apparaître comme lus dans EcoleDirecte.
- **Session** : si EcoleDirecte vous déconnecte ou si le jeton expire, l'extension recharge la page et réessaie une fois. En cas d'échec, reconnectez-vous puis relancez l'export.
- **Page à recharger après installation** : si le nom de l'élève n'est pas détecté, rechargez l'onglet EcoleDirecte.
- **Aucun fichier téléchargé depuis les espaces de travail** : seuls les noms des fichiers et l'arborescence des dossiers sont exportés.
- **Données personnelles** : le fichier contient des notes, des messages et des informations d'identification. Ne le partagez qu'avec une IA ou un service de confiance, et supprimez-le lorsque vous n'en avez plus besoin.

## Dépannage

| Problème | Solution |
| --- | --- |
| « Fichier manifest introuvable » | Vous avez sélectionné le ZIP ou le dossier parent. Sélectionner le dossier extrait qui contient directement `manifest.json`. |
| Le bouton d'export est grisé | Ouvrir une page `https://www.ecoledirecte.com/...` après connexion, puis rouvrir le popup. |
| « EcoleDirecte non détecté » | Ouvrir une page `https://www.ecoledirecte.com/...` après connexion, puis rouvrir le popup. |
| Le nom de l'élève n'apparaît pas | Recharger la page EcoleDirecte (`F5`) pour injecter le content script. |
| « Jeton EcoleDirecte introuvable » | Vérifier que la session est active, recharger la page, puis réessayer. |
| « La session EcoleDirecte a expiré » | Se reconnecter à EcoleDirecte, recharger la page, puis relancer l'export. |
| L'export reste bloqué | Fermer et rouvrir le popup : l'état de l'export est conservé. Si l'export a été interrompu, relancer. |
| Le téléchargement ne démarre pas | Vérifier les autorisations de téléchargement de Chrome et l'espace disque disponible. |
| Chrome demande de désactiver l'extension au démarrage | Cliquer sur **Conserver**. C'est normal pour une extension chargée manuellement. |
| L'extension a disparu après redémarrage | Le dossier de l'extension a été déplacé ou supprimé. Recharger l'extension depuis `chrome://extensions` en sélectionnant à nouveau le dossier extrait. |

## Développement

Fichiers principaux :

- `manifest.json` : configuration Manifest V3.
- `background.js` : service worker, capture du jeton, appels API, collecte et téléchargement.
- `lib/mapping.js` : fonctions pures de transformation des réponses API en JSON final (testables avec Node).
- `content.js` : lecture de l'identité de l'élève dans la page EcoleDirecte.
- `popup.html`, `popup.css`, `popup.js` : interface du popup.

Pour vérifier la syntaxe :

```bash
node --input-type=module --check < background.js
node --input-type=module --check < lib/mapping.js
node --input-type=module --check < popup.js
node --check content.js
```

L'extension n'utilise aucune dépendance externe et aucun script distant.
