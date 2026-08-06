---
match: emission-doublon.test.js
mode: dumb
---
# UNE SEULE DÉCLARATION DE PORTE — « plus de tuyaux » est un ANTIPATTERN (06/08/2026)
🔴 **DÉFAUT RÉEL, VU À L'ŒIL NU PAR LE MAINTENEUR, invisible à 1066 tests** : avec 12 déclarations, le morceau 7/8 du skill a été livré DEUX FOIS (transcript, marqueurs `2bc5f3df` puis `03d7e9f2`). Cause : les N processus sont PARALLÈLES et se partagent la file — chacun décide sur une photo différente du monde, donc un morceau peut être ÉMIS *et* laissé en file. 🛑 **Le lock ne protège PAS de ça** : il sérialise les ÉCRITURES, pas les DÉCISIONS.
🛑 **L'ORDRE EST IRRATTRAPABLE À N>1** : le harnais rend les sorties dans l'ordre où les processus FINISSENT. Mesuré sur 74 gestes — 69 utilisaient ≥2 trames, donc **93 % arrivaient en désordre**. Les ordonner exigerait qu'un processus ATTENDE ses pairs : coordination entre PAIRS ÉGAUX, que rien ne tranche.
⚠️ **CE N'EST PAS UNE PERTE DE CAPACITÉ** : depuis la file (05/08), N ne règle QUE le DÉBIT. À 1, tout arrive encore — en plus de gestes, jamais en moins de contenu. Médiane mesurée : 3 trames/geste. Et 12 spawns node coûtaient ~4 s à CHAQUE appel d'outil, pour une saturation réelle **1 fois sur 74**.
⚠️ **POSITION DE L'INDUSTRIE, pas une préférence locale** : ouvrir N connexions parallèles était la ruse de HTTP/1.1 ; HTTP/2 puis HTTP/3 l'ont abandonnée pour UNE connexion multiplexée (gRPC 2026 : découper en flux, jamais multiplier les canaux). **« Plus de tuyaux » = la vieille méthode ; le standard est un tuyau, mieux utilisé.**
⚠️ **LE VOLET ③ « COURSE » A ÉTÉ RETIRÉ parce que sa CAUSE n'existe plus**, jamais parce qu'il gênait — éliminer par construction, pas tester du code qu'on peut supprimer. Ce qui garde la porte fermée est `doctor.js --settings` (2 checks : UNE déclaration · aucun `--paquets N>1`), car le câblage vit HORS du repo.
🛑 **NE JAMAIS rouvrir N>1 sous un drapeau** : le désordre et la course reviendraient avec, et un utilisateur ne peut pas consentir à un défaut qu'il ne verra que des semaines plus tard.
