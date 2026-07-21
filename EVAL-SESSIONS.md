# Journal d'évaluation du framework d'injection (mcp-doc-hooks)

> **But** : tracer, session après session, comment le framework se comporte EN USAGE RÉEL — pas en test.
> Preuve par usage (doctrine Théo) : on n'organise JAMAIS de spawn/test forcé pour « valider » l'injection ;
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

## 2026-07-20 → 21 · onboarding Netium (1er client payant) + durcissement moteur

**Injecté au bon moment** — RAS, couverture complète observée :
`gworkspace` (chaque appel MCP), `browser` (chaque navigate), `odoo`, `agent-social-charte` (touche `charte.json`),
`agent-social-pipeline` (`brain.mjs`), `agent-social-testing` (`*.test.mjs`), `agent-social-footage-sync`,
`gworkspace-proxy` (`proxy.js`), `web-recherche` (WebFetch/WebSearch), `pw-mcp-proxy`, `mcp-doc-hooks/*`.

**Réinjection à jour — PROUVÉE (le cycle écrire→réinjecter marche)** : 3 docs modifiées en cours de session
sont revenues à jour ensuite — règle « Forms = compte perso » + jeton-court dans `gworkspace`, 403 Cloudflare
dans `web-recherche`. Et un fichier de doc CRÉÉ en session (`agent-social-capabilities.md`) s'est injecté
**immédiatement** au commit suivant. Le framework prend le neuf sans redémarrage.

**Faux positifs — 1, LIÉ (pas nuisible), jugé VOULU par Théo** : `agent-social-charte`/`-pipeline` se déclenchent
quand leur nom apparaît dans un MESSAGE de commit, sans que le fichier soit touché (sémantique substring sur
tous les params concaténés). Verdict Théo 21/07 : « c'est voulu, c'est même bon signe, la doc arrive quand le
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
