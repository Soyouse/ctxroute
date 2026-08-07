// ═══════════════════════════════════════════════════════════════════════
// COUCHE D'ÉMISSION — la SEULE voie par laquelle un contexte sort d'ici.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI CE FICHIER EXISTE (05/08/2026, REFACTOR-PLAN ⑯). Le transport
//    (budget · morcelage · sceau · paquets · file) vivait DANS `porte-core.js`,
//    c'est-à-dire dans l'orchestration d'UN SEUL des deux émetteurs. Le second
//    (`session-inject.js`) ne le traversait pas, et RIEN ne l'y obligeait :
//    c'était de l'opt-in par recopie. Résultat mesuré : les docs de
//    `docs/session/` sortaient d'un bloc, sans sceau, sans morcelage, sans
//    file — donc soumises au spill silencieux du harnais dès qu'elles
//    grossiraient. Ce n'était pas un oubli, c'était un DÉFAUT DE SQUELETTE, et
//    il se serait reproduit au 3ᵉ émetteur (PostCompact Codex, SubagentStart,
//    Stop… — 5 événements déjà listés).
//
// ⚠️ LA RÈGLE QUI TIENT LE SQUELETTE : *aucun émetteur ne compose sa sortie —
//    il rend des segments à cette couche.* C'est le motif des frameworks web
//    (un handler ne sérialise jamais sa réponse ; le pipeline le fait).
//    DIFFÉRENCE CAPITALE avec eux : là-bas on ne PEUT pas contourner le
//    pipeline, on ne possède pas le transport. Ici on possède tout ⇒ seule une
//    MACHINE peut l'imposer. D'où `emission-core-gate.test.js` : « tout fichier
//    qui écrit `additionalContext` DOIT importer ce module », dérivé du code
//    donc valable pour les émetteurs FUTURS. Sans ce gate, la couche existe
//    mais reste facultative et on n'a fait que déplacer le problème.
//
// ⚠️ CE MODULE EST UNE COQUILLE I/O (store de file) — jamais muté Stryker,
//    jamais importé par le moteur pur. TOUTE la décision de transport est
//    PURE et vit dans `budget.js` (`ordonner`, `planifierPaquets`, `baseId`),
//    qui est muté à 100 %. Ne JAMAIS rapatrier de logique ici : ce fichier ne
//    doit contenir que « lire la file → déléguer → réécrire la file ».
//
// ⚠️ ON NE FUSIONNE PAS LES ÉMETTEURS POUR AUTANT. SessionStart et PreToolUse
//    ont des événements et des contrats de sortie DIFFÉRENTS (invariant écrit
//    dans session-porte.md). On partage la COUCHE D'ÉMISSION, jamais
//    l'orchestration.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const budget = require('./budget');
const store = require('./session-store');

// ⚠️ FILE D'ÉMISSION — ce qui ne tient pas dans les N trames d'UN geste attend
//    ici et repart au geste SUIVANT. Préfixe distinct, keyé par le scope
//    d'agent, purgé par `ctxroute-reset.js` comme les autres stores.
//
//    C'EST LE COMPORTEMENT DE L'ÉMETTEUR TCP, et ce n'est pas une analogie
//    décorative : fenêtre pleine ⇒ les données RESTENT dans le tampon
//    d'émission et partent à la fenêtre suivante. Aucun protocole de transport
//    ne jette parce que la fenêtre est pleine — canal borné, flux illimité.
//    Conséquence directe : le nombre de trames déclarées n'est plus un PLAFOND
//    de livraison, seulement un DÉBIT.
//
// ⚠️ STORE PARTAGÉ PAR TOUS LES ÉMETTEURS, VOLONTAIREMENT (05/08/2026). Une
//    file par émetteur serait une régression : à SessionStart il n'y a pas de
//    « geste suivant » où drainer, donc son reliquat ne partirait jamais. Avec
//    un store commun keyé par scope d'agent, ce que la porte SESSION n'a pas pu
//    livrer est repris par la porte PreToolUse au tout premier appel d'outil.
//    Ne JAMAIS préfixer la file par émetteur.
const RELIQUAT_PREFIX = 'reliquat-';

// ⚠️ ON STOCKE LE TEXTE, PAS UNE RÉFÉRENCE À RECALCULER. Deux raisons, aucune
//    négociable : ① les N processus parallèles doivent voir EXACTEMENT la même
//    entrée, sinon leurs trames ne recollent plus ; ② une doc ÉDITÉE entre deux
//    gestes ferait recoller des morceaux d'une version avec des morceaux d'une
//    autre — un Frankenstein silencieux.
function chargerFile(scopeId) {
  const f = store.loadState(RELIQUAT_PREFIX, scopeId);
  return Array.isArray(f.segments) ? f.segments : [];
}

// ⚠️ ÉCRITURE INCONDITIONNELLE, y compris avec un reste VIDE : c'est ce qui
//    VIDE la file quand tout est enfin livré. La rendre conditionnelle au
//    non-vide ferait boucler la dernière livraison à chaque geste, pour
//    toujours.
function enregistrerFile(scopeId, differes, emissions) {
  store.saveState(RELIQUAT_PREFIX, scopeId, { segments: differes, emissions });
}

/**
 * COMPTEUR D'ÉMISSIONS — combien de fois cette couche a réellement fait SORTIR
 * du contexte, pour ce scope d'agent, depuis la dernière compaction.
 *
 * ⚠️ RAISON D'ÊTRE (07/08/2026, portage du canari sur Codex). Le canari doit
 *    répondre à « on a émis, est-ce ARRIVÉ ? ». Il lui faut donc un
 *    DÉNOMINATEUR : sans lui, « zéro injection constatée » est indécidable
 *    (peut-être n'a-t-on simplement rien émis). Côté Claude Code ce
 *    dénominateur était compté en cherchant `"type":"tool_use"` dans le
 *    transcript — c'est-à-dire en lisant le DIALECTE du harnais.
 * 🛑 CETTE VOIE EST FERMÉE POUR CODEX, ET C'EST DOCUMENTÉ NOIR SUR BLANC.
 *    Doc officielle des hooks Codex (learn.chatgpt.com/docs/hooks, relue le
 *    07/08/2026) : « the transcript format isn't a stable interface for hooks
 *    and may change over time ». Compter des appels d'outils en devinant un
 *    marqueur dans ce fichier serait bâtir sur un format que l'éditeur se
 *    réserve explicitement le droit de casser. NE JAMAIS le faire.
 * ✅ Le dénominateur est donc une donnée à NOUS, produite par notre propre
 *    couche d'émission : indépendante de tout harnais, vraie partout, et
 *    gratuite (elle voyage dans une écriture de store qui existait déjà).
 *
 * ⚠️ INCRÉMENTÉ SEULEMENT QUAND DU CONTENU PART VRAIMENT (`segments` non vide).
 *    Compter les passages à vide gonflerait le dénominateur sans jamais
 *    produire de trace attendue en face — le canari accuserait une panne
 *    inexistante, et une alarme qui crie sur du sain cesse d'être lue.
 * ⚠️ Purgé par `ctxroute-reset.js` avec le reste du préfixe `reliquat-` : après
 *    une compaction l'échantillon RECOMMENCE, ce qui est correct — le contexte
 *    a été vidé, les injections d'avant ne prouvent plus rien sur maintenant.
 */
function compteurEmissions(scopeId) {
  const f = store.loadState(RELIQUAT_PREFIX, scopeId);
  // ⚠️ Store écrit AVANT le 07/08/2026 : la clé n'existe pas. Absente = 0,
  //    jamais une erreur — c'est ce qui rend l'ajout rétro-compatible
  //    (expand/contract : la nouvelle clé apparaît, personne ne casse).
  return Number.isInteger(f.emissions) && f.emissions > 0 ? f.emissions : 0;
}

/**
 * DÉCOUPAGE SEUL — sans toucher la file.
 *
 * ⚠️ Réservé aux REJOUES d'un découpage déjà décidé (plan mémoïsé des trames
 *    2..N) et aux chemins DÉGRADÉS où la file ne peut pas être touchée en
 *    sûreté (lock indisponible). Un émetteur normal appelle `emettre`.
 *    Le découpage est PUR et déterministe : rejouer rend le même résultat.
 */
function decouper(segments, budgetMax, nbPaquets) {
  return budget.planifierPaquets(segments, budgetMax, nbPaquets);
}

/**
 * ÉMETTRE — le point de passage OBLIGÉ de tout contexte sortant.
 *
 * Prend des segments FRAIS, les fait passer derrière ce qui attend déjà en
 * file, découpe le tout en trames, persiste ce qui n'est pas sorti, et rend
 * les trames. L'appelant ne choisit RIEN de tout ça : il fournit du contenu et
 * son indice de trame, il reçoit du texte prêt à sortir dans SON dialecte.
 *
 * ⚠️ APPELER SOUS LOCK. Lire puis réécrire la file sans exclusion mutuelle
 *    perdrait des segments quand deux processus se croisent. Un appelant qui
 *    n'a pas pu prendre le lock DOIT dégrader vers `decouper` (frais seul,
 *    file intacte) — jamais se taire, jamais écrire sans lock.
 *
 * @returns {{segments, paquets, plan}} `segments` = l'entrée réelle du
 *   découpage (à mémoïser pour les trames suivantes) ; `plan` = la trame de
 *   l'indice demandé, ou `undefined` si l'indice n'existe pas.
 */
function emettre({ frais, budgetMax, nbPaquets, indice, scopeId }) {
  const segments = budget.ordonner(chargerFile(scopeId), frais);
  const paquets = decouper(segments, budgetMax, nbPaquets);
  // ⚠️ LE COMPTEUR VOYAGE DANS L'ÉCRITURE QUI EXISTAIT DÉJÀ — zéro I/O de plus,
  //    zéro lock de plus. C'est ce qui rend le dénominateur du canari GRATUIT ;
  //    un store dédié aurait ajouté une écriture par geste sur le chemin chaud.
  //    Le passage à vide ne compte pas (cf `compteurEmissions`).
  const emissions = compteurEmissions(scopeId) + (segments.length > 0 ? 1 : 0);
  enregistrerFile(scopeId, paquets[paquets.length - 1].differes, emissions);
  return { segments, paquets, plan: paquets[indice - 1] };
}

module.exports = { emettre, decouper, chargerFile, compteurEmissions, RELIQUAT_PREFIX };
