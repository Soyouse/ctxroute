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

// Nombre d'appels d'outils à partir duquel « zéro injection » cesse d'être une
// coïncidence et devient une PREUVE.
// ⚠️ Ce n'est pas un délai, c'est une TAILLE D'ÉCHANTILLON — la règle du parc
//    « le temps se déclare » ne s'y applique pas : on n'attend rien, on exige
//    d'avoir assez observé avant de conclure. Justification chiffrée : le parc
//    compte des centaines de docs injectables ET des docs de session livrées à
//    chaque démarrage ; sur une session vivante, la fenêtre mesurée le
//    03/08/2026 portait 109 appels pour 174 injections. Zéro injection sur 25
//    appels consécutifs n'arrive pas quand le canal fonctionne.
// ⚠️ Le baisser fabriquerait des fausses alertes — et un avertissement récurrent
//    sur du sain, c'est un canal qu'on cesse de lire (leçon du rush mode).
const SEUIL_APPELS = 25;

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

// ⚠️ AUCUNE MARQUE DE HARNAIS ICI. La façon dont un harnais note un appel
//    d'outil dans son transcript est SON dialecte (Claude Code : `"type":
//    "tool_use"` ; un autre produit écrira autre chose). L'écrire dans ce
//    module ferait entrer un dialecte dans le noyau — précisément ce que
//    `sources-must-not-know-the-harness` interdit ailleurs, et ce qui casserait
//    le portage. La COQUILLE la déclare et la passe en paramètre.
//    ⚠️ `MARQUE_INJECTION`, elle, RESTE ici : c'est NOTRE marque, posée par
//    notre propre porte — elle ne dépend d'aucun produit tiers.

/**
 * Tranche l'état du canal d'injection.
 *
 * @param {number} appels — appels d'outils observés dans la fenêtre.
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
function verdict(appels, injections) {
  // ⚠️ `Math.max(0, …)` et NON `x > 0 ? x : 0` : à x = 0 les deux branches du
  //    ternaire rendent la même chose ⇒ le comparateur est INTUABLE (mutant
  //    équivalent, donc survivant éternel). Même leçon que `parsePaquetArgs` et
  //    `capacitePaquet` — écrire la forme TESTABLE, toujours.
  const a = Number.isInteger(appels) ? Math.max(0, appels) : 0;
  const i = Number.isInteger(injections) ? Math.max(0, injections) : 0;
  if (i > 0) return 'vivant';
  // Pas assez observé pour accuser : on se TAIT plutôt que de crier au loup.
  if (a >= SEUIL_APPELS) return 'mort';
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
 * Compte les deux témoins dans un extrait de transcript.
 * ⚠️ Tolérant aux lignes TRONQUÉES : la fenêtre coupe le fichier au milieu
 *    d'une ligne par construction. On compte des SOUS-CHAÎNES, jamais du JSON
 *    parsé — parser exigerait des lignes entières et rendrait le canari fragile
 *    au découpage, pour zéro gain.
 */
// ⚠️ `marqueAppel` est un PARAMÈTRE, jamais une constante d'ici : c'est le
//    dialecte du harnais (cf ci-dessus). La coquille le fournit.
function compter(extrait, marqueAppel) {
  // ⚠️ Sortie ANTICIPÉE plutôt qu'un repli sur `''` : le repli introduisait une
  //    chaîne ARBITRAIRE que rien ne peut observer (n'importe quel texte sans
  //    les deux marques donne le même résultat) ⇒ mutant équivalent. Ici, le
  //    zéro est une valeur de contrat, donc testable.
  if (typeof extrait !== 'string' || typeof marqueAppel !== 'string' || marqueAppel === '') {
    return { appels: 0, injections: 0 };
  }
  return { appels: occurrences(extrait, marqueAppel), injections: occurrences(extrait, MARQUE_INJECTION) };
}

// ⚠️ Comptage par `indexOf` et non par regex : les deux marques contiennent des
//    caractères spéciaux (`[`, `"`), et une regex construite par concaténation
//    serait une porte ouverte à l'échappement oublié. Ici, rien à échapper.
function occurrences(s, marque) {
  let n = 0;
  let k = s.indexOf(marque);
  while (k !== -1) {
    n++;
    k = s.indexOf(marque, k + marque.length);
  }
  return n;
}

module.exports = { verdict, etiquette, compter, SEUIL_APPELS, FENETRE_OCTETS, MARQUE_INJECTION };
