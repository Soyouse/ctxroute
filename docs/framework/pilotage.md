---
rules: [{"pattern":"ARBORESCENCE.md","scope":["mcp-doc-hooks"]},{"pattern":"REFACTOR-PLAN.md","scope":["mcp-doc-hooks"]}]
mode: dumb
confirm: true
---
# ARBORESCENCE.md / REFACTOR-PLAN.md — les 2 documents de PILOTAGE du repo
⚠️ **`ARBORESCENCE.md` = filet d'EXHAUSTIVITÉ** : 1 ligne par fichier, JAMAIS un jugement d'importance — un fichier hors liste est un trou PAR DÉFINITION. Ajout/suppression/renommage ⇒ MAJ **dans le même geste**. Scellé par le volet ② de `couverture-gate.test.js` (il lit ce fichier ET le skill).
⚠️ **Ne JAMAIS la réintégrer au skill** : sortie le 31/07/2026 car elle en pesait 48 % et poussait le skill entier au-delà de la trame du harnais — il était donc ÉVINCÉ, c'est-à-dire ABSENT du contexte.
⚠️ **`REFACTOR-PLAN.md` = backlog + décisions.** Y écrire la CIBLE, jamais l'état d'avancement seul. Un chantier « fermé » qui ne remplit qu'une moitié de sa cible DOIT le dire — sinon la moitié manquante devient invisible (arrivé le 31/07 : le §20/07 se déclarait fermé alors que l'injection intégrale, sa vraie cible, restait ouverte).
⚠️ **Consigner aussi les pistes ÉCARTÉES avec leur MESURE** (pas juste le verdict) : le multi-hooks a été rejeté, puis rouvert, puis re-rejeté sur chiffres en une seule journée. Sans la mesure écrite, la boucle recommence.
⚠️ **Un jugement RENVERSÉ se réécrit, il ne s'empile pas** : le backlog dit ce qui est VRAI aujourd'hui, avec la date et la preuve. Un lecteur ne doit jamais avoir à deviner quelle ligne est périmée.
