// ═══════════════════════════════════════════════════════════════════════
// BUDGET D'ÉMISSION — TOUT SORT. Ce qui ne tient pas dans une trame est
// MORCELÉ et réparti ; rien n'est jamais refusé pour sa taille.
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
// ⚠️ LE FRAMEWORK LIVRE — IL NE JUGE JAMAIS LA TAILLE (décision du mainteneur,
//    03/08/2026). Une doc plus lourde qu'une trame est MORCELÉE et livrée ;
//    l'indélivrabilité est IMPOSSIBLE PAR CONSTRUCTION. Refuser de livrer, ou
//    exiger que l'auteur raccourcisse, ce serait lui faire porter un défaut du
//    TRANSPORT.
//    ⚠️ HISTORIQUE, à ne pas restaurer : la règle était « un segment est
//    INDIVISIBLE, il passe entier ou il est annoncé », justifiée par « une doc
//    amputée a l'air complète, donc elle ment ». Cette justification est MORTE
//    avec les paquets : chaque morceau porte `MORCEAU j/m` et voyage dans une
//    trame numérotée `k/N` au marqueur commun — il s'annonce comme fragment et
//    le recollage est vérifiable. Ce qui reste interdit, c'est de couper SANS
//    le dire.
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

// Annonce des segments qui ne tiennent pas dans CETTE émission.
//
// ⚠️ SÉMANTIQUE CHANGÉE LE 05/08/2026 — ce n'est plus une PERTE, c'est un DÉLAI.
//    Le texte disait « NON injectée(s) faute de place » : c'était vrai tant que
//    l'appelant JETAIT le reliquat. Il le met désormais en FILE et le ré-émet
//    aux appels suivants (`porte-core.js`, préfixe `reliquat-`) — exactement ce
//    que fait un émetteur TCP quand la fenêtre est pleine : il DIFFÈRE, il ne
//    jette pas. Annoncer une perte là où il n'y a qu'une attente ferait courir
//    l'agent après des docs qui arrivent toutes seules au geste suivant.
// ⚠️ UNE SEULE ANNONCE POUR LES DEUX CHEMINS (trame unique ET dernier paquet) :
//    il y en avait deux (`annonce` / `annonceConfig`) parce qu'elles disaient
//    des choses DIFFÉRENTES (« pas de place » vs « `--paquets N` trop petit »).
//    Les deux causes ont fusionné en une seule — la fenêtre est pleine — donc
//    les deux textes devaient fusionner aussi (loi anti-synonyme : un concept,
//    un mot). 🛑 NE PAS réintroduire un message qui accuse la CONFIGURATION :
//    `--paquets N` n'est plus un plafond de livraison, seulement un débit.
// ⚠️ JAMAIS un silence pour autant : une doc retenue doit être NOMMÉE, sinon
//    l'agent ne peut pas savoir qu'il lui manque quelque chose s'il agit tout
//    de suite. C'est la ligne qui garde le différé HONNÊTE.
// Nombre maximal de documents CITÉS. ⚠️ Ce n'est PAS un plafond de livraison :
//    tout est livré quoi qu'il arrive, seule la LISTE est bornée.
const MAX_CITES = 5;

function annonce(differes) {
  if (differes.length === 0) return '';
  // ⚠️ ON COMPTE DES DOCUMENTS, PAS DES MORCEAUX (bug MESURÉ le 05/08/2026).
  //    Un différé est un morceau (`doc#1`, `doc#2`…) : une doc de 5 000 c sur un
  //    budget de 600 en produit 56. La liste faisait donc 56 lignes et
  //    DÉPASSAIT la trame à elle seule ⇒ plus aucune place pour du contenu ⇒
  //    zéro émission ⇒ avec la file, une BOUCLE INFINIE (le même reliquat
  //    représenté à chaque geste, éternellement). Dédupliquer par label ramène
  //    ça à 1 ligne par document, ce qui est AUSSI la seule chose qui intéresse
  //    le lecteur : « il me manque telle doc », jamais « il me manque le
  //    morceau 37 ».
  const labels = [...new Set(differes.map((s) => s.label))];
  // ⚠️ LISTE BORNÉE : même dédupliquée, 300 docs feraient 300 lignes et le même
  //    étouffement. L'annonce est INFORMATIVE (la file, elle, est la garantie) —
  //    elle ne doit jamais pouvoir manger la trame qu'elle décrit.
  const lignes = labels.slice(0, MAX_CITES).map((l) => '   - ' + l);
  if (labels.length > MAX_CITES) lignes.push('   - … et ' + (labels.length - MAX_CITES) + ' autre(s)');
  return (
    '\n\n⚠️ ' + labels.length + ' doc(s) DIFFÉRÉE(S) — la trame est pleine, elles suivent au(x) prochain(s) appel(s) d\'outil.\n' +
    "   Rien n'est perdu : elles sont en file, dans l'ordre. Si ton geste les touche MAINTENANT, lis-les :\n" +
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
// Normalisation du budget — SOURCE UNIQUE (autorité ① de la cascade).
// ⚠️ NE JAMAIS la recopier chez un appelant : `planifier` la ré-appliquant en
//    interne, une 2ᵉ copie devient une garde REDONDANTE — donc un mutant
//    ÉQUIVALENT, donc un survivant éternel (mesuré 03/08/2026 : 4 survivants
//    dus exactement à ça). Un seul endroit décide, un seul endroit se teste.
// ⚠️ `Infinity` = « AUCUNE LIMITE », valeur LÉGITIME depuis le 05/08/2026 — pas
//    un accident à filtrer. Un harnais peut DÉCLARER qu'il ne borne rien :
//    mesuré dans le binaire Codex 0.146.0, `additionalContextLimit = 0` signifie
//    littéralement « disables spilling », donc livraison intégrale. Sans ce
//    chemin, `Number.isFinite` rejetait l'infini et retombait sur le PLANCHER de
//    8 000 : on morcelait un skill en 7 trames alors que le tuyau acceptait tout
//    d'un bloc — dégradation SILENCIEUSE, tout restait vert. Ne JAMAIS revenir à
//    un simple `Number.isFinite` ici.
// ⚠️ Budget infini ⇒ tout tient dans une trame ⇒ ni sceau ni morcelage ⇒ rendu
//    HISTORIQUE à l'octet. C'est la parité, pas un cas particulier.
function budgetEffectif(budget) {
  if (budget === Infinity) return Infinity;
  return Number.isFinite(budget) && budget > 0 ? budget : DEFAUT_BUDGET;
}

function planifier(segments, budget) {
  const liste = Array.isArray(segments) ? segments : [];
  const max = budgetEffectif(budget);

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
  // NUE : elle est minuscule et dit ce qui suit.
  // ⚠️ JUSTIFICATION RÉÉCRITE LE 05/08/2026 — l'ancienne était FAUSSE. Elle
  //    disait : « ne JAMAIS émettre le segment tronqué, ce serait rendre au
  //    harnais le pavé qu'il coupe EN SILENCE ». Or la doc officielle de Claude
  //    Code (lue ce jour) établit que le dépassement n'est PAS silencieux : le
  //    harnais range le surplus dans un fichier et en donne le chemin. La
  //    prémisse est tombée ; la CONCLUSION reste juste, pour une raison
  //    entièrement différente et qui, elle, ne dépend d'AUCUN harnais :
  //    **ce qui ne sort pas ici n'est pas perdu — l'appelant le met en file et
  //    le ré-émet au geste suivant** (`porte-core.js`). Émettre un pavé tronqué
  //    ferait arriver DEUX fois le même début (une fois coupé, une fois par la
  //    file) et casserait le recollage. Le respect de la borne EST ce qui rend
  //    la file cohérente.
  // 🛑 Ne pas « optimiser » en gonflant cette trame parce que le harnais a un
  //    filet : dépendre de son filet, c'est bâtir sur ce qu'il peut retirer
  //    demain sans dépréciation (cf CONTRAT, budget.md).
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

// ⚠️ `annonceConfig()` SUPPRIMÉE le 05/08/2026 — elle disait « le nombre de
//    paquets déclarés est TROP PETIT · augmente `--paquets N` ». Ce message
//    était FAUX dans sa cause ET dans son remède :
//    · sa CAUSE supposait que `--paquets N` soit un plafond de LIVRAISON. Ce
//      n'est plus qu'un DÉBIT : ce qui ne tient pas dans cette émission part en
//      file et arrive au geste suivant (`porte-core.js`). Rien n'est « non émis ».
//    · son REMÈDE demandait à l'OPÉRATEUR de reconfigurer pour un phénomène
//      normal de transport — la fenêtre est pleine, c'est tout. Un système qui
//      réclame une intervention humaine à chaque flux un peu gros est
//      exactement le toil que ce framework existe pour supprimer.
//    Les deux chemins (trame unique / dernier paquet) partagent donc `annonce()`.
// Rendu d'UN paquet. `reliquat` n'est jamais non-vide que sur le DERNIER.
//
// ⚠️ `scelle=false` ⇒ ENVELOPPE OMISE. C'EST L'ENVELOPPE QUI CÈDE, JAMAIS LE
//    CONTENU (bug RÉEL du 03/08/2026 : avec un budget plus petit que l'enveloppe
//    elle-même, AUCUNE doc ne sortait et le message accusait `--paquets N` — un
//    « trop petit » inventé, et un message qui MENT sur sa cause). Le scellement
//    est un CONFORT de détection ; livrer est le CONTRAT. Quand les deux ne
//    tiennent pas ensemble, on livre. Dégradation EXPLICITE, jamais un silence.
// ⚠️ `n === 1` ⇒ EN-TÊTE SIMPLE, jamais l'en-tête de paquet (05/08/2026).
//    Depuis que la trame unique morcelle elle aussi (cf `planifierPaquets`), ce
//    chemin sert AUSSI aux harnais sans multi-trames. Or `enTetePaquet` dirait
//    « les 1 paquets arrivent DANS LE DÉSORDRE, recolle-les par leur numéro » :
//    une consigne absurde et FAUSSE pour une trame seule. Un récepteur qui suit
//    une consigne fausse est pire qu'un récepteur non informé.
function composerPaquet(retenus, reliquat, k, n, marqueur, scelle) {
  const corps = retenus.map((s) => s.text).join(SEPARATEUR);
  if (!scelle) return corps + annonce(reliquat);
  const tete = n >= 2 ? enTetePaquet(marqueur, k, n) : enTete(marqueur);
  return tete + corps + annonce(reliquat) + pied(marqueur);
}

// En-tête d'un MORCEAU de doc (uniquement quand une doc est répartie sur
// plusieurs trames). ⚠️ Sans lui, un agent recevrait un fragment qui a l'air
// d'être la doc entière — le mensonge exact que tout ce module empêche.
// ⚠️ LES 3 CHAMPS DU MOTIF STANDARD (RFC 2046 `message/partial` : `id`,
//    `number` qui commence à 1, `total` ; RFC 6455 : marqueur de fin). Ce sont
//    EXACTEMENT les informations dont un récepteur a besoin pour recoller sans
//    ambiguïté : à qui ça appartient, où ça va, quand c'est complet.
//    N'en retirer AUCUN — chacun supprime une garantie de réassemblage.
function enTeteMorceau(label, j, m) {
  return '⟦ ' + label + ' — MORCEAU ' + j + '/' + m + ' : recolle les ' + m + ' morceaux dans l\'ordre avant de lire ⟧\n';
}

/**
 * Découpe les segments trop lourds en MORCEAUX livrables.
 *
 * ⚠️ RAISON D'ÊTRE (03/08/2026, décision du mainteneur) : **le framework LIVRE, point.**
 *    Il n'a pas à décréter qu'un contenu est trop gros — ce serait faire porter
 *    à l'auteur un défaut du transport. Avant, un segment était INDIVISIBLE et
 *    une doc plus lourde qu'une trame n'arrivait JAMAIS. Ce n'est plus le cas :
 *    l'indélivrabilité est désormais IMPOSSIBLE PAR CONSTRUCTION.
 *
 * ⚠️ CE QUI RENDAIT L'INDIVISIBILITÉ NÉCESSAIRE A DISPARU. La règle disait :
 *    « une doc amputée a l'air complète, donc elle ment ». C'était vrai AVANT
 *    les paquets. Maintenant chaque morceau porte `MORCEAU j/m` et voyage dans
 *    un paquet numéroté `k/N` au marqueur commun : le fragment s'ANNONCE comme
 *    fragment et le recollage est vérifiable. Plus de mensonge possible.
 *    ⚠️ NE JAMAIS retirer l'en-tête de morceau — c'est LUI qui fait la
 *    différence entre « découpé » et « amputé ».
 *
 * ⚠️ Découpe par CARACTÈRES (l'unité que le harnais compte), pas par lignes :
 *    une seule ligne peut à elle seule dépasser une trame.
 */
function morceler(segments, capacite) {
  const morceaux = [];
  for (const s of segments) {
    // ── CHEMIN 1 : ça rentre ⇒ on n'y touche pas. Aucun en-tête, aucune boucle.
    if (s.text.length <= capacite) { morceaux.push(s); continue; }

    // ── CHEMIN 2 : ça ne rentre pas ⇒ on découpe. Il n'y a pas de chemin 3.
    // ⚠️ La place de l'en-tête est retirée de la capacité (largeur au PIRE cas,
    //    3 chiffres) : sinon le morceau composé dépasserait la trame et la
    //    borne serait fausse. `Math.max(1, …)` garantit une progression stricte
    //    quelle que soit la trame — sans lui, une capacité minuscule ferait une
    //    boucle infinie ou ferait DISPARAÎTRE le contenu (bug réel, 03/08/2026).
    // ⚠️ L'EN-TÊTE DE MORCEAU CÈDE QUAND IL NE TIENT PAS — même doctrine que le
    //    sceau : **livrer passe avant décrire.** Défaut PRÉEXISTANT révélé le
    //    05/08/2026 : `Math.max(1, capacite - entête)` garantissait 1 caractère
    //    utile, mais le morceau RENDU valait alors `entête + 1` — donc PLUS GROS
    //    que la capacité qu'il est censé respecter. Personne ne le voyait parce
    //    que rien n'obligeait à émettre ce morceau ; la garantie de progrès, si.
    //    Résultat mesuré : une trame de 419 c pour un budget de 340.
    // ⚠️ Sans en-tête, le morceau perd son `j/m` — c'est une PERTE DE
    //    DESCRIPTION, jamais de contenu, et elle ne survient que sous une trame
    //    plus petite que l'en-tête lui-même (régime absurde, hors production).
    //    L'alternative serait un morceau indélivrable : le choix est fait.
    // 🛑 Ne PAS « rétablir l'en-tête partout par principe » : ça réintroduirait
    //    un morceau qui dépasse sa propre borne, donc une trame émise au-dessus
    //    du budget — exactement ce que tout ce module empêche.
    const largeurEntete = enTeteMorceau(s.label, 999, 999).length;
    const avecEntete = capacite > largeurEntete;
    const utile = avecEntete ? capacite - largeurEntete : Math.max(1, capacite);

    // Découpe sur FRONTIÈRES DE LIGNES (RFC 2046 § message/partial) : couper au
    // milieu d'une ligne casse la lisibilité pour rien. Une ligne plus longue
    // qu'une trame est coupée net — c'est le seul cas où on tranche dans le mot.
    const tranches = [];
    let courante = '';
    for (const ligne of s.text.split('\n')) {
      let l = ligne;
      // ⚠️ ÉQUIVALENT PROUVÉ, ne pas chercher à le tuer : `>=` rend EXACTEMENT
      //    la même découpe. Raison : une ligne longue de `utile` PILE ne peut
      //    fusionner avec rien (tout ajout la ferait dépasser), donc la pousser
      //    tout de suite ou la garder en tampon produit la même suite. Vérifié
      //    par différentiel exhaustif le 03/08/2026 : 200 000 entrées aléatoires
      //    (longueurs de lignes 0-8, `utile` 1-6), ZÉRO divergence.
      //    On garde `>` : c'est la forme qui dit « ne rentre pas », le sens réel.
      // Stryker disable next-line EqualityOperator
      while (l.length > utile) { // ligne monstre : on la débite
        if (courante) { tranches.push(courante); courante = ''; }
        tranches.push(l.slice(0, utile));
        l = l.slice(utile);
      }
      const candidate = courante ? courante + '\n' + l : l;
      if (candidate.length > utile) { tranches.push(courante); courante = l; }
      else courante = candidate;
    }
    if (courante) tranches.push(courante);

    const m = tranches.length;
    tranches.forEach((t, j) => {
      morceaux.push({
        id: s.id + '#' + (j + 1),
        label: s.label,
        text: (avecEntete ? enTeteMorceau(s.label, j + 1, m) : '') + t,
      });
    });
  }
  return morceaux;
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
  const max = budgetEffectif(budget); // cf. SOURCE UNIQUE — ne jamais recopier la cascade ici
  // ⚠️ `>= 2` et NON `> 1` : les deux sont sémantiquement identiques, mais
  //    `> 1` rend le mutant `>= 1` ÉQUIVALENT (à `nbPaquets = 1` les deux
  //    branches rendent 1) donc INTUABLE. Avec `>= 2`, le mutant `> 2` change
  //    le résultat dès 2 paquets et meurt. Écrire la forme TESTABLE, toujours.
  const n = Number.isInteger(nbPaquets) && nbPaquets >= 2 ? nbPaquets : 1;

  // ── CHEMIN DE PARITÉ ── tient en une trame ⇒ comportement d'avant, à l'octet.
  // ⚠️ LA CONDITION `n === 1 ||` A ÉTÉ RETIRÉE LE 05/08/2026 — c'était un TROU,
  //    et le seul qui rendait une doc RÉELLEMENT indélivrable.
  //    Avant : `n === 1` renvoyait le résultat de `planifier`, qui ne morcelle
  //    PAS. Une doc plus lourde que la trame sortait donc à ZÉRO contenu, juste
  //    annoncée — pour toujours. Sans file c'était une perte ; AVEC la file
  //    c'est pire, une BOUCLE : le même reliquat serait représenté à chaque
  //    geste sans jamais progresser d'un octet.
  //    Maintenant : dès qu'il y a du surplus, on passe par le morcelage, même à
  //    une seule trame. La boucle des paquets 1..N-1 tourne alors zéro fois et
  //    seul le dernier (= le seul) est composé — le code est le MÊME, il livre
  //    juste sur plusieurs GESTES au lieu de plusieurs trames.
  // ⚠️ C'EST CE QUI REND CODEX AUSSI COMPLET QUE CLAUDE CODE. Codex n'a pas de
  //    multi-trames ; il a désormais la même garantie de livraison intégrale,
  //    avec un DÉBIT plus faible. Ne JAMAIS rétablir le court-circuit `n === 1`
  //    « pour la parité » : la parité visée est celle du CAS QUI TIENT (ligne
  //    ci-dessous), jamais celle du cas qui déborde.
  const solo = planifier(liste, max);
  if (solo.differes.length === 0) {
    const out = [solo];
    for (let i = 1; i < n; i++) out.push(paquetVide());
    return out;
  }

  // Marqueur COMMUN aux N paquets : il identifie l'ÉMISSION, pas le bloc.
  // Dérivé du contenu entier ⇒ identique dans les N processus (déterminisme).
  const marqueur = empreinte(liste.map((s) => s.text).join(SEPARATEUR) + n);

  // Tout ce qui dépasse la capacité d'une trame est MORCELÉ, jamais écarté.
  // Overhead calculé au PIRE cas (`n/n`, le plus large en chiffres) : borne
  // sûre, jamais optimiste.
  // ⚠️ IL N'Y A PLUS D'« IMPOSSIBLES » (03/08/2026). Avant, un segment plus
  //    lourd qu'une trame était mis de côté et seulement ANNONCÉ : il
  //    n'arrivait JAMAIS. Désormais il est MORCELÉ et livré. Le framework
  //    LIVRE — il ne juge pas la taille de ce qu'on lui confie.
  // ⚠️ CAPACITÉ NÉGATIVE = LE BUDGET NE PORTE MÊME PAS L'ENVELOPPE. On ne
  //    renonce PAS à livrer pour autant : on DÉSCELLE et on remplit la trame
  //    entière de contenu. Sans ce chemin, un budget mal réglé faisait sortir
  //    ZÉRO doc en accusant `--paquets N` — indélivrabilité + message faux, les
  //    deux défauts que ce module existe pour rendre impossibles.
  const capacite = capacitePaquet(max, n);
  const scelle = capacite > 0;
  const reste = morceler(liste, scelle ? capacite : max);

  const groupes = [];
  // Paquets 1..N-1 : remplissage glouton, ordre de priorité PRÉSERVÉ (l'ordre
  // d'entrée PORTE le rank — ne jamais retrier ici).
  for (let i = 0; i < n - 1; i++) {
    const retenus = [];
    while (reste.length > 0 && composerPaquet(retenus.concat([reste[0]]), [], i + 1, n, marqueur, scelle).length <= max) {
      retenus.push(reste.shift());
    }
    groupes.push(retenus);
  }

  // DERNIER paquet : il porte l'annonce de tout ce qui n'a pas trouvé de place.
  // ⚠️ Décroissant, même raison que `planifier` : l'annonce GROSSIT quand on
  //    retire, la taille finale n'est donc pas monotone.
  // ⚠️ L'initialisation EST le cas « k = 0 » (rien de retenu, tout annoncé) :
  //    c'est pourquoi la boucle s'arrête à 1. La faire descendre jusqu'à 0
  //    recalculerait à l'identique ces deux valeurs ⇒ mutant ÉQUIVALENT.
  //    ⚠️ C'est AUSSI le filet quand le budget est si petit que l'annonce nue le
  //    dépasse : on émet quand même l'annonce (dire « il manque ça » vaut mieux
  //    que le silence — même arbitrage que `planifier`).
  let dernier = [];
  // ⚠️ PAS de `.slice()` défensif : plus rien ne mute `reste` en aval, donc la
  //    copie serait INOBSERVABLE — c'est-à-dire un mutant ÉQUIVALENT, donc un
  //    survivant éternel (mesuré 03/08/2026). Doctrine du parc : on ÉLIMINE
  //    l'équivalence par construction, on ne la désactive JAMAIS.
  let differesFinaux = reste;
  // Ce qu'on CITE dans l'annonce — normalement identique à ce qu'on diffère.
  // Il s'en écarte dans le seul cas de la garantie de progrès ci-dessous.
  let cites = reste;
  // ⚠️ PAS DE BORNE DE DÉPART « OPTIMISÉE » ICI — TENTÉE PUIS RETIRÉE le
  //    05/08/2026, et il ne faut PAS la réintroduire sans une mesure NEUVE.
  //    L'idée était de sauter au premier `k` ayant une chance (somme brute des
  //    textes ≤ max), pour éviter que la boucle ne recompose la chaîne entière
  //    à chaque essai. Elle était CORRECTE et strictement sans effet sur le
  //    résultat — et c'est précisément le problème : **2 mutants ÉQUIVALENTS,
  //    donc 2 survivants éternels** (score tombé à 98,85 %, sous le seuil 99).
  //    Doctrine du parc, écrite plus haut dans ce fichier : on ÉLIMINE
  //    l'équivalence par construction, on ne la DÉSACTIVE jamais.
  //    ⚠️ Et le besoin n'était pas réel : la lenteur mesurée venait d'un budget
  //    de 400 caractères — plus PETIT que l'enveloppe elle-même (~330), un
  //    régime absurde qui n'existe pas en production. Au budget réel (8 000),
  //    un reliquat de 500 Ko fait ~65 morceaux : la boucle est instantanée.
  // 🛑 Si un jour un corpus RÉEL rend ceci lent, la réponse n'est pas de
  //    remettre une borne inobservable : c'est de rendre le coût observable
  //    (mesure) puis de changer l'ALGORITHME, pas d'ajouter un raccourci que
  //    aucun test ne peut distinguer.
  for (let k = reste.length; k >= 1; k--) {
    const essai = reste.slice(0, k);
    const laisses = reste.slice(k);
    if (composerPaquet(essai, laisses, n, n, marqueur, scelle).length <= max) {
      dernier = essai;
      differesFinaux = laisses;
      cites = laisses;
      break;
    }
  }

  // ⚠️ GARANTIE DE PROGRÈS — SANS ELLE, LA FILE EST UNE BOUCLE INFINIE.
  //    (Défaut MESURÉ le 05/08/2026 par simulation de la boucle réelle :
  //    budget 600, une doc de 5 000 c ⇒ 56 morceaux ⇒ ZÉRO émis, indéfiniment.)
  //    La boucle ci-dessus peut ne rien retenir : l'annonce, même bornée, peut à
  //    elle seule remplir une trame minuscule. Tant qu'on JETAIT le reliquat,
  //    c'était une perte ponctuelle ; maintenant qu'on le REPRÉSENTE au geste
  //    suivant, un tour sans progrès se répète POUR TOUJOURS et plus rien
  //    n'avance jamais.
  //    On force donc UN morceau — `morceler` garantit qu'il tient dans la trame
  //    — et on SACRIFIE L'ANNONCE pour lui faire de la place. C'est la doctrine
  //    déjà appliquée au sceau : **livrer passe avant décrire.** Une trame qui
  //    ne décrit pas son reliquat reste honnête (la file le livrera) ; une trame
  //    qui ne livre rien ne l'est pas.
  // 🛑 NE JAMAIS supprimer ce chemin en le prenant pour un cas d'école : il est
  //    la SEULE chose qui rende la terminaison certaine. Property ⑧.
  if (dernier.length === 0 && reste.length > 0) {
    dernier = [reste[0]];
    differesFinaux = reste.slice(1);
    cites = [];
  }
  groupes.push(dernier);

  return groupes.map((retenus, i) => {
    const differes = i === n - 1 ? differesFinaux : [];
    // ⚠️ CE QU'ON COMPOSE ≠ CE QU'ON RAPPORTE, dans le seul cas du progrès
    //    forcé : la trame n'affiche pas l'annonce (pas la place) mais le
    //    reliquat RÉEL est bien rendu à l'appelant, qui le remet en file. Ne
    //    JAMAIS réaligner les deux « par symétrie » — ce serait soit réafficher
    //    l'annonce qui étouffe la trame, soit PERDRE le reliquat en le taisant
    //    à l'appelant, c'est-à-dire ressusciter le défaut d'origine.
    const aCiter = i === n - 1 ? cites : [];
    // ⚠️ Un paquet SANS contenu n'est PAS émis (texte vide ⇒ la coquille sort en
    //    silence). Émettre une enveloppe pour annoncer du néant coûterait des
    //    tokens à CHAQUE geste de CHAQUE agent.
    // ⚠️ LA CONDITION `&& differes.length === 0` A ÉTÉ RETIRÉE le 05/08/2026 :
    //    la GARANTIE DE PROGRÈS la rend REDONDANTE par construction — dès qu'il
    //    reste quelque chose, un morceau est forcé dans le dernier paquet, donc
    //    « rien de retenu » implique désormais « rien de différé ». Une garde
    //    redondante est un mutant ÉQUIVALENT (survivant éternel) : doctrine du
    //    parc, on l'élimine, on ne la désactive pas.
    // 🛑 Si la garantie de progrès disparaissait un jour, CETTE ligne devrait
    //    revenir — elles ne sont pas indépendantes.
    if (retenus.length === 0) return paquetVide();
    return {
      texte: composerPaquet(retenus, aCiter, i + 1, n, marqueur, scelle),
      emis: retenus.map((s) => s.id),
      differes,
      // ⚠️ Descellé ⇒ marqueur VIDE : annoncer un sceau absent du texte serait
      //    exactement le « vert qui ment ». Ce que la porte rapporte doit
      //    toujours décrire ce qui est RÉELLEMENT sorti.
      marqueur: scelle ? marqueur : '',
    };
  });
}

/**
 * Capacité de CONTENU d'un paquet scellé — combien de caractères une trame peut
 * porter une fois l'enveloppe déduite.
 *
 * ⚠️ CE N'EST PAS UNE LIMITE DE TAILLE DE DOC, et ça ne doit JAMAIS le
 *    redevenir. C'est un pas de découpe : au-delà, la doc est MORCELÉE, jamais
 *    refusée. ⚠️ NE JAMAIS bâtir un gate de taille là-dessus — l'ancien
 *    commentaire l'exigeait (« un gate de taille DOIT s'appuyer là-dessus »),
 *    il datait de la doctrine MORTE où un segment était indivisible. Le
 *    framework LIVRE ; la taille d'une doc ne le regarde pas.
 * ⚠️ Peut être NÉGATIVE (budget plus petit que l'enveloppe) : l'appelant
 *    DÉSCELLE alors au lieu de renoncer — cf. `composerPaquet(…, scelle)`.
 * ⚠️ DÉRIVÉE de l'en-tête RÉEL (jamais une constante recopiée) : reformuler
 *    l'en-tête change la capacité, et le découpage suit automatiquement.
 */
function capacitePaquet(budget, nbPaquets) {
  // ⚠️ `Math.max(2, …)` et non `… >= 2 ? … : 2` : à nbPaquets = 2 les deux
  //    branches du ternaire rendent la même chose ⇒ comparateur INTUABLE.
  //    Même leçon que `parsePaquetArgs` — écrire la forme testable, toujours.
  const n = Number.isInteger(nbPaquets) ? Math.max(2, nbPaquets) : 2;
  const m = '0'.repeat(TAILLE_MARQUEUR);
  return budgetEffectif(budget) - (enTetePaquet(m, n, n).length + pied(m).length);
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

// ⚠️ `morceler` est EXPORTÉ pour être scellé DIRECTEMENT : c'est un SCANNER (il
//    interprète un format — des lignes — pour produire des tranches), et la
//    doctrine du parc impose le property-based sur tout scanner. Le tester à
//    travers `planifierPaquets` laissait ses frontières intestables : 6 mutants
//    y survivaient le 03/08/2026 alors que tout le reste du module était à 100 %.
//    Ce n'est PAS une extension d'API publique — aucune coquille ne l'appelle.
// ⚠️ IDENTITÉ D'UN DOCUMENT, source unique (05/08/2026). `morceler` pose des ids
//    `<doc>#<j>` ; TOUT ce qui raisonne en DOCUMENT (dédup avec la file, badge
//    de la statusline, attribution à une source) doit repasser par la base.
//    Sans ce repli, un document à moitié livré serait vu comme un document
//    DIFFÉRENT de lui-même et réinjecté en double. Vivait en copie locale dans
//    porte-core.js — remonté ici avec la file : c'est une règle du TRANSPORT,
//    pas de l'orchestration d'un émetteur particulier.
function baseId(id) {
  const i = id.indexOf('#');
  return i === -1 ? id : id.slice(0, i);
}

/**
 * ORDRE D'ÉMISSION — la file d'abord, le frais ensuite.
 *
 * ⚠️ CE N'EST PAS UNE PRÉFÉRENCE, C'EST LA CONDITION DU RECOLLAGE (RFC 6455) :
 *    un document fragmenté n'est JAMAIS entrelacé avec un autre. Intercaler du
 *    frais au milieu de ses `MORCEAU j/m` laisserait le récepteur incapable de
 *    savoir quel morceau appartient à quoi. Ne JAMAIS trier ni prioriser ici.
 * ⚠️ DÉDUP OBLIGATOIRE PAR DOCUMENT : une doc `dumb` est re-décidée à CHAQUE
 *    geste. Sans ce filtre, une doc encore en cours de livraison serait
 *    ré-empilée ENTIÈRE derrière ses propres morceaux — doublon de tokens ET
 *    recollage impossible. La file fait AUTORITÉ tant qu'elle n'est pas vidée.
 */
function ordonner(enAttente, frais) {
  const file = Array.isArray(enAttente) ? enAttente : [];
  const neufs = Array.isArray(frais) ? frais : [];
  const dejaEnFile = new Set(file.map((s) => baseId(s.id)));
  return file.concat(neufs.filter((s) => !dejaEnFile.has(baseId(s.id))));
}

// ⚠️ `morceler` est EXPORTÉ pour être scellé DIRECTEMENT : c'est un SCANNER (il
//    interprète un format — des lignes — pour produire des tranches), et la
//    doctrine du parc impose le property-based sur tout scanner. Le tester à
//    travers `planifierPaquets` laissait ses frontières intestables : 6 mutants
//    y survivaient le 03/08/2026 alors que tout le reste du module était à 100 %.
//    Ce n'est PAS une extension d'API publique — aucune coquille ne l'appelle.
module.exports = { planifier, planifierPaquets, capacitePaquet, morceler, baseId, ordonner, DEFAUT_BUDGET, TAILLE_MARQUEUR, empreinte, tailleEnveloppe };
