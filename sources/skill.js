// ═══════════════════════════════════════════════════════════════════════
// SOURCE « skill » — PURE. payload -> quels skills déclencher par périmètre ?
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (fs/path/process interdits) — comme sources/file.js : condition
//    pour que Stryker mute sans mutants équivalents. Scellé .dependency-cruiser.
//
// ⚠️ ZÉRO DOUBLON DE MATCHING : le périmètre d'un skill se matche EXACTEMENT
//    comme une doc fichier (chemin, commande Bash avec `cd &&`, scope sur tous
//    les params). On RÉUTILISE `matchingDocs` de sources/file.js — jamais une
//    2ᵉ implémentation du match. MÊME VOCABULAIRE que les docs : `match` /
//    `scope` / `exclude` (le mot `perimeter` = synonyme supprimé le 18/07/2026 —
//    deux noms pour une même primitive = doublon de vocabulaire, interdit).
//
// ⚠️ CE MODULE NE CONNAÎT AUCUN HARNAIS (gate sources-must-not-know-the-harness) :
//    il répond « quels skills ? », il ne décide RIEN et ne lit RIEN. C'est
//    l'ADAPTATEUR (source-adapters) qui lit le CORPS du skill et l'injecte
//    (décision mainteneur 18/07/2026) ; `pointerBody` ici = FALLBACK si fichier illisible.
//
// ⚠️ Renommer le skill = le registre pointe dans le vide → scellé par
//    skill-registry-gate (skill nommé = fichier existant).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const { matchingDocs } = require('./file');
const lib = require('../lib-pure');
// ⚠️ MODES/DRIFT_UNITS importés de frontmatter.js — SOURCE UNIQUE du vocabulaire
//    de cadence (une 2ᵉ liste locale = doublon qui dérive en silence).
const { MODES, DRIFT_UNITS } = require('../frontmatter');

// Préfixe docId RÉSERVÉ à cette source (unicité inter-sources, contrat du registre).
const DOC_PREFIX = 'skill/';

// Registre `config.skills` -> règles plates {pattern, doc, exclude?} pour le
// matcher partagé. Une règle par pattern de périmètre (doc = 'skill/{nom}',
// dédup naturelle de matchingDocs = 1 pointeur même si 2 patterns matchent).
function skillRules(config) {
  const skills = (config && config.skills) || {};
  const rules = [];
  for (const name of Object.keys(skills)) {
    const entry = skills[name] || {};
    // ⚠️ `rules` = FORME PAR-ENTRÉE (19/07/2026, PARITÉ docs — cas réel : skill
    //    multi-projets aux patterns hétérogènes, un scope par pattern). Exclusive
    //    de match/scope/exclude (schéma `not` = contradiction ROUGE) ; au runtime
    //    elle a PRÉCÉDENCE (déterministe, jamais les deux).
    if (Array.isArray(entry.rules)) {
      // ⚠️ ZÉRO garde ici : matchingDocs est la SEULE autorité de validation
      //    (pattern non-string → règle sautée, scope/exclude non-tableau →
      //    ignorés). Re-vérifier ici = gardes dupliquées = mutants équivalents.
      //    `{...null}` = {} : une entrée nulle devient une règle sans pattern,
      //    sautée en aval — totalité sans conditionnel.
      for (const r of entry.rules) rules.push({ ...r, doc: DOC_PREFIX + name });
      continue;
    }
    const match = Array.isArray(entry.match) ? entry.match : [];
    for (const pattern of match) {
      if (typeof pattern !== 'string') continue;
      const rule = { pattern, doc: DOC_PREFIX + name };
      // ⚠️ scope/exclude propagés SEULEMENT s'ils sont fournis (une clé
      //    :undefined changerait la shape sans raison — matchingDocs ignore
      //    l'absence). PARITÉ COMPLÈTE avec les docs fichier : le matcher réutilisé
      //    gère déjà scope+exclude, on expose donc les DEUX (pas de capacité retenue).
      if (Array.isArray(entry.scope)) rule.scope = entry.scope;
      if (Array.isArray(entry.exclude)) rule.exclude = entry.exclude;
      rules.push(rule);
    }
  }
  return rules;
}

// DIMENSION 1 — périmètre FICHIER : via le MÊME matcher que la source fichier.
// ⚠️ `cwd` AJOUTÉ aux params matchables (18/07/2026, décision mainteneur APRÈS
//    mesure doc-first : champ COMMUN des contrats de hooks Claude Code ET Codex —
//    signal universel). Couvre le trou réel « `npm test` lancé DANS le projet ne
//    porte aucun chemin ». FAIL-SOFT : harnais sans cwd → comportement d'avant.
//    Propre aux SKILLS (les docs fichier ne le voient pas — parité protect-files).
//    match/scope/exclude s'appliquent au cwd comme à tout param — même algèbre.
function fileMatches(config, payload) {
  // ⚠️ AUCUN typeof ici : la validation « cwd est une chaîne ? » vit UNIQUEMENT
  //    dans extractFilePaths (sources/file.js) — la re-vérifier ici = garde
  //    dupliquée = mutant équivalent (éviter par CONSTRUCTION). On expose, il juge.
  const p = payload || {};
  return matchingDocs(skillRules(config), { ...p, toolInput: { ...(p.toolInput || {}), cwd: p.cwd } });
}

// DIMENSION 2 — périmètre MCP : un skill peut lister des `servers`, à 3 GRAINS
// (mêmes niveaux que les docs MCP, primitives lib RÉUTILISÉES — zéro nouveau match) :
//   'gworkspace'            → tout outil du serveur (lib.serverName)
//   'gworkspace/send_mail'  → CET outil précis (lib.toolSuffix)
//   'odoo/create_invoice'   → CE sous-outil (lib.getByPath + servers.{s}.subToolParam)
function serverMatches(config, payload) {
  const server = lib.serverName(payload && payload.toolName);
  // ⚠️ Garde NÉCESSAIRE depuis le grain outil (18/07/2026) : sans elle, la
  //    concaténation `server + '/' + suffix` vaudrait la chaîne 'null/null' —
  //    une entrée de registre pathologique 'null/null' matcherait alors tout
  //    outil NON-MCP. Testée (plus un mutant équivalent, contrairement à avant).
  if (server == null) return [];
  const suffix = lib.toolSuffix(payload && payload.toolName, server);
  const subToolParam = config && config.servers && config.servers[server] && config.servers[server].subToolParam;
  const subTool = lib.getByPath((payload && payload.toolInput) || {}, subToolParam);
  const subCand = subTool == null ? null : server + '/' + subTool;
  const skills = (config && config.skills) || {};
  const out = [];
  for (const name of Object.keys(skills)) {
    const servers = (skills[name] || {}).servers;
    if (!Array.isArray(servers)) continue;
    // includes(null) = false : subCand absent ne matche jamais (par construction).
    if (servers.includes(server) || servers.includes(server + '/' + suffix) || servers.includes(subCand)) {
      out.push({ doc: DOC_PREFIX + name });
    }
  }
  return out;
}

// payload -> skills déclenchés (refs {doc:'skill/{nom}'}), UNION des 2 dimensions
// (fichier PUIS serveur), dédupée par doc. Un skill matché par les deux = 1 pointeur.
function matchingSkills(config, payload) {
  const seen = new Set();
  const out = [];
  for (const m of fileMatches(config, payload).concat(serverMatches(config, payload))) {
    if (seen.has(m.doc)) continue;
    seen.add(m.doc);
    out.push(m);
  }
  return out;
}

// Cadence d'un skill — ⚠️ CETTE FONCTION NE RÉSOUT PLUS AUCUNE CASCADE (04/08/2026).
// Elle POSE l'entrée du registre, rien d'autre : une clé déclarée et valide passe,
// tout le reste est OMIS. Les étages suivants — `defaults.skill`, le global, puis le
// défaut FRAMEWORK ('once' pour cette source) — vivent tous dans gate.js, UNIQUE
// point de cascade.
//
// ⚠️ AVANT, elle résolvait `config.skillDefaults` ET forçait `mode: 'once'`. C'était
//    un SECOND point de cascade : le jour où un étage change dans gate.js, celui-ci
//    restait en arrière et les skills obéissaient à une autre règle que les docs,
//    en silence. La règle « une source POSE, elle ne résout RIEN » n'existait que
//    pour driftUnit — elle vaut maintenant pour les trois réglages.
//
// ⚠️ `defaults` n'est plus un paramètre : le supprimer est VOLONTAIRE, pas un oubli.
//    Le garder « au cas où » rouvrirait exactement la double résolution ci-dessus.
const validThreshold = (n) => (Number.isInteger(n) && n >= 1 ? n : null);
function declFor(entry) {
  const e = entry || {};
  const decl = {};
  if (MODES.includes(e.mode)) decl.mode = e.mode;
  if (validThreshold(e.threshold) != null) decl.threshold = e.threshold;
  if (DRIFT_UNITS.includes(e.driftUnit)) decl.driftUnit = e.driftUnit;
  // ⚠️ `enforce` (05/08/2026) : POSÉ, jamais résolu — comme les autres. Le
  //    booléen est repris TEL QUEL, `false` compris : c'est lui qui permet à un
  //    skill de se DÉSINSCRIRE d'un `defaults.skill.enforce`. Le filtrer comme
  //    une valeur « vide » rendrait la désinscription impossible.
  if (typeof e.enforce === 'boolean') decl.enforce = e.enforce;
  return decl;
}

// docId 'skill/{nom}' -> nom du skill. Inverse EXACT de skillRules (même préfixe).
function skillNameFromDoc(doc) {
  return String(doc).slice(DOC_PREFIX.length);
}

// FALLBACK uniquement (fichier de skill illisible) : pointeur qui nomme le
// skill et ordonne son chargement — le périmètre signale même en panne de lecture.
// Le chemin nominal = le CORPS du skill, lu et injecté par l'ADAPTATEUR.
// Stryker disable StringLiteral: le TEXTE du pointeur est de la COMMUNICATION
//   (comme les `hint` de collisions.js). Le sémantique — le `name` interpolé et
//   l'ordre de charger via Skill — est testé (pointerBody test) ; le libellé
//   autour est du flavor : le muter = mutants ÉQUIVALENTS. Ne JAMAIS étendre ce
//   disable à la LOGIQUE (skillRules/declFor), seulement à ce texte.
function pointerBody(name) {
  return (
    '# Périmètre projet → charge le skill `' + name + '`\n\n' +
    'Tu es entré dans le périmètre du skill `' + name + '`. AVANT d\'agir : charge-le via l\'outil Skill — ' +
    'il porte le modèle mental complet du projet (SOURCE UNIQUE). Ne recopie jamais son contenu ailleurs.'
  );
}
// Stryker restore StringLiteral

module.exports = { skillRules, matchingSkills, serverMatches, declFor, skillNameFromDoc, pointerBody, DOC_PREFIX, MODES };
