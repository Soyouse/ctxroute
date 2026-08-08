// ═══════════════════════════════════════════════════════════════════════
// CANARI — le seul témoin qui regarde l'AUTRE BOUT du tuyau.
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (03/08/2026, trou NOMMÉ puis fermé). Tout le reste du
// framework se teste LUI-MÊME : le doctor spawne notre hook avec NOTRE
// payload et vérifie NOTRE sortie. C'est nécessaire, et parfaitement aveugle
// au seul risque qui reste : que le HARNAIS change d'avis.
//
// ⚠️ CE QUE LE RESTE COUVRE DÉJÀ (ne pas le refaire ici) :
//    · limite de taille abaissée  → le SCEAU le rend bruyant (marqueur absent) ;
//    · paquet perdu ou dédupliqué → le NUMÉRO manquant le rend bruyant ;
//    · notre code cassé           → le DOCTOR hurle.
// ⚠️ CE QUE LUI SEUL COUVRE : le harnais renomme les champs qu'il envoie, ou
//    cesse de CONSOMMER `additionalContext`. Alors nos hooks fail-open en
//    silence, le doctor reste VERT, et plus rien n'atteint l'agent. Aucun test
//    ne peut voir ça : on se testerait soi-même. Il faut observer le RÉEL.
//
// ⚠️ LE SIGNAL EST DÉCIDABLE, JAMAIS HEURISTIQUE. Le harnais écrit le
//    transcript de la session ; une injection qui a ATTERRI y laisse sa trace
//    (`[source: …]`, posé par la porte sur CHAQUE segment). On ne devine rien,
//    on constate : des appels d'outils ont eu lieu, et zéro injection a atterri.
//
// ⚠️ L'ALARME NE DOIT JAMAIS EMPRUNTER LE TUYAU QU'ELLE TESTE. Si le canal
//    d'injection est mort, hurler PAR une injection ne servirait à rien —
//    l'alarme mourrait avec ce qu'elle signale. D'où la sortie par un fichier
//    de santé lu par la STATUSLINE (canal hors-bande, déjà éprouvé dans ce parc
//    par `mem-health.json`). NE JAMAIS « simplifier » en repassant par
//    additionalContext.
//
// ⚠️ PUR : zéro I/O, zéro horloge, zéro aléa — la coquille compte, ce module
//    tranche. C'est la condition de la mutation sans mutants équivalents.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Nombre d'ÉMISSIONS à partir duquel « zéro injection atterrie » cesse d'être
// une coïncidence et devient une PREUVE.
// ⚠️ Ce n'est pas un délai, c'est une TAILLE D'ÉCHANTILLON — la règle du parc
//    « le temps se déclare » ne s'y applique pas : on n'attend rien, on exige
//    d'avoir assez observé avant de conclure.
// ⚠️ JUSTIFICATION RECALIBRÉE LE 07/08/2026, ET IL FALLAIT LE FAIRE. Le chiffre
//    valait pour des APPELS D'OUTILS (mesure du 03/08 : 109 appels / 174
//    injections). Il compte désormais des ÉMISSIONS — une AUTRE grandeur. Garder
//    le nombre sans refaire la mesure, c'est traîner une justification périmée
//    qui a l'air d'en être une : exactement ce que ce repo traque ailleurs.
// ⚠️ NOUVELLE MESURE (transcript réel de 46 Mo, 13 compactions repérées par
//    `isCompactSummary`) : entre deux compactions, **94 à 335 injections**
//    atterries — donc bien plus de 25 émissions. Le seuil est franchi tôt dans
//    chaque intervalle, et le compteur (purgé en PreCompact) a le temps de se
//    reconstituer. 🛑 Cette mesure vaut pour CE parc : sur des sessions très
//    courtes et très compactées, le canari resterait `indecidable` — dégradation
//    SÛRE (silence), jamais une fausse alarme, scellée par le test
//    « APRÈS COMPACTION » de `canari-check.test.js`.
// ⚠️ Le baisser fabriquerait des fausses alertes — et un avertissement récurrent
//    sur du sain, c'est un canal qu'on cesse de lire (leçon du rush mode).
const SEUIL_EMISSIONS = 25;

// Fenêtre de lecture du transcript, en octets, lue depuis la FIN.
// ⚠️ BORNE OBLIGATOIRE : un transcript réel du parc pesait **104 Mo** le
//    03/08/2026. Le lire en entier coûtait 524 ms et autant de mémoire, à
//    CHAQUE tour. Lire la queue coûte 5 ms et voit déjà ~109 appels : 100 fois
//    moins cher, pour un signal identique. NE JAMAIS repasser à une lecture
//    intégrale « pour être sûr » — c'est l'activité RÉCENTE qui dit si le canal
//    est vivant maintenant.
const FENETRE_OCTETS = 2 * 1024 * 1024;

// Marque laissée dans le transcript par une injection qui a ATTERRI.
// ⚠️ `[source:` est posé par la porte sur CHAQUE segment émis, scellé ou non,
//    entier ou morcelé — c'est donc le témoin le plus LARGE possible. Ne pas le
//    remplacer par le sceau `###FIN:` : celui-ci n'apparaît qu'au-delà de 50 %
//    du budget, et le canari deviendrait aveugle aux petites injections.
const MARQUE_INJECTION = '[source:';

// ⚠️ Longueur max d'une étiquette PLAUSIBLE (un chemin de doc). Généreux à
//    dessein : le filtre discriminant est la FORME (`.md` / `skill/`), pas la
//    taille — celle-ci n'écarte que les faux `]` très lointains.
const LONGUEUR_ETIQUETTE_MAX = 200;

// ⚠️ IL N'Y A PLUS AUCUNE MARQUE DE HARNAIS NULLE PART — ni ici, ni dans la
//    coquille (07/08/2026). Jusqu'à cette date, le DÉNOMINATEUR (« combien
//    d'occasions d'injecter ? ») se comptait en cherchant `"type":"tool_use"`
//    dans le transcript de Claude Code, et le portage sur un autre harnais
//    consistait à deviner SON marqueur équivalent.
// 🛑 CETTE APPROCHE EST MORTE, ET LA DOC OFFICIELLE LE DIT NOIR SUR BLANC.
//    Hooks Codex (learn.chatgpt.com/docs/hooks, relue le 07/08/2026) :
//    « the transcript format isn't a stable interface for hooks and may change
//    over time ». Le transcript est un CONFORT de lecture, jamais un contrat.
//    Bâtir un dénominateur sur son schéma, c'est parier sur un format que
//    l'éditeur se réserve le droit de casser — interdit permanent du repo.
// ✅ CE QUI LE REMPLACE : le compteur d'ÉMISSIONS de `emission-core.js`, une
//    donnée à NOUS. Le canari demande désormais « on a émis N fois, est-ce
//    arrivé ? » au lieu de « il s'est passé N choses chez le harnais ».
//    C'est la MÊME question, posée à une source dont nous sommes l'auteur.
//    Conséquence heureuse : les deux harnais partagent la MÊME coquille — le
//    portage sur Codex n'a coûté aucun fichier, seulement une ligne de câblage.
//
// ⚠️ `MARQUE_INJECTION` RESTE ici, et elle seule : c'est NOTRE marque, posée par
//    notre propre porte. La chercher dans le transcript ne dépend d'AUCUN
//    schéma — c'est une sous-chaîne dans du texte. Si le harnais change son
//    format de fichier, notre marque y reste ; s'il cesse d'écrire un
//    transcript, `transcript_path` vaut `null` (documenté) et le canari se tait.

/**
 * Tranche l'état du canal d'injection.
 *
 * @param {number} emissions — fois où le framework a fait SORTIR du contexte.
 * @param {number} injections — injections ayant ATTERRI dans la fenêtre.
 * @returns {'vivant'|'mort'|'indecidable'}
 *
 * ⚠️ TOTAL : ne throw JAMAIS et ne rend jamais autre chose que ces 3 valeurs.
 *    Un canari qui plante serait un canari muet — donc pire qu'absent, puisqu'on
 *    croirait être surveillé.
 * ⚠️ L'ORDRE DES TESTS EST PORTEUR : une seule injection constatée SUFFIT à
 *    prouver que le canal vit. On ne compare JAMAIS un nombre d'injections à un
 *    nombre attendu — ce serait retomber dans l'estimation.
 */
function verdict(emissions, injections) {
  // ⚠️ `Math.max(0, …)` et NON `x > 0 ? x : 0` : à x = 0 les deux branches du
  //    ternaire rendent la même chose ⇒ le comparateur est INTUABLE (mutant
  //    équivalent, donc survivant éternel). Même leçon que `parsePaquetArgs` et
  //    `capacitePaquet` — écrire la forme TESTABLE, toujours.
  const e = Number.isInteger(emissions) ? Math.max(0, emissions) : 0;
  const i = Number.isInteger(injections) ? Math.max(0, injections) : 0;
  if (i > 0) return 'vivant';
  // Pas assez observé pour accuser : on se TAIT plutôt que de crier au loup.
  if (e >= SEUIL_EMISSIONS) return 'mort';
  return 'indecidable';
}

/**
 * Étiquette prête à afficher, pour N'IMPORTE QUEL afficheur hors-bande.
 *
 * ⚠️ Le framework NE FOURNIT PAS l'afficheur et n'en dépend pas : il publie un
 *    verdict dans un fichier, point. Chez le mainteneur c'est une statusline ;
 *    ailleurs ce sera un prompt shell, une notification, un log. Ne JAMAIS
 *    coupler ce module à un afficheur particulier — le framework doit
 *    s'installer tel quel chez n'importe qui.
 *
 * ⚠️ SILENCE QUAND TOUT VA BIEN (chaîne vide) : une alarme permanente sur du
 *    sain devient un décor qu'on ne lit plus. Le canari ne parle QUE pour
 *    annoncer une panne — c'est ce qui rend sa parole crédible le jour où elle
 *    arrive.
 */
function etiquette(v) {
  return v === 'mort' ? '💉⚠️ INJECTION MORTE' : '';
}

/**
 * Compte les injections ATTERRIES dans un extrait de transcript.
 *
 * ⚠️ Tolérant aux lignes TRONQUÉES : la fenêtre coupe le fichier au milieu
 *    d'une ligne par construction. On compte des SOUS-CHAÎNES, jamais du JSON
 *    parsé — parser exigerait des lignes entières, rendrait le canari fragile
 *    au découpage, et surtout ferait DÉPENDRE le canari du schéma du
 *    transcript, que la doc Codex déclare instable (cf en-tête). Compter une
 *    sous-chaîne qu'on a soi-même écrite ne dépend d'aucun format.
 * ⚠️ UN SEUL TÉMOIN ICI, plus deux (07/08/2026) : le dénominateur ne se lit
 *    plus dans le transcript, il vient du compteur d'émissions. Ne JAMAIS
 *    réintroduire un paramètre « marque d'appel » — ce serait refaire entrer un
 *    dialecte de harnais dans le noyau.
 */
function compterInjections(extrait) {
  // ⚠️ Sortie ANTICIPÉE plutôt qu'un repli sur `''` : le repli introduisait une
  //    chaîne ARBITRAIRE que rien ne peut observer ⇒ mutant équivalent. Ici, le
  //    zéro est une valeur de contrat, donc testable.
  if (typeof extrait !== 'string') return 0;
  let n = 0;
  let k = extrait.indexOf(MARQUE_INJECTION);
  while (k !== -1) {
    const debut = k + MARQUE_INJECTION.length;
    const fin = extrait.indexOf(']', debut);
    // ⚠️ `fin === -1` = marque COUPÉE par la fenêtre de 2 Mo. Indécidable ⇒ on
    //    ne compte pas. Ne JAMAIS compter ici « pour ne rien rater » : ce
    //    serait rouvrir exactement le trou ㉘ sur les marques tronquées.
    if (fin !== -1 && estEtiquetteEmise(extrait.slice(debut, fin))) n++;
    k = extrait.indexOf(MARQUE_INJECTION, debut);
  }
  return n;
}

/**
 * L'étiquette a-t-elle la forme de celles que NOTRE PORTE ÉMET ?
 *
 * 🛑 DÉFAUT ㉘ (07/08/2026) — LIRE AVANT DE TOUCHER À CETTE FONCTION.
 *    Le canari comptait toute occurrence de `[source:`. Or ce littéral vit
 *    aussi dans du TEXTE QUI EN PARLE : les commentaires de ce fichier même, et
 *    **64 docs du parc sur 386** (MESURÉ ce jour) qui CITENT un fichier source
 *    sous cette forme. Conséquence : un agent qui LIT une de ces docs faisait
 *    passer le canari au VERT — c'est-à-dire que le dead-man switch se
 *    désamorçait au moment précis où quelqu'un ENQUÊTAIT sur une injection
 *    morte. Le seul scénario où il sert est celui où il mentait.
 *
 * ✅ CE QUI DISCRIMINE : une étiquette ÉMISE désigne toujours un DOCUMENT —
 *    elle finit par `.md` (docs fichier, MCP, session) ou commence par
 *    `skill/`. Une citation de code désigne un fichier SOURCE. Mesure du parc
 *    sur les marqueurs EN DUR : 23 `.js`, 18 `.ts`, 7 `.tsx`, 4 `.sh`, 3 `.py`,
 *    1 `.mjs`, 1 `.service` — et 4 seulement en `.md`.
 *
 * ⚠️ CE N'EST PAS LE FIX COMPLET, ne JAMAIS le présenter comme tel : les 4 docs
 *    du parc qui citent un `.md` restent comptées à tort. Le fix TOTAL =
 *    n'accepter que les étiquettes RÉELLEMENT ÉMISES, relues dans le store
 *    (`emission-core`). Il n'a pas été fait ici parce qu'il exige de toucher le
 *    module par où passe TOUT le contexte de TOUS les agents, pendant que
 *    d'autres agents travaillaient. Chantier ㉘ bis du REFACTOR-PLAN.
 */
function estEtiquetteEmise(brut) {
  const l = brut.trim();
  // ⚠️ Borne HAUTE : une marque suivie d'un `]` très lointain (prose, JSON
  //    échappé) n'est pas une étiquette. Sans elle, n'importe quel texte
  //    contenant `[source:` puis un `]` finirait par valider.
  // ⚠️ PAS de garde `l.length === 0` : elle était MORTE (mutant survivant,
  //    07/08/2026). Une étiquette vide ne finit pas par `.md` et ne commence
  //    pas par `skill/` ⇒ elle est DÉJÀ refusée par le test de forme. Écrire un
  //    test pour la ressusciter aurait figé du code inutile pour toujours.
  if (l.length > LONGUEUR_ETIQUETTE_MAX) return false;
  return l.endsWith('.md') || l.startsWith('skill/');
}


// ⚠️ `occurrences()` A ÉTÉ SUPPRIMÉE le 08/08/2026 — CODE MORT, pas un oubli.
//    Elle datait du canari qui comparait REÇU vs ATTENDU (deux compteurs tirés
//    du transcript). Depuis le 07/08 le dénominateur vient de
//    `emission-core.compteurEmissions` et `compterInjections` fait son propre
//    balayage : plus aucun appelant, et elle n'était pas exportée.
// 🛑 NE PAS LA RESSUSCITER « au cas où ». Elle portait les 4 SEULS mutants
//    survivants du dépôt (`NoCoverage`, canari.js à 93,85 %) et masquait la
//    question qui compte : *pourquoi une fonction que rien n'appelle vit-elle
//    encore ici ?* Écrire un test pour la couvrir aurait figé du code inutile
//    pour toujours — mutation = ÉLIMINER, jamais TESTER.

module.exports = { verdict, etiquette, compterInjections, SEUIL_EMISSIONS, FENETRE_OCTETS, MARQUE_INJECTION };
