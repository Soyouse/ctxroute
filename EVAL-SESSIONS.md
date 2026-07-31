# Journal d'évaluation du framework d'injection (mcp-doc-hooks)

> **But** : tracer, session après session, comment le framework se comporte EN USAGE RÉEL — pas en test.
> Preuve par usage (doctrine du mainteneur) : on n'organise JAMAIS de spawn/test forcé pour « valider » l'injection ;
> on va au travail et on note ce qui s'est déclenché, ce qui a manqué, ce qui a sur-déclenché.
> Chaque entrée = une session choisie. Sert à repérer les défauts récurrents → ouvrir un backlog quand un
> même symptôme revient (un défaut vu 1× = noté ; vu 2× = gate/chantier).

## Grille par session (copier pour chaque nouvelle entrée)
- **Injecté au bon moment** (docs vues se déclencher sur les bons fichiers/outils)
- **Réinjection à jour** (docs modifiées EN session qui reviennent à jour ensuite)
- **Faux positifs** (doc déclenchée hors périmètre — distinguer *nuisible* [autre projet] de *lié* [même sujet])
- **Oublis** (un endroit où une doc AURAIT dû s'injecter et ne l'a pas fait)
- **Défaut structurel** (bug du framework lui-même)
- **Verdict**

---

## 2026-07-20 → 21 · onboarding 1er client payant + durcissement moteur

**Injecté au bon moment** — RAS, couverture complète observée :
`gworkspace` (chaque appel MCP), `browser` (chaque navigate), `odoo`, `agent-social-charte` (touche `charte.json`),
`agent-social-pipeline` (`brain.mjs`), `agent-social-testing` (`*.test.mjs`), `agent-social-footage-sync`,
`gworkspace-proxy` (`proxy.js`), `web-recherche` (WebFetch/WebSearch), `pw-mcp-proxy`, `mcp-doc-hooks/*`.

**Réinjection à jour — PROUVÉE (le cycle écrire→réinjecter marche)** : 3 docs modifiées en cours de session
sont revenues à jour ensuite — règle « Forms = compte perso » + jeton-court dans `gworkspace`, 403 Cloudflare
dans `web-recherche`. Et un fichier de doc CRÉÉ en session (`agent-social-capabilities.md`) s'est injecté
**immédiatement** au commit suivant. Le framework prend le neuf sans redémarrage.

**Faux positifs — 1, LIÉ (pas nuisible), jugé VOULU par le mainteneur** : `agent-social-charte`/`-pipeline` se déclenchent
quand leur nom apparaît dans un MESSAGE de commit, sans que le fichier soit touché (sémantique substring sur
tous les params concaténés). Verdict du mainteneur 21/07 : « c'est voulu, c'est même bon signe, la doc arrive quand le
sujet est évoqué ». **On ne corrige pas.** Distinction actée : un faux positif *nuisible* = doc d'un AUTRE projet
qui s'injecte (jamais observé) ; un déclenchement *lié* = même sujet = bénéfique.

**Oublis — 0** sur l'injection granulaire.

**Défaut structurel — 1, RÉEL (« le bug 2ko »)** : le SKILL `agent-social` fait **53 KB**. Il ne s'injecte pas
par périmètre (tronqué) → chargé à la main en début de session. Viole sa propre règle de brièveté (progressive
disclosure : réinjecté = court, détail on-demand). **À SCINDER** : tier-1 court injecté + le reste en
`*-reference.md` on-demand. C'est le seul chantier framework restant. (Distinct des docs `.claude/hooks/docs/*`
qui sont, elles, courtes et parfaites.)

**Micro-trou comblé en session** : `glue/capabilities.mjs` (fichier de code neuf) créé sans doc → doc posée
(`agent-social-capabilities.md`, scope défensif pour éviter l'injection croisée d'un homonyme).

**Verdict** : injection GRANULAIRE = état de l'art, aucune régression. Seul point noir = le skill trop gros,
qui n'est pas un défaut d'injection mais un défaut de RÉDACTION du skill (trop long pour être un contexte).
Chantier unique : scinder le skill. Le reste tourne.

## 2026-07-24 — session agent-social (pilier + rapport + murs prod)
- Injection: docs pipeline/testing/runtime/marque-resolve/config-gate injectées au bon moment toute la session (dizaines de déclenchements pertinents, zéro faux positif observé). Nouvelle doc agent-social-rapport.md auto-injectée dès le 1er accès à rapport.mjs (preuve par usage).
- Valeur mesurée: la doc testing a guidé stryker sandbox/testFiles; la doc runtime a rappelé le mur callBrain au moment du câblage pilier.


## 2026-07-29 — session moteur vidéo (montée de version + gates)
- **Injection** : docs moteur/worker/tests/charte injectées au bon moment toute la session, zéro faux positif.
  Preuve par usage : la doc worker a rappelé « code BAKÉ ⇒ rebuild obligatoire » juste avant un rebuild oublié ;
  la doc testing a rappelé la contrainte sandbox Stryker au moment d'écrire un test lisant hors du dossier.
- **Doc trop LOURDE réinjectée** : une doc moteur pèse **8,8 Ko / 22 lignes** en `mode: dumb` avec des `match`
  larges ⇒ réinjectée à presque chaque outil d'une session dense. Elle viole la règle des ~10 lignes : elle
  contient un RÉCIT (scènes d'une démo, liste de bruitages, numéros d'assets) au lieu d'invariants seuls.
  Passée en `smart` + `threshold: 5` en attendant. ⚠️ **Compromis assumé, PAS la règle** : la doctrine dit
  « garde-fou → dumb », et cette doc EN EST un. La vraie correction reste de la SCINDER (tier-1 court
  réinjecté + `*-reference.md` on-demand). Même classe que le skill trop gros déjà noté plus haut :
  le défaut n'est pas l'injection, c'est la RÉDACTION.

### 🔴 DÉFAUT DE VALIDATION TROUVÉ — combinaisons de cadence incohérentes acceptées EN SILENCE
`threshold: N` posé avec `mode: dumb` (ou `once`) est **ignoré sans le moindre avertissement** : `gate.js`
ne consomme le compteur que hors de `dumb`. L'auteur croit avoir réglé la cadence ; **rien ne change**.
`validate()` vérifie aujourd'hui chaque clé ISOLÉMENT (mode ∈ MODES, threshold entier ≥ 1) mais **aucune
COHÉRENCE ENTRE CLÉS**.
- Vécu en session : la combinaison a été posée, le linter est resté vert, et l'erreur n'a été vue qu'en
  RELISANT `gate.js` — parce qu'une question a été posée. Sans ça, elle serait partie en prod comme un
  réglage « appliqué » qui n'existe pas. C'est la classe de défaut la plus coûteuse : **la config morte muette**.
- Même famille probable (à inventorier, ne PAS se limiter à ce cas) : `driftUnit` hors de `smart` (dégénéré
  par contrat, donc mort), `threshold` sur une entrée `once`, et toute clé dont la sémantique dépend d'une autre.
- ⏭️ **CHANTIER = SESSION DÉDIÉE** (pas un patch au fil de l'eau) : établir la MATRICE complète des
  combinaisons clé×clé, décider pour chacune error/warn, puis l'implémenter dans `validate()` — SOURCE
  UNIQUE du jugement, le lint DÉLÈGUE (ne jamais poser un 2ᵉ juge). Négative-check obligatoire par
  combinaison : un gate de cohérence qui ne peut pas rougir ne vaut rien.
- ⚠️ **Arbitrage de sûreté à trancher dans cette session** : `error` dans `validate()` peut RENDRE UNE DOC
  INVALIDE, donc la priver d'injection — un durcissement qui COUPE un garde-fou est pire que le défaut.
  Piste : `warn` bruyant côté lint (diagnostic, exit≠0) plutôt que rejet côté chargement.

## 2026-07-31 — session « backlog des faux verts » (chantier SUR le framework, agents en parallèle)
- **Contexte** : d'autres agents utilisaient le framework pendant tout le chantier. Travail fait dans
  un `git worktree` isolé, dossier live laissé sur `master` ; bascule finale par `merge --ff-only`.
- **Injection** : les docs `porte.md`/`sources.md`/`lint.md`/`quality-configs.md` sont arrivées au bon
  moment tout du long. **Valeur mesurée, 2 fois** : (a) `quality-configs.md` a rappelé « un test passant
  par un RE-EXPORT n'est pas mappé par perTest » — c'était EXACTEMENT le dernier mutant survivant, tué
  en 1 test ; (b) `gitignore.md` a évité d'écrire un gate exigeant des fichiers gitignorés.
- **Preuve par usage immédiate** : la doc corrigée à la bascule s'est réinjectée dans le tour suivant.
- **Défaut de terrain relevé (§20/07, NON traité)** : mesuré par différentiel réel, le skill injecté
  pèse **80 Ko** et une doc fichier **50 Ko**. La troncature silencieuse frappe donc DÉJÀ en prod —
  ce n'est plus une hypothèse. ⚠️ Chercher le seuil dans la DOC OFFICIELLE du harnais, pas en
  rétro-ingénierie.
- **Méthode qui a payé** : mesurer AVANT de toucher (0 doc du parc portait `mcp:` ⇒ durcissement sans
  risque), et comparer ANCIEN vs NOUVEAU sur le parc RÉEL plutôt que de raisonner sur les tests seuls
  (mêmes 2 docs mortes des deux côtés ⇒ preuve que la régression n'existait pas).
