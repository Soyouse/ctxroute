---
rules: [{"pattern":"loader.js","scope":["mcp-doc-hooks"]},{"pattern":"loader.test.js","scope":["mcp-doc-hooks"]},{"pattern":"shadow-inject.js","scope":["mcp-doc-hooks"]},{"pattern":"shadow-inject.test.js","scope":["mcp-doc-hooks"]},{"pattern":"shadow-reconcile.js","scope":["mcp-doc-hooks"]},{"pattern":"oracle.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# loader.js / shadow-*.js / oracle.js — shadow du moteur unifié (RELIQUE — décâblé 17/07/2026)

⚠️ `shadow-inject.js` = RELIQUE : décâblé de settings.json le 17/07/2026 après bascule (la porte doc-inject.js est LIVE). Ne PAS le recâbler — son rôle (répétition avant bascule) est terminé. Le code reste comme relique + ses tests tournent.
⚠️ S'il tournait : il N'INJECTE JAMAIS (stdout vide, fail-open intégral) — journalise seulement (`state/shadow-*.jsonl`). Lui faire émettre du JSON de hook = injection déguisée.
⚠️ `loader.js` = PUR (corpus frontmatters → règles ordonnées) : tri PAR RÈGLE (`rank` par entrée pour les 23 docs ENTRELACÉES), docs sans rank APRÈS les rankées (alpha). Muté Stryker 100%.
⚠️ `oracle.js` = SEULE lecture de la sortie de protect-files (partagé différentiel + reconcile). Deux parseurs = deux façons de mentir (vécu 3× le 15/07).
⚠️ `shadow-reconcile.js` = verdict de bascule (`node shadow-reconcile.js`) : exit 1 à la 1ʳᵉ divergence, exit 2 si journal VIDE (shadow mort ≠ shadow parfait). OFFLINE seulement — jamais dans le chemin chaud.
Bascule FAITE (17/07/2026) — historique dans REFACTOR-PLAN.md.
