# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Matchs du jour — appli Samsung TV (Tizen)

Petite appli pour télé Samsung qui affiche **les matchs du jour** avec **l'heure** et **la chaîne de diffusion** (ex. `PSG – OM · 21:00 · Canal+`).

C'est uniquement de l'**affichage**. L'appli ne lit aucun flux vidéo et ne lance aucune chaîne.

---

## Contexte matériel

- **Télé :** Samsung **TU50CU8510KXXC** (Crystal UHD CU8500, 2023).
- **OS :** Tizen **7.0**, ou **8.0** si la mise à jour firmware est passée. Coder pour être compatible avec les deux.
- **IP de la télé :** `192.168.1.50` (réseau local, peut changer).
- **Mode développeur :** activé, avec Host PC IP = IP du PC de dev.
- **Résolution cible :** 1920×1080.
- **Navigation :** télécommande uniquement (flèches, OK, Retour). Pas de souris, pas de clavier.

---

## Stack et format

- **Appli web Tizen** packagée en **`.wgt`** : HTML + CSS + JavaScript **vanilla**.
- **Pas de framework lourd** (React, etc.). Le navigateur de la télé est lent.
- **Pas d'étape de build obligatoire** pour l'appli. Le code dans `app/` doit tourner tel quel.
- **Node.js** sert uniquement aux tests et aux scripts de dev.

---

## Structure du projet

```
app/
  config.xml          # manifeste Tizen (id, privilèges, accès réseau)
  index.html
  css/style.css
  js/
    main.js           # démarrage, rafraîchissement, gestion de la télécommande
    render.js         # affichage de la liste (DOM uniquement)
    matches.js        # logique pure : filtrer, trier, formater
    sources/
      index.js        # choix de la source de données
      <source>.js     # un fichier par source, même interface
  icon.png            # 117×117, rendu depuis assets/logo.svg (ballon dans une télé)
pipeline/             # job GitHub Actions (Node), jamais embarqué dans le .wgt
  build.js            # orchestration : API + guide TV → dist/matchs.json (seul fichier avec effets de bord)
  footballData.js     # réponse football-data.org → modèle interne
  xmltv.js            # lecture du guide XMLTV
  channels.js         # association match ↔ programme TV (fenêtre horaire, noms, alias)
  dates.js            # dates Europe/Paris
.github/workflows/update.yml   # toutes les 30 min : tests, build, déploiement GitHub Pages
tests/
  matches.test.js
  pipeline/*.test.js
  sources/*.test.js   # tests sur des fixtures, jamais sur le réseau
  fixtures/           # extraits réels de l'API et du guide du 21/10/2026
package.json          # "type": "module", scripts "test" et "build", aucune dépendance
```

- `npm run build` génère `dist/matchs.json` en local (lit la clé dans `.env`). Le guide TV est mis en cache dans `.cache/` pour la journée.
- Publié sur `https://achachziad.github.io/MatchAppSamsung/matchs.json` (`{ generatedAt, matches }`).
- Une équipe du guide non reconnue → ajouter un alias dans `ALIASES` (`pipeline/channels.js`), avec un test.

---

## Modèle de données (interne)

Chaque source doit renvoyer une liste d'objets de cette forme :

```js
{
  id: "string",
  sport: "football",
  competition: "Ligue 1",
  home: "PSG",
  away: "OM",
  kickoff: "2026-10-21T19:00:00Z", // ISO 8601, toujours en UTC
  channels: ["Canal+"],            // [] si inconnu
  status: "scheduled",             // "scheduled" | "live" | "finished" | "postponed" (reporté, suspendu, annulé)
  score: null                      // { home: 2, away: 1 } si connu, sinon null
}
```

- L'affichage se fait en heure **Europe/Paris**.
- Si la chaîne est inconnue, afficher **« Chaîne non communiquée »**. Ne jamais inventer une chaîne.

---

## Source de données — DÉCIDÉE

Aucune API gratuite ne donne la chaîne française. On combine deux sources **hors de la télé**, dans un job GitHub Actions planifié :

```
GitHub Actions (toutes les 30 min, 9h–23h30 UTC ; guide TV téléchargé 1×/jour grâce au cache)
  1. football-data.org (API v4, header X-Auth-Token) → matchs, statut, score
     Compétitions : WC, EC, FL1, CL, PL, PD (LaLiga), BL1 — toutes dans le plan gratuit (10 req/min)
     Europa League (EL) : HORS plan gratuit (HTTP 403, vérifié le 22/10/2026)
  2. xmltvfr.fr → https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz (guide « France », ~9 Mo, 5 jours, MAJ quotidienne)
  3. association match ↔ programme TV → channels
  4. publie matchs.json sur GitHub Pages
Télé : lit uniquement matchs.json
```

- **Clé API** : dans `.env` à la racine (ignoré par git, variable `FOOTBALL_DATA_TOKEN`), et en secret GitHub Actions du même nom. **Jamais** dans `app/` : la télé n'a pas besoin de la clé.
- xmltvfr.fr est un service bénévole sans CGU affichées : **un seul téléchargement par jour**, version compressée uniquement.
- L'appli garde l'interface `sources/` : une source `githubPages.js` lit `matchs.json`. Changer de source = changer une ligne dans `sources/index.js`. Une source expose `fetchMatches()` qui renvoie `{ generatedAt, matches }`.

### Scripts de l'appli : pas de modules ES

- Le `.wgt` est chargé depuis le système de fichiers de la télé, et je n'ai pas vérifié que `<script type="module">` y fonctionne (Chromium bloque les modules en `file://`). Les fichiers de `app/js/` sont donc des **scripts classiques** qui exposent un objet global (`globalThis.Matches`, `globalThis.Source`…), chargés dans l'ordre par `index.html`.
- Les tests les chargent avec `tests/helpers/loadAppScript.js` (`vm.runInThisContext`).
- Syntaxe : rester sur ce que supporte un Chromium ~M90 (Tizen 7). `?.` et `??` sont permis ; pas de `Object.groupBy`, `Array.prototype.findLast` ni `structuredClone`.

### Format du guide XMLTV (constaté le 21/10/2026)

- `<programme start="20261021210000 +0200" channel="CanalPlusFoot.fr">` : heure locale avec décalage, qui passe à `+0100` au changement d'heure.
- Le nom affiché vient de `<channel id="…"><display-name>` (ex. `CanalPlusLive4.fr` → « Canal+ Live 4 »).
- Titres de match, selon la chaîne :
  - Canal+ (Canal+, Foot, Sport, Premier League, Live N) : titre `Domicile / Extérieur`, sous-titre `Ligue des champions - 3e journée` ou `Premier League - 8e journée`, catégorie `Football`.
  - DAZN : titre `Domicile / Extérieur`, sous-titre `Football. Liga 10e journée.` ou `Football. Ligue 1 McDonald's 8e journée.`.
  - Ligue 1+ et beIN : titre `Football : Ligue 1 McDonald's | Domicile / Extérieur` ou `Football : Bundesliga | Domicile / Extérieur`.
- **Noms d'équipes en français**, différents de l'API : Côme, Bayern Munich, Chakhtior Donetsk, Betis Séville, Sporting Club Portugal, Leipzig… Il faut normaliser (accents, casse) et prévoir une table d'alias.
- **Rediffusions nombreuses** : ne garder que les programmes qui commencent entre 75 min avant (Ligue 1+ démarre ~1 h avant, avant-match inclus) et 10 min après le coup d'envoi. Ignorer les « Match d'archives ».
- **Chaînes parasites** dans le guide « France » (« La chaine du Père Noël », Club RTL, « Evenements Sports 4K UHD ») : seule une liste blanche de diffuseurs est gardée (`BROADCASTER` dans `pipeline/channels.js`).
- **API football-data.org : `dateTo` est exclusif** (vérifié), contrairement à ce que suggère la doc.
- Les exécutions planifiées GitHub peuvent être retardées ou sautées. Si c'est trop irrégulier : déclencher `workflow_dispatch` depuis un cron externe (ex. cron-job.org) avec un token limité au repo.
- Un même match peut être sur plusieurs chaînes (ex. Canal+ Sport et Canal+ Live 3) : garder toutes les chaînes.
- Certains matchs n'y figurent pas (ex. LaLiga sur Disney+) : alors `channels: []`.
- Ignorer `Multiplex`, `Plateau avant-match`, la Youth League, la Bundesliga 2 et les magazines.

---

## Comportement attendu

- Au lancement : afficher les matchs **d'aujourd'hui** puis ceux **de demain** (deux sections), triés par heure. Pas de navigation vers d'autres jours.
- Les matchs **terminés** affichent le **score en gros** à la place de l'heure, avec la mention « Terminé ». L'utilisateur a une mauvaise vue : le grisé seul ne suffit pas.
- **Rafraîchissement** au lancement, puis toutes les **30 minutes**.
- **Cache** du dernier résultat dans `localStorage`, avec chaque lecture et écriture dans un `try/catch`. Si le réseau échoue, afficher le cache avec la mention « Données du JJ/MM HH:MM ».
- **Écran vide** : afficher « Aucun match aujourd'hui ».
- **Erreur** : afficher un message clair, jamais d'écran blanc.

### Télécommande

- **Haut / Bas** : déplacer le focus d'un match à l'autre. Le focus doit être **très visible**.
- **Retour** (keyCode `10009`) : quitter l'appli avec `tizen.application.getCurrentApplication().exit()`.
- Les touches de couleur ne sont actives que si elles sont enregistrées via `tizen.tvinputdevice.registerKey()` (privilège requis).
- Prévoir un repli quand `tizen` n'existe pas, pour pouvoir tester dans un navigateur de PC.

### Interface (inspirée de FotMob, adaptée télécommande)

- Fond sombre, matchs **groupés par compétition** (un bloc par compétition, avec un en-tête).
- Une ligne par match : `Domicile · heure · Extérieur`, centrée, avec la chaîne sur la même ligne ou juste en dessous.
- Un match après minuit (heure de Paris) affiche **« +1 jour »** au-dessus de l'heure. Règle : la « journée » va de 04h00 à 04h00 (Paris) ; un match entre 00h00 et 04h00 reste dans la soirée de la veille, avec « +1 jour ».
- Pas de barre latérale ni de boutons de filtre (inutilisables à la télécommande). Une seule colonne, que l'on fait défiler avec Haut / Bas.

### Lisibilité TV — utilisateur malvoyant, regardé de loin (contrainte prioritaire)

L'appli est utilisée par une personne **malvoyante**, à distance de la télé. En cas de conflit avec l'esthétique ou la densité d'information, **la lisibilité gagne**.

- **Tailles (en px, base 1920×1080)** : rien sous **40 px** ; chaînes et mentions ≥ 44 ; équipes ≥ 64 ; heure et score ≥ 80. Police sans-serif, **graisse 600 à 800**, jamais de texte fin ou en italique.
- **Peu de matchs à l'écran** (environ 4 ou 5) plutôt que beaucoup de petits.
- **Contraste maximal** : blanc pur sur fond quasi noir (ratio ≥ 7:1). Pas de gris clair sur gris foncé pour une info utile.
- **Ne jamais coder une info par la couleur seule** : toujours un mot (« Terminé », « En direct », « Reporté »).
- **Focus énorme** : bordure jaune épaisse (≥ 8 px) et fond plus clair, visible sans hésitation.
- Pas d'animation ni de défilement automatique. Noms trop longs : coupés avec « … », jamais rétrécis.
- Marges de sécurité d'environ 5 % sur les bords de l'écran.

---

## config.xml — points obligatoires

- Privilège `http://tizen.org/privilege/internet`.
- Privilège `http://tizen.org/privilege/tv.inputdevice` (si on utilise les touches de couleur).
- `<access origin="..." subdomains="true"/>` limité aux **domaines réellement utilisés** par la source, pas `*`.
- Un `id` et un `package` uniques. Ne pas les changer entre deux versions, sinon la mise à jour échoue.

---

## Règles de travail pour Claude

1. **Demander le contexte manquant avant de coder** : sports et compétitions voulus, source de données. Ne pas deviner.
2. **TDD** pour toute la logique pure (`matches.js`, parsing des sources) : écrire le test d'abord, puis le code.
   - Tests avec **`node:test`** + `node:assert/strict` (intégrés à Node, pas de dépendance), sur des **fixtures** dans `tests/fixtures/`. **Jamais d'appel réseau** dans les tests.
   - Cas à couvrir : fuseau horaire et changement d'heure, match à cheval sur minuit, chaîne absente, réponse vide, réponse malformée.
3. **Ne jamais inventer** une API, un endpoint ou une fonction Tizen. En cas de doute, le dire et vérifier dans la doc Samsung.
4. **Changements minimaux** : ne pas réécrire ce qui marche.
5. Le code **DOM et télécommande** ne se teste pas en unitaire. Le vérifier dans un navigateur de PC, puis sur la télé.

---

## Commandes

```bash
npm test                                  # lance les tests (node --test, aucune dépendance)
node --test tests/matches.test.js         # un seul fichier de test
node --test --test-name-pattern="minuit"  # tests dont le nom contient « minuit »
npx serve app        # aperçu dans le navigateur du PC (optionnel)
```

---

## Déploiement sur la télé

**Option 1 — Apps2Samsung (méthode utilisée par l'utilisateur)**

1. Zipper le **contenu** de `app/` (pas le dossier lui-même) et renommer en `matchs-du-jour.wgt`. Sous Windows, utiliser `tar` (pas `Compress-Archive` de PowerShell 5.1, qui écrit des `\` dans les chemins du zip) :
   ```powershell
   tar -a -cf matchs-du-jour.zip -C app * ; Rename-Item matchs-du-jour.zip matchs-du-jour.wgt
   ```
   Incrémenter `version` dans `config.xml` à chaque nouvelle installation.
2. Dans Apps2Samsung : ⚙️ → **Force Samsung Certificate** + **Partner Signing**.
3. **Custom WGT File** → choisir le `.wgt` → **Installer**.

**Option 2 — Tizen CLI (si Tizen Studio est installé)**

```bash
sdb connect 192.168.1.50
tizen package -t wgt -s <profil_certificat> -- app
tizen install -n app/matchs-du-jour.wgt -t <nom_appareil>
```

- Utiliser `tizen install`, pas `sdb install`.
- Si l'erreur « author certificate mismatch » apparaît : désinstaller l'ancienne version d'abord.

---

## Limites connues (ne pas promettre plus)

- **Pas de widget** sur l'écran d'accueil Samsung : c'est une appli à ouvrir.
- Ouverture automatique au démarrage : seulement via le réglage télé « Exécuter automatiquement la dernière application », **absent sur certains firmwares**.
- Une mise à jour firmware peut obliger à **réinstaller** l'appli avec un nouveau certificat.

---

## À compléter avec l'utilisateur

- [x] Sports et compétitions à afficher : **football uniquement** — Coupe du monde, Euro, Ligue 1, Ligue des champions, Premier League, LaLiga, Bundesliga. Rien d'autre (pas de MLS, etc.). Europa League voulue mais hors plan gratuit : décision en attente. Une compétition sans match n'apparaît pas.
- [ ] Équipes favorites à mettre en avant : …
- [x] Source de données choisie : football-data.org + guide XMLTV xmltvfr.fr, via GitHub Actions → `matchs.json` sur GitHub Pages (voir « Source de données »).
- [x] Matchs terminés : afficher le score en gros + « Terminé » (voir « Comportement attendu »).