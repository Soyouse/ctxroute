---
rules: [{"pattern":"budget.js","scope":["mcp-doc-hooks"]},{"pattern":"budget.property.test.js","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# budget.js — ce qui sort tient dans la trame, ou c'est ANNONCÉ
⚠️ **NE JAMAIS y écrire un seuil de harnais.** Le chiffre vient de la COQUILLE (`options.budget`) ; ce module partagé ignore Claude Code, Codex et le suivant. MESURÉ 31/07/2026 : Claude Code 2.1.220 coupe à **10 000 caractères par hook et par champ** (`BYe(..., n=TCu)`), override par feature-gate DISTANT (`tengu_velvet_ibis`) ⇒ le seuil peut bouger sans mise à jour. Le lire = bâtir sur du sable.
⚠️ **Unité = le CARACTÈRE** (ce que le harnais compte), jamais le token (estimation, variable d'un harnais à l'autre).
⚠️ **Un segment passe ENTIER ou est ANNONCÉ** — jamais coupé : une doc amputée a l'air complète, donc elle ment. Rien n'est jamais perdu (invariant de CONSERVATION, prouvé en property-based).
⚠️ **Sceau CONDITIONNEL** (sous 50 % du budget = format historique à l'octet) : c'est ce qui garde la bascule sûre pour les agents déjà en cours. Au-delà, l'en-tête + `###FIN:xxx###` rendent une troncature AUTO-DÉCLARÉE, sans supposer aucun seuil.
⚠️ **`porte-core` remet l'état des docs DIFFÉRÉES** : `gate.decide` marque `seen:true` pour tout ce qu'il décide, sans connaître le budget. Sans cette remise, une doc `once` évincée serait consommée sans avoir été livrée — perdue pour la session.
⚠️ **Générateurs property : budget RELATIF aux tailles + `tailleEnveloppe()`.** Deux sabotages sont passés VERTS le 31/07/2026 (biais fast-check vers les petites valeurs ⇒ zone mixte jamais visitée). Le méta-test ⑦ COUVERTURE scelle ça — ne JAMAIS le retirer comme un doublon.
