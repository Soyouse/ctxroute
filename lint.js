// ═══════════════════════════════════════════════════════════════════════
// LINT DU PARC — le framework s'audite LUI-MÊME. PUR.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (gate `lint-must-stay-pure`). L'appelant lit le disque et
//    fournit un ÉTAT ; ce module DÉCIDE. Comme lib-pure.js / sources/file.js :
//    c'est la CONDITION pour muter sans mutants équivalents, pas un confort.
//
// ⚠️ RAISON D'ÊTRE — le trou trouvé le 15/07/2026 :
//    `doctor.js` surveille le MOTEUR (« est-ce que j'injecte encore ? »).
//    PERSONNE ne surveillait le PARC (306 docs, 553 règles, 16 serveurs MCP).
//    Ce jour-là, SIX trous ont été trouvés avec des scripts JETABLES écrits à
//    la main dans un dossier temporaire. C'ÉTAIT ÇA LE BUG : une mesure qui ne
//    survit pas à la session ne protège rien. Ce fichier les rend permanents.
//
// ⚠️ LA MALADIE COMMUNE que ce lint traite : le framework existe pour rendre
//    l'implicite EXPLICITE, et ne se l'appliquait pas à lui-même. Une doc
//    volontairement muette et une doc au pattern OUBLIÉ sont indiscernables —
//    deux fichiers silencieux. Un serveur MCP sans doc : choisi, ou pas encore
//    fait ? Le silence cesse d'être une réponse : il se DÉCLARE.
//
// ⚠️ UNE DÉCLARATION, UNE VÉRITÉ — le point de maintenabilité central :
//    ce module ne sait PAS d'où vient un déclencheur. L'appelant NORMALISE
//    chaque doc en une `declaration` uniforme, qu'elle vienne aujourd'hui de
//    `protected-paths.json` ou demain de son frontmatter. Conséquences :
//      - `validate()` reste la SEULE autorité sur « cette déclaration est-elle
//        saine ? » — ce lint ne re-juge JAMAIS (2 codes pour 1 jugement =
//        divergence garantie le jour où l'un des deux évolue) ;
//      - la migration ne fait mourir AUCUNE ligne ici : seule la coquille
//        change de source.
//    ⚠️ NE JAMAIS ajouter ici un check « la doc est-elle visée par une règle ? » :
//    ce serait rapatrier la notion d'époque dans le noyau.
//
// ⚠️ AUCUN DIALECTE DE HARNAIS (gate) : rend des constats, n'imprime rien,
//    n'exit() pas, ne formate pas. La porte s'en charge — même règle que
//    sources/*.js, c'est ce qui rend le portage Codex trivial.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { validate } = require('./frontmatter');

// ⚠️ ORDRE SIGNIFIANT (du plus grave au moins grave) : `indexOf()` sert de
//    comparaison. Réordonner = changer en SILENCE ce que `level: warn` laisse
//    passer. Valeurs de contrat, à écrire en dur dans les tests.
const NIVEAUX = ['error', 'warn', 'info'];

// ⚠️ DÉFAUT `warn` — PAS un compromis mou. Douleur MESURÉE le 15/07/2026 : le
//    rush mode (`.rush`) était ACTIF, tous les asks coupés. Quand on ne peut
//    pas régler le bruit, on éteint TOUT — et un gate éteint n'est pas un gate.
//    Un cran de réglage évite le bouton nucléaire.
const NIVEAU_DEFAUT = 'warn';

// ⚠️ `code` STABLE (jamais traduit ni reformulé : un test ou un filtre s'y
//    accroche). `message` = pour l'humain, libre d'évoluer.
function constat(niveau, code, cible, message) {
  return { niveau, code, cible, message };
}

// ⚠️ SOURCE UNIQUE du « c'est une liste, ou rien » — EXPORTÉE EXPRÈS.
//    Écrire `Array.isArray(x) ? x : []` en ligne (5× dans ce module au 1er jet)
//    produit 5 mutants ÉQUIVALENTS : Stryker remplace `[]` par
//    `["Stryker was here"]`, invisible sauf à écrire un test couplé à cette
//    chaîne interne — INTERDIT (casse à l'upgrade de l'outil).
//    Extraite et exportée, la garde devient OBSERVABLE : `liste(null)` doit
//    rendre `[]`, un test direct tue le mutant. Doctrine appliquée : la garde
//    redondante s'évite par CONSTRUCTION, elle ne se teste pas en place.
//    Bonus : une seule vérité au lieu de 5 copies (maintenabilité).
function liste(x) {
  return Array.isArray(x) ? x : [];
}

/**
 * ⚠️ LE cœur du lint. PUR : même état ⇒ mêmes constats, zéro effet de bord.
 *
 * @param {object} etat
 *   @param {Array} etat.docs - [{ chemin, declaration }] — `declaration` est
 *          NORMALISÉE par l'appelant (frontmatter OU règles), jamais brute.
 *   @param {Array} etat.docsFantomes - .md ciblés par une règle mais ABSENTS.
 *   @param {Array} etat.serveursMCP - serveurs MCP branchés.
 *   @param {Array} etat.serveursDocumentes - serveurs ayant un docs/mcp/{X}.md.
 *   @param {Array} etat.serveursDeclares - serveurs déclarés « sans doc, voulu ».
 * @returns {Array} constats, triés du plus grave au moins grave.
 */
function analyser(etat) {
  const e = etat || {};
  const constats = [];

  // ── ERREUR : déclaration malsaine ────────────────────────────────────
  // ⚠️ `validate()` est la SEULE autorité. Couvre d'un coup : aucun
  //    déclencheur (doc morte en silence — LE bug que le refactor tue), clé
  //    mal orthographiée (`mach:`), `inject` contradictoire, mode inconnu.
  //    Ne JAMAIS dupliquer un de ces jugements ici.
  for (const d of liste(e.docs)) {
    if (!d || typeof d.chemin !== 'string') continue;
    for (const err of validate(d.declaration || {})) {
      constats.push(constat('error', 'declaration-invalide', d.chemin, err));
    }
  }

  // ── ERREUR : règle fantôme ───────────────────────────────────────────
  // ⚠️ Le miroir exact : une règle qui vise un .md inexistant est morte et ne
  //    dit rien. 0 mesurée le 15/07 — ce check existe pour que ça le RESTE.
  for (const chemin of liste(e.docsFantomes)) {
    // ⚠️ Le LIBELLÉ est de la communication, pas du comportement (le `code`
    //    `regle-fantome` et le `niveau`, eux, restent mutés ET testés).
    //    Le muter produit un mutant équivalent que seul un test couplé au
    //    texte exact tuerait — fragile au moindre reformulage.
    // ⚠️ `next-line` ne couvre QUE la ligne suivante : la chaîne DOIT être sur
    //    cette ligne-là. Erreur commise le 15/07 (disable posé sur la ligne du
    //    `push`, chaîne à la ligne d'après → mutant survivant en CI).
    constats.push(constat('error', 'regle-fantome', chemin,
      // Stryker disable next-line StringLiteral
      'une règle vise ce .md, il n\'existe pas : règle morte en silence.'));
  }

  // ── WARN : serveur MCP branché sans doc ──────────────────────────────
  // ⚠️ MESURÉ : 2 documentés sur 16 branchés. `ssh` (VPS prod) et `infra`
  //    (sites clients) sans aucune doc. `config-gate.test.js` est DIRECTIONNEL
  //    (« toute doc a une config ») donc structurellement AVEUGLE à ce cas.
  // ⚠️ WARN et pas ERREUR — arbitré par le mainteneur le 15/07 : ce n'est pas un oubli,
  //    c'est « pas encore eu le temps ». Un serveur sans doc ne CASSE rien, il
  //    ne protège pas encore. En `error`, le lint serait rouge en permanence,
  //    donc ignoré, donc inutile : la leçon exacte du rush mode.
  const couverts = new Set([...liste(e.serveursDocumentes), ...liste(e.serveursDeclares)]);
  for (const s of liste(e.serveursMCP)) {
    if (couverts.has(s)) continue;
    constats.push(constat('warn', 'mcp-sans-doc', s,
      // Stryker disable next-line StringLiteral
      `serveur MCP branché sans doc. Écris docs/mcp/${s}.md, ou mets-le dans filterList si c'est volontaire.`));
  }

  // ⚠️ ORDRE DE GRAVITÉ GARANTI PAR CONSTRUCTION : tous les checks `error`
  //    poussent AVANT le seul check `warn`. La porte peut donc tronquer sans
  //    jamais couper une erreur au profit d'un warn.
  //    ⚠️ Un `.sort()` par gravité a existé ici et a été RETIRÉ (15/07/2026) :
  //    il était INATTEIGNABLE — la liste sortait déjà triée, donc il ne
  //    réordonnait jamais rien = code mort = mutant équivalent, et le test
  //    « tri » qui le couvrait passait par accident (il ne prouvait rien).
  //    ⚠️ NE PAS le remettre. Si un jour un check `warn`/`info` doit être
  //    poussé AVANT un check `error`, c'est l'ORDRE DES CHECKS qu'il faut
  //    corriger — le test `sortie triée par gravité` le verra rougir.
  return constats;
}

/**
 * Filtre par niveau configuré. PUR.
 * ⚠️ `off` = zéro constat, y compris les `error`. VOLONTAIRE : c'est un choix
 *    déclaré de l'utilisateur (même logique que `enabled: false`). Ne JAMAIS
 *    « forcer les erreurs quand même » — un interrupteur qui n'éteint pas tout
 *    est un interrupteur cassé.
 * ⚠️ Niveau inconnu ⇒ défaut, JAMAIS `off` : une faute de frappe dans la config
 *    ne doit pas éteindre le diagnostic en silence (fail-open sur le bruit,
 *    jamais sur la détection).
 */
function filtrer(constats, niveau) {
  if (niveau === 'off') return [];
  const seuil = NIVEAUX.indexOf(NIVEAUX.includes(niveau) ? niveau : NIVEAU_DEFAUT);
  return liste(constats).filter((c) => c && NIVEAUX.indexOf(c.niveau) <= seuil);
}

/**
 * Le lint doit-il HURLER (exit ≠ 0) ? PUR.
 * ⚠️ Seules les ERREURS hurlent. Un `warn` qui casse le démarrage de session
 *    serait un gate bloquant — banni par la doctrine (« husky full-suite »).
 */
function doitHurler(constats) {
  return liste(constats).some((c) => c && c.niveau === 'error');
}

module.exports = { analyser, filtrer, doitHurler, liste, NIVEAUX, NIVEAU_DEFAUT };
