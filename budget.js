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

// Coût FIXE du scellement (en-tête + pied), hors contenu et hors annonce.
// ⚠️ DÉRIVÉ, jamais une constante recopiée : l'en-tête est du texte qui peut
//    être reformulé, et une valeur en dur divergerait en silence — le budget
//    deviendrait faux sans que rien ne rougisse. Sert au calibrage des tests
//    et à toute coquille qui veut dimensionner sa trame.
function tailleEnveloppe() {
  const m = '0'.repeat(TAILLE_MARQUEUR);
  return enTete(m).length + pied(m).length;
}

module.exports = { planifier, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe };
