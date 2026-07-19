// ═══════════════════════════════════════════════════════════════════════
// deadline.js — TOUT PROCESS JETABLE PORTE SA PROPRE ÉCHÉANCE
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE — incident MESURÉ le 15/07/2026 :
//    875 process `statusline.js` zombies, dont un de 20 HEURES, 0,8 Go de RAM
//    libre sur 16. Cause : Claude Code sur Windows ne ferme pas toujours le stdin
//    du hook qu'il spawne (bug Anthropic documenté, anthropics/claude-code#68626 :
//    « the headless worker blocks waiting for stdin EOF the launcher never sends »).
//    Le hook attend un `end` qui n'arrive JAMAIS. Il ne plante pas, il ne log rien :
//    il vit pour toujours. Sous Windows, aucun groupe de process ne le récolte —
//    le parent meurt, l'enfant reste (736 orphelins mesurés).
//
// ⚠️ LE POINT CENTRAL — INDÉPENDANCE TOTALE VIS-À-VIS DU HARNAIS :
//    Ce timer ne demande la permission à PERSONNE. EOF ou pas, parent mort ou vivant,
//    tuyau tenu par un handle hérité ou pas, Claude Code v2 ou v9 : LE PROCESS MEURT.
//    C'est ce qui rend le système immunisé contre un bug tiers qu'on ne peut ni
//    corriger, ni prévoir, ni attendre qu'il soit corrigé. On ne dépend d'aucun
//    comportement d'Anthropic. C'est LA propriété à préserver — ne jamais la troquer
//    contre « attendre un peu plus au cas où ».
//
// ⚠️ `.unref()` EST OBLIGATOIRE, ce n'est PAS un détail d'optimisation :
//    - cas normal  : stdin se ferme → on écrit → node sort. Le timer unref'd ne
//                    retient PAS la boucle → ZÉRO latence ajoutée. Sans unref(),
//                    CHAQUE appel d'outil attendrait le délai complet. Inacceptable.
//    - cas zombie  : l'EOF n'arrive jamais, mais le handle stdin garde la boucle
//                    VIVANTE → le timer unref'd se déclenche quand même → mort.
//    C'est exactement l'asymétrie recherchée. Retirer unref() = tout casser dans un
//    sens ; retirer le timer = tout casser dans l'autre. Les deux, jamais l'un seul.
//
// ⚠️ LIMITE CONNUE, ASSUMÉE : node est mono-thread — un timer ne peut pas se
//    déclencher pendant une opération SYNCHRONE. Un hook qui bloque dans un
//    `readFileSync` géant ou un `execSync` échappe à l'échéance. Les hooks lisent
//    de petits fichiers locaux (quelques ms) → risque négligeable, mais RÉEL.
//    Le zéro absolu exigerait un Job Object Windows (l'OS tue, pas le process) =
//    dépendance native. Rejeté : bazooka pour un moustique. À reconsidérer SEULEMENT
//    si un zombie est un jour mesuré MALGRÉ cette échéance.
//
// ⚠️ NE JAMAIS réimplémenter un setTimeout d'échéance ailleurs : source unique.
//    Scellé par le gate statique `deadline-gate.test.js` — tout hook qui lit stdin
//    DOIT passer par ici. Une consigne en prose serait oubliée ; le gate, non.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// 2 s : très au-dessus du travail réel d'un hook (mesuré : 1-36 ms) et très en
// dessous de la patience de l'utilisateur. ⚠️ NE PAS augmenter « pour être sûr » :
// le délai n'est JAMAIS payé dans le cas normal (unref), il n'est payé QUE par un
// process déjà cassé. L'allonger ne protège rien, ça retarde juste la mort d'un mort.
//
// ⚠️⚠️ TOUT LE PARAGRAPHE CI-DESSUS EST FAUX. CONSERVÉ EXPRÈS COMME AVERTISSEMENT.
//
// Il valait 2000 ms et n'avait JAMAIS été mesuré sous charge. RÉGRESSION RÉELLE EN
// PROD le 15/07/2026, attrapée par le différentiel (un test écrit pour un TOUT AUTRE
// sujet) : sous 24 spawns parallèles, 19/24 `protect-files.js` sortaient AVANT
// d'avoir injecté quoi que ce soit. Docs silencieusement non injectées = LA CLASSE
// DE BUG que ce framework existe pour tuer, réintroduite par son propre garde-fou.
//
// L'ERREUR DE RAISONNEMENT : `.unref()` empêche le timer de RETENIR la boucle
// d'événements — il ne l'empêche PAS de TIRER pendant un travail légitime en cours.
// Boot de node mesuré : ~1 s au repos (déjà la moitié du budget de 2 s), bien plus
// sous contention CPU. Le délai EST donc payé par du travail normal dès que la
// machine est chargée.
//
// ⚠️ RÈGLE : une échéance BORNE L'INFINI, elle n'optimise RIEN. Les zombies vivaient
//    20 HEURES : 30 s est 2400× mieux ET ne peut interférer avec aucun travail réel
//    (un hook qui dépasse 30 s est cassé, pas lent). Toujours choisir la PLUS GRANDE
//    valeur qui borne encore utilement — jamais la plus petite qui « semble suffire ».
// ⚠️ NE JAMAIS redescendre ce seuil sans le mesurer SOUS CHARGE (24 spawns
//    parallèles, cf `deadline-charge.test.js`). Un seuil serré tue du travail
//    légitime EN SILENCE — c'est pire que le zombie qu'il prétend éviter.
const DEFAULT_MS = 30000;

/**
 * Arme l'échéance du process courant. À appeler AU PLUS TÔT, avant toute I/O.
 *
 * @param {object} [opts]
 * @param {number} [opts.ms]      - délai (défaut 30000 — cf en-tête, valeur corrigée après régression réelle). Env MCP_DOC_DEADLINE_MS pour les tests.
 * @param {Function} [opts.onExpire] - best-effort AVANT de sortir (ex. écrire ce qu'on a).
 *                                     ⚠️ S'il throw, on sort QUAND MÊME : une sortie
 *                                     de secours qui peut échouer n'est pas une sortie.
 * @returns {Function} disarm() — désarme (tests uniquement ; jamais en prod).
 */
function arm(opts) {
  const o = opts || {};
  const envMs = Number(process.env.MCP_DOC_DEADLINE_MS);
  const ms = Number.isFinite(o.ms) ? o.ms : Number.isFinite(envMs) && envMs > 0 ? envMs : DEFAULT_MS;

  const t = setTimeout(() => {
    // ⚠️ try/catch OBLIGATOIRE : le seul but de ce bloc est de garantir process.exit().
    //    Une exception ici ressusciterait le zombie qu'on vient de condamner.
    try {
      if (typeof o.onExpire === 'function') o.onExpire();
    } catch (e) {
      /* best-effort : la sortie prime sur le rendu */
    }
    // ⚠️ exit(0) et JAMAIS exit(1) : un hook qui sort non-zéro peut être interprété
    //    comme un refus par le harnais (bloquer un outil). Fail-open, toujours :
    //    l'échéance protège la MACHINE, elle ne doit jamais gêner l'UTILISATEUR.
    process.exit(0);
  }, ms);

  // ⚠️ Voir l'en-tête : sans ce .unref(), chaque appel d'outil paierait `ms`.
  if (typeof t.unref === 'function') t.unref();

  return function disarm() {
    clearTimeout(t);
  };
}

module.exports = { arm, DEFAULT_MS };
