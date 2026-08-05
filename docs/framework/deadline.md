---
rules: [{"pattern":"deadline.js","scope":["ctxroute"],"rank":533},{"pattern":"deadline.test.js","scope":["ctxroute"],"rank":534},{"pattern":"deadline-gate.test.js","scope":["ctxroute"],"rank":535},{"pattern":"deadline-charge.test.js","scope":["ctxroute"],"rank":545}]
mode: dumb
rank: 533
---
# deadline.js — échéance de process (anti-zombie)

⚠️ TOUT hook qui lit stdin DOIT appeler `deadline.arm()` AVANT toute I/O. Sans ça : zombie garanti. Mesuré le 15/07/2026 — 875 process `statusline.js` vivants, un de 20 h, 0,8 Go de RAM libre sur 16.
⚠️ CAUSE = bug Claude Code Windows (anthropics/claude-code#68626) : le harnais n'envoie pas toujours l'EOF sur stdin → le hook attend un `end` qui n'arrive JAMAIS. Windows n'a pas de groupe de process : parent mort, enfant vivant (736 orphelins mesurés).
⚠️ **SEUIL = 30 s. NE JAMAIS LE BAISSER** sans le mesurer SOUS CHARGE (24 spawns parallèles, `deadline-charge.test.js`). Il valait 2 s « puisque le délai n'est jamais payé en temps normal » — FAUX, jamais mesuré : 19/24 `protect-files.js` sortaient AVANT d'injecter → docs muettes EN SILENCE. `.unref()` empêche le timer de RETENIR la boucle, PAS de TIRER pendant un travail légitime (boot de node ≈ 1 s au repos, bien plus sous contention).
⚠️ Une échéance BORNE L'INFINI, elle n'optimise RIEN : prendre la plus GRANDE valeur qui borne encore utilement, jamais la plus petite qui « semble suffire ». Un seuil serré tue du travail légitime en silence = pire que le zombie.
⚠️ NE JAMAIS retirer `.unref()` : sans lui, chaque appel d'outil paie le délai COMPLET. Les deux moitiés (timer + unref), jamais l'une seule.
⚠️ `exit(0)` TOUJOURS : un hook qui sort ≠0 peut être lu comme un refus par le harnais. Fail-open — l'échéance protège la MACHINE, jamais contre l'utilisateur.
⚠️ Autonome par contrat (`deadline-stays-standalone`) : dépend de RIEN → copiable tel quel. La copie de `~/.claude/hooks/` est scellée par le drift-test `deadline-vendor.test.js`.
Limite assumée : node est mono-thread → un timer ne coupe pas une opération SYNCHRONE. Zéro absolu = Job Object Windows (rejeté : dépendance native).
Gates = `deadline-gate.test.js` (repo) · `hooks-parc-gate.test.js` (parc) · Preuves = `deadline.test.js` (spawn réel + negative-check) · `deadline-charge.test.js` (sous charge).
