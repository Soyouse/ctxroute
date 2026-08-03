// ═══════════════════════════════════════════════════════════════════════
// BUDGET D'ÉMISSION — ce qui sort tient dans une trame, ou il est ANNONCÉ.
// ═══════════════════════════════════════════════════════════════════════
//
// RAISON D'ÊTRE (31/07/2026, défaut VÉCU) : tout harnais borne la taille d'une
// injection. Au-delà, il RANGE le contenu dans un fichier et n'en montre qu'un
// aperçu — sans prévenir le producteur. L'agent reçoit une intro en croyant
// tenir le contrat. C'est le « vert qui ment » que ce framework existe pour
// supprimer. MESURÉ le 31/07/2026 sur Claude Code 2.1.220 : seuil de 10 000
// caractères par hook et par champ (`BYe(..., n = TCu)`, TCu = 1e4), au-delà
// duquel la sortie part dans `tool-results/hook-<id>-<n>-additionalContext.txt`.
//
// ⚠️ CE MODULE NE CONNAÎT AUCUN SEUIL DE HARNAIS, ET NE DOIT JAMAIS EN CONNAÎTRE.
//    Il reçoit un BUDGET (nombre de caractères) et s'y tient. Le seuil réel de
//    Claude Code / Codex / du harnais suivant est une donnée de la COQUILLE :
//    y coder `10000` ferait entrer un dialecte dans le noyau et casserait le
//    portage — exactement ce que `sources-must-not-know-the-harness` interdit
//    déjà pour les sources. Un seuil piloté à distance (feature-gate
//    `tengu_velvet_ibis`, indexé par outil) peut CHANGER SANS MISE À JOUR :
//    le lire serait bâtir sur du sable.
//
// ⚠️ UNITÉ = LE CARACTÈRE, jamais le token. C'est ce que le harnais compte
//    lui-même (`e.length <= n`) ; le token est une ESTIMATION (chars/4 chez
//    Claude Code) et varie d'un harnais à l'autre. Compter en tokens
//    introduirait une imprécision là où le mur est exact.
//
// ⚠️ UN SEGMENT EST INDIVISIBLE : il passe ENTIER ou il est ANNONCÉ. Ne JAMAIS
//    couper une doc en son milieu — une doc amputée a l'air complète, donc elle
//    ment ; une doc annoncée est lisible sur disque. C'est tout l'écart entre
//    « dégrader le livrable » et « le transporter correctement ».
//
// ⚠️ LE SCEAU EST LA GARANTIE DE DERNIER RECOURS, et il ne suppose AUCUN seuil.
//    L'en-tête annonce un marqueur de fin ; le marqueur ferme le bloc. Marqueur
//    absent à la lecture ⇒ le harnais a tronqué, l'agent le SAIT et va lire les
//    fichiers cités. Que le mur soit à 10 000, 2 000 ou 400 000, le mécanisme
//    est identique : c'est ce qui rend la perte SILENCIEUSE structurellement
//    impossible, même si le budget se révélait mal calibré un jour.
//    ⚠️ L'en-tête est en TÊTE par NÉCESSITÉ : une troncature garde le DÉBUT
//    (`slice(0, n)` chez tout harnais mesuré). Le déplacer en pied le rendrait
//    inopérant précisément dans le cas qu'il couvre.
//
// ⚠️ PUR : zéro I/O, zéro état, zéro horloge, zéro aléa. C'est la CONDITION
//    pour la mutation Stryker sans mutants équivalents ET pour le property-based
//    (fast-check) qui prouve la CONSERVATION sur entrées générées.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Défaut FRAMEWORK (autorité ① de la cascade — existe même sans config JSON).
// ⚠️ C'est une MARGE, pas une copie d'un seuil : délibérément sous le plus bas
//    seuil mesuré du parc de harnais (10 000 sur Claude Code 2.1.220), pour
//    survivre à un abaissement distant sans rien changer chez nous. Le monter
//    au niveau du seuil supprimerait la marge et nous remettrait à la merci
//    d'un feature-gate.
const DEFAUT_BUDGET = 8000;

const SEPARATEUR = '\n\n---\n\n';

// Fraction du budget au-delà de laquelle on SCELLE (en-tête + marqueur de fin).
// ⚠️ En dessous, le rendu est celui d'AVANT ce chantier, à l'octet — c'est ce
//    qui rend la bascule sûre pour les agents déjà en cours. Au-dessus, on
//    approche du mur du harnais et le sceau devient la seule garantie contre
//    une troncature muette. Ne PAS monter à 1 : le sceau arriverait tout juste
//    au moment où il est déjà trop tard pour tenir dans la trame.
const SEUIL_SCEAU_RATIO = 0.5;

// Longueur du marqueur (hex). Fixe : l'overhead doit être calculable AVANT
// de choisir les segments, sinon le budget ne serait pas une borne sûre.
const TAILLE_MARQUEUR = 8;

// ⚠️ Hash MAISON (djb2 xor) et non `crypto` : ce module doit rester importable
//    par n'importe quel harnais sans dépendance, et PUR. Il ne sert PAS à la
//    sécurité — seulement à donner un marqueur stable et déterministe, donc
//    testable et reproductible en property-based.
function empreinte(texte) {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0;
  // ⚠️ `>>> 0` borne h à 32 bits ⇒ AU PLUS 8 chiffres hexadécimaux. Le
  //    `padStart` suffit donc à garantir la longueur, et un `slice` de
  //    sécurité serait du code MORT (mutant équivalent : intuable par
  //    construction). On supprime plutôt que de subir un survivant éternel.
  return h.toString(16).padStart(TAILLE_MARQUEUR, '0');
}

function enTete(marqueur) {
  return (
    '⚠️ INJECTION SCELLÉE — ce bloc se termine par ###FIN:' + marqueur + '###\n' +
    "   Marqueur absent en fin de bloc = contenu TRONQUÉ par le harnais :\n" +
    '   lis alors toi-même les fichiers cités ci-dessous. Ne devine pas.\n\n'
  );
}

function pied(marqueur) {
  return '\n\n###FIN:' + marqueur + '###';
}

// Annonce des segments qui ne rentrent pas. ⚠️ JAMAIS un silence : c'est la
// ligne qui transforme une perte invisible en action possible.
function annonce(differes) {
  if (differes.length === 0) return '';
  const lignes = differes.map((s) => '   - ' + s.label);
  return (
    '\n\n⚠️ ' + differes.length + ' doc(s) NON injectée(s) faute de place dans cette trame.\n' +
    '   Elles ne sont PAS optionnelles — lis-les si ton geste les touche :\n' +
    lignes.join('\n')
  );
}

// Compose le rendu pour un nombre `k` de segments retenus (les k premiers, donc
// les mieux classés — l'ordre d'entrée PORTE la priorité `rank`, jamais recalculée ici).
function composer(segments, k) {
  const retenus = segments.slice(0, k);
  const differes = segments.slice(k);
  const corps = retenus.map((s) => s.text).join(SEPARATEUR);
  // Marqueur = jeton d'intégrité INTRA-bloc (en-tête ⟷ pied). Deux blocs
  // distincts peuvent partager un marqueur sans conséquence : rien ne compare
  // jamais deux blocs entre eux. Pas de séparateur décoratif ⇒ pas de code
  // qu'aucun test ne peut distinguer.
  const marqueur = empreinte(corps + differes.length);
  const texte = enTete(marqueur) + corps + annonce(differes) + pied(marqueur);
  return { texte, marqueur, retenus, differes };
}

/**
 * Décide ce qui sort dans cette trame.
 *
 * @param {{id:string,text:string,label:string}[]} segments — ordonnés par priorité décroissante.
 * @param {number} budget — caractères. Fourni par la COQUILLE (jamais deviné ici).
 * @returns {{texte:string, emis:string[], differes:{id,label}[], marqueur:string}}
 *
 * ⚠️ INVARIANT DE CONSERVATION (prouvé en property-based) : tout segment entré
 *    ressort SOIT dans `emis`, SOIT dans `differes`. Jamais perdu, jamais
 *    dupliqué. C'est LA promesse du framework — un segment qui disparaîtrait
 *    ici serait la régression silencieuse que tout le reste combat.
 */
function planifier(segments, budget) {
  const liste = Array.isArray(segments) ? segments : [];
  const max = Number.isFinite(budget) && budget > 0 ? budget : DEFAUT_BUDGET;

  // ⚠️ Pas de court-circuit « liste vide » : le chemin nominal ci-dessous rend
  //    déjà exactement `{texte:'', emis:[], differes:[], marqueur:''}` pour une
  //    liste vide (corps vide ⇒ toujours sous le seuil de scellement). Un
  //    early-return serait du code MORT — intuable, donc survivant éternel.

  // ── CHEMIN NOMINAL : format HISTORIQUE, à l'octet ──
  // ⚠️ Le scellement ne se déclenche QUE près du mur. Raison de fond (contrat
  //    d'extension, point 6) : « comportement par défaut = comportement
  //    d'AVANT ». Une injection courte n'a JAMAIS été tronquée — lui coller une
  //    enveloppe coûterait ~250 caractères sur CHAQUE geste de CHAQUE agent, et
  //    ferait diverger le différentiel sur 347 docs pour couvrir un risque nul.
  // ⚠️ La marge (moitié du budget, lui-même déjà sous le seuil du harnais)
  //    absorbe un effondrement du seuil distant sans nous laisser à découvert.
  const corpsSeul = liste.map((s) => s.text).join(SEPARATEUR);
  if (corpsSeul.length <= max * SEUIL_SCEAU_RATIO) {
    return { texte: corpsSeul, emis: liste.map((s) => s.id), differes: [], marqueur: '' };
  }

  // On part du TOUT et on retire le moins prioritaire jusqu'à tenir.
  // ⚠️ Décroissant et non croissant : l'annonce GROSSIT quand on retire, donc
  //    la taille finale n'est pas monotone en k — un simple empilement pourrait
  //    dépasser en ajoutant la ligne d'annonce. Ce sens-ci converge toujours.
  for (let k = liste.length; k >= 1; k--) {
    const r = composer(liste, k);
    if (r.texte.length <= max) {
      return { texte: r.texte, emis: r.retenus.map((s) => s.id), differes: r.differes, marqueur: r.marqueur };
    }
  }

  // Rien ne rentre (un seul segment dépasse déjà à lui seul). On émet l'ANNONCE
  // NUE : elle est minuscule et dit où lire. ⚠️ Ne JAMAIS émettre le segment
  // tronqué à la place — ce serait rendre au harnais exactement le pavé qu'il
  // coupe en silence, c'est-à-dire le défaut d'origine.
  const r = composer(liste, 0);
  return { texte: r.texte, emis: [], differes: r.differes, marqueur: r.marqueur };
}

// ═══════════════════════════════════════════════════════════════════════
// PAQUETS — quand une trame ne suffit pas, on en utilise PLUSIEURS.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CE N'EST PAS DE LA FRAGMENTATION IP, C'EST DE LA SEGMENTATION TCP/MSS.
//    RFC 8900 déconseille de bâtir sur la fragmentation IP, mais ses 9 causes
//    de fragilité sont TOUTES des équipements intermédiaires (NAT, pare-feu
//    sans état, ECMP, collisions d'ID de réassemblage) — il n'y en a AUCUN
//    ici : hook → harnais → contexte. Sa recommandation de fond (« push
//    fragmentation responsibilities upward to layers that understand
//    application semantics ») est précisément ce qu'on fait : on répartit des
//    SEGMENTS ENTIERS (une doc), on ne coupe JAMAIS au milieu.
//
// ⚠️ AUCUNE DÉCOUVERTE DE PLAFOND, JAMAIS (RFC 8899 / PLPMTUD). Le PMTUD
//    classique casse parce qu'il dépend d'un signal de retour filtré ⇒ trou
//    noir. Le fichier de spill du harnais serait NOTRE ICMP, en pire : aucun
//    canal de retour, l'unique récepteur est l'agent. La réponse de la RFC est
//    un PLANCHER conservateur (`DEFAUT_BUDGET`) + la NÉGOCIATION là où elle
//    existe (Codex : `additionalContextLimit: 0`) — jamais du sondage aveugle.
//
// ⚠️ PAQUET AUTO-DESCRIPTIF, OBLIGATOIRE. Les N hooks tournent EN PARALLÈLE :
//    l'ordre d'arrivée dans le contexte n'est PAS garanti (RFC 8899 exige la
//    robustesse au réordonnancement). Sans `k/N` + marqueur COMMUN, un paquet
//    manquant est indétectable — c'est-à-dire la perte SILENCIEUSE que tout ce
//    module existe pour rendre impossible. NE JAMAIS retirer le numéro.
//
// ⚠️ DÉTERMINISME = LA CONDITION DE VIE DU MÉCANISME. Les N processus ne
//    peuvent pas se parler ; chacun recalcule le découpage ENTIER et n'émet que
//    son indice. Toute source de non-déterminisme ici (horloge, aléa, ordre
//    d'itération instable, lecture d'état) ferait diverger les paquets entre
//    processus. C'est pourquoi cette fonction est PURE et le restera.
//    ⚠️ Corollaire côté appelant : les N processus DOIVENT recevoir les MÊMES
//    segments. `gate.decide` écrivant l'état, `porte-core` MÉMOÏSE le plan par
//    invocation — sans quoi le 1er consomme les `once` et les suivants ne
//    décident plus rien. Voir REFACTOR-PLAN §PAQUETS.
// ═══════════════════════════════════════════════════════════════════════

function enTetePaquet(marqueur, k, n) {
  return (
    '⚠️ INJECTION SCELLÉE — PAQUET ' + k + '/' + n + ', fin marquée ###FIN:' + marqueur + '###\n' +
    '   Les ' + n + ' paquets portent le MÊME marqueur et arrivent DANS LE DÉSORDRE : recolle-les par leur numéro.\n' +
    '   Un numéro qui manque, ou un marqueur absent = contenu tronqué par le harnais :\n' +
    '   lis alors toi-même les fichiers cités ci-dessous. Ne devine pas.\n\n'
  );
}

// Rendu d'UN paquet. `differes` n'est jamais non-vide que sur le DERNIER.
function composerPaquet(retenus, differes, k, n, marqueur) {
  const corps = retenus.map((s) => s.text).join(SEPARATEUR);
  return enTetePaquet(marqueur, k, n) + corps + annonce(differes) + pied(marqueur);
}

function paquetVide() {
  return { texte: '', emis: [], differes: [], marqueur: '' };
}

/**
 * Découpe en `nbPaquets` trames. Chaque appelant (processus) prend SON indice.
 *
 * @returns {{texte:string, emis:string[], differes:{id,label}[], marqueur:string}[]}
 *          Tableau de longueur `nbPaquets` (indice 0 = paquet 1/N).
 *
 * ⚠️ INVARIANT DE CONSERVATION, RENFORCÉ : tout segment entré est dans
 *    EXACTEMENT UN paquet, ou dans l'annonce du dernier. Jamais perdu, jamais
 *    DUPLIQUÉ entre deux paquets (un doublon coûterait deux fois les tokens et
 *    ferait douter l'agent de l'intégrité du recollage).
 *
 * ⚠️ PARITÉ (contrat d'extension §6) : le mode multi-paquets ne s'engage QUE si
 *    une éviction aurait eu lieu en trame unique. Tout ce qui passe aujourd'hui
 *    sort EXACTEMENT comme aujourd'hui, à l'octet — la bascule ne peut donc
 *    modifier que des cas qui étaient DÉJÀ cassés. Ne PAS « simplifier » en
 *    passant systématiquement par le chemin paquets.
 */
function planifierPaquets(segments, budget, nbPaquets) {
  const liste = Array.isArray(segments) ? segments : [];
  const max = Number.isFinite(budget) && budget > 0 ? budget : DEFAUT_BUDGET;
  const n = Number.isInteger(nbPaquets) && nbPaquets > 1 ? nbPaquets : 1;

  // ── CHEMIN DE PARITÉ ── tient en une trame ⇒ comportement d'avant, à l'octet.
  const solo = planifier(liste, max);
  if (n === 1 || solo.differes.length === 0) {
    const out = [solo];
    for (let i = 1; i < n; i++) out.push(paquetVide());
    return out;
  }

  // Marqueur COMMUN aux N paquets : il identifie l'ÉMISSION, pas le bloc.
  // Dérivé du contenu entier ⇒ identique dans les N processus (déterminisme).
  const marqueur = empreinte(liste.map((s) => s.text).join(SEPARATEUR) + n);

  // Un segment qui ne rentre seul dans AUCUN paquet ne rentrera jamais : il
  // part en annonce d'emblée. ⚠️ Le sortir ICI (et non pendant le remplissage)
  // évite qu'il bloque une trame entière en la laissant vide.
  // Overhead calculé au PIRE cas (`n/n`, le plus large en chiffres) : borne
  // sûre, jamais optimiste.
  const utiles = [];
  const impossibles = [];
  for (const s of liste) {
    if (composerPaquet([s], [], n, n, marqueur).length > max) impossibles.push(s);
    else utiles.push(s);
  }

  const groupes = [];
  let reste = utiles.slice();
  // Paquets 1..N-1 : remplissage glouton, ordre de priorité PRÉSERVÉ (l'ordre
  // d'entrée PORTE le rank — ne jamais retrier ici).
  for (let i = 0; i < n - 1; i++) {
    const retenus = [];
    while (reste.length > 0 && composerPaquet(retenus.concat([reste[0]]), [], i + 1, n, marqueur).length <= max) {
      retenus.push(reste.shift());
    }
    groupes.push(retenus);
  }

  // DERNIER paquet : il porte l'annonce de tout ce qui n'a pas trouvé de place.
  // ⚠️ Décroissant, même raison que `planifier` : l'annonce GROSSIT quand on
  //    retire, la taille finale n'est donc pas monotone.
  let dernier = [];
  let differesFinaux = reste.concat(impossibles);
  for (let k = reste.length; k >= 0; k--) {
    const essai = reste.slice(0, k);
    const laisses = reste.slice(k).concat(impossibles);
    if (composerPaquet(essai, laisses, n, n, marqueur).length <= max) {
      dernier = essai;
      differesFinaux = laisses;
      break;
    }
  }
  groupes.push(dernier);

  return groupes.map((retenus, i) => {
    const differes = i === n - 1 ? differesFinaux : [];
    // ⚠️ Un paquet SANS contenu ET SANS annonce n'est PAS émis (texte vide ⇒ la
    //    coquille sort en silence). Émettre une enveloppe vide coûterait des
    //    tokens pour annoncer du néant, à chaque geste.
    if (retenus.length === 0 && differes.length === 0) return paquetVide();
    return {
      texte: composerPaquet(retenus, differes, i + 1, n, marqueur),
      emis: retenus.map((s) => s.id),
      differes,
      marqueur,
    };
  });
}

// Coût FIXE du scellement (en-tête + pied), hors contenu et hors annonce.
// ⚠️ DÉRIVÉ, jamais une constante recopiée : l'en-tête est du texte qui peut
//    être reformulé, et une valeur en dur divergerait en silence — le budget
//    deviendrait faux sans que rien ne rougisse. Sert au calibrage des tests
//    et à toute coquille qui veut dimensionner sa trame.
function tailleEnveloppe() {
  const m = '0'.repeat(TAILLE_MARQUEUR);
  return enTete(m).length + pied(m).length;
}

module.exports = { planifier, planifierPaquets, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe };
