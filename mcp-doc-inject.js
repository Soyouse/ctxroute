#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Hook PreToolUse — Doc injectable par SERVEUR MCP (framework générique)
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLÈME RÉSOLU : le système protect-files.js injecte de la doc par PATH
// fichier, mais un MCP (Stripe, Odoo, SSH...) n'a pas toujours de "fichier"
// associé — c'est une FRONTIÈRE OUTIL, pas une frontière fichier. Sans ça,
// un agent peut cliquer un bouton "Payer maintenant" réel sur un portail
// client sans savoir que l'action est irréversible (incident 15/07/2026,
// cf. project_mcp_hook_docs_standard en mémoire).
//
// 3 MODES (config.json → "mode") :
//   - "dumb"  : réinjecte à CHAQUE appel du serveur. Bruyant, jamais le défaut.
//   - "once"  : injecte au 1er appel du serveur, plus jamais (jusqu'au reset
//               PreCompact). Zéro bruit, mais peut rester "silencieux" très
//               longtemps si le contexte dérive sans compacter.
//   - "smart" (défaut) : comme "once", MAIS réinjecte aussi si ≥ N appels
//               D'AUTRES outils (non-MCP-même-serveur) se sont écoulés
//               depuis le dernier appel à CE serveur. Le compteur d'un
//               serveur se remet à 0 CHAQUE FOIS qu'il est rappelé (injecté
//               ou pas) — donc un agent qui reste dans le même MCP en continu
//               ne réinjecte jamais ; un agent qui s'en éloigne longtemps (le
//               contexte a eu le temps de "dériver") se refait rappeler l'invariant.
//   Seuil réglable par serveur (config.json → "servers.{server}.threshold"),
//   sinon "defaultThreshold". PreCompact reste le reset ABSOLU (tous modes) :
//   cf mcp-doc-reset.js — la compaction vide le contexte, rien à voir avec le compteur.
//
// ⚠️ COMPTEURS INDÉPENDANTS PAR SERVEUR — "autre outil" = TOUT outil qui
//   N'EST PAS ce serveur précis, y compris un AUTRE serveur MCP. Ex : Stripe
//   → Odoo → Stripe fait avancer le compteur de Stripe pendant l'appel Odoo
//   (Odoo est "étranger" à Stripe), et réciproquement le compteur d'Odoo
//   avance pendant l'appel Stripe. Chaque serveur compte STRICTEMENT le
//   nombre d'outils étrangers depuis SON PROPRE dernier appel — jamais un
//   compteur global partagé entre serveurs (sinon Stripe et Odoo se
//   marcheraient dessus : appeler l'un ferait croire à une "dérive" de
//   l'autre alors qu'aucun outil vraiment étranger à CET AUTRE ne s'est produit).
//
// FILTRAGE (config.json → "filterMode") : contrôle QUELS serveurs sont
//   couverts par le framework, indépendamment de savoir si un doc.md existe :
//   - "none" (défaut) : tous les serveurs sont couverts.
//   - "whitelist" : SEULS les serveurs listés dans "filterList" sont couverts.
//   - "blacklist" : TOUS les serveurs SAUF ceux listés dans "filterList".
//   Un serveur EXCLU par le filtre n'a NI injection NI état ("seen"/compteur)
//   — mais ses appels comptent TOUJOURS comme "étranger" pour les AUTRES
//   serveurs actifs (cf boucle d'incrémentation, qui ne connaît pas le filtre).
//
// MODE PAR SERVEUR (config.json → "servers.{server}.mode") : écrase le mode
//   global pour CE serveur uniquement (ex: Stripe en "dumb" — toujours
//   réafficher l'avertissement paiement — pendant que le reste reste "smart").
//
// GRANULARITÉ 3 NIVEAUX (toutes les docs matchantes sont CONCATÉNÉES, ordre
//   global → outil → sous-outil, même logique parent/enfant que protect-files.js) :
//   1. `docs/mcp/{server}.md`              — invariants du serveur entier.
//   2. `docs/mcp/{server}/{tool}.md`       — {tool} = ce qui suit "mcp__{server}__"
//      dans tool_name (ex: mcp__stripe__authenticate → tool="authenticate").
//   3. `docs/mcp/{server}/{subTool}.md`    — pour les MCP "proxy" à outil UNIQUE
//      où la vraie opération est un PARAMÈTRE (ex: Odoo : tool_name="odoo_call"
//      TOUJOURS, l'opération réelle vit dans tool_input.args.tool="update_record").
//      Activé via `servers.{server}.subToolParam` = chemin pointé du paramètre
//      à lire dans tool_input (ex: "args.tool"). Sans ce réglage, niveau 3 inactif.
//      ⚠️ SANS ce niveau, un serveur proxy est un angle mort total : le framework
//      ne peut distinguer "lecture Odoo" de "delete_record Odoo" — les deux ont
//      le même tool_name="mcp__odoo__odoo_call".
//
// ⚠️ 1 SEUL FICHIER CODE pour TOUS les MCP présents/futurs. Ajouter un MCP
//   au standard = déposer `docs/mcp/{server}.md` (et optionnellement des .md
//   par outil/sous-outil). Aucun code par serveur.
//
// STORE = state/mcp-doc-seen-<session_id>.json :
//   { "<server>": { "seen": true, "sinceLastCall": <int> } }
//   ⚠️ CLÉ = session_id, même isolation voulue que odoo-provenance.js.
//
// ⚠️ NE JAMAIS bloquer (deny/ask) — ce hook est PUREMENT informatif.
// ⚠️ FAIL-OPEN OBLIGATOIRE : toute erreur/parse KO → exit(0).
// ⚠️ Format de sortie PreToolUse IMPOSÉ par Claude Code :
//   stdout JSON hookSpecificOutput.permissionDecision + exit(0). Jamais stderr.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'mcp');
const stateDir = path.join(__dirname, 'state');
const configPath = path.join(__dirname, 'mcp-doc-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { mode: 'smart', defaultThreshold: 4, servers: {} }; // config absente = comportement par défaut
  }
}

function thresholdFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].threshold;
  return Number.isInteger(override) ? override : (Number.isInteger(config.defaultThreshold) ? config.defaultThreshold : 4);
}

// Mode effectif pour CE serveur : override servers.{server}.mode > mode global > "smart".
function modeFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].mode;
  return override || config.mode || 'smart';
}

// Le serveur est-il couvert par le framework selon filterMode/filterList ?
// ⚠️ "whitelist" et "blacklist" sont symétriques : whitelist = liste des SEULS
// autorisés, blacklist = liste des SEULS exclus. "none"/valeur inconnue = tout couvert
// (fail-open : une config cassée ne doit jamais silencieusement tout désactiver).
function isServerActive(config, server) {
  const filterMode = config.filterMode || 'none';
  const list = Array.isArray(config.filterList) ? config.filterList : [];
  if (filterMode === 'whitelist') return list.includes(server);
  if (filterMode === 'blacklist') return !list.includes(server);
  return true;
}

function storeFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(stateDir, `mcp-doc-seen-${safe || 'unknown'}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(storeFile(sessionId), 'utf8'));
  } catch {
    return {};
  }
}

function saveState(sessionId, state) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(storeFile(sessionId), JSON.stringify(state));
  } catch {
    /* fail-open : si on ne peut pas écrire le store, on ne casse rien */
  }
}

// ── PURGE des fichiers d'état PÉRIMÉS ──
// PROBLÈME : 1 session = 1 fichier state/mcp-doc-seen-<id>.json, jamais
// supprimé automatiquement → croissance illimitée sur des mois d'usage.
// FIX : purge PROBABILISTE (pas à CHAQUE appel — éviter un readdir+stat sur
// TOUT le dossier à chaque invocation du hook, coûteux et inutile) des
// fichiers dont le mtime dépasse le TTL. ~1 invocation sur 50 suffit à
// borner la croissance sans overhead perceptible.
// ⚠️ Probabilité et TTL surchargeables par env var UNIQUEMENT pour les
// tests (déterminisme) — en prod, les valeurs par défaut s'appliquent toujours.
const GC_PROBABILITY = Number(process.env.MCP_DOC_GC_PROBABILITY) || 0.02;
const GC_TTL_MS = Number(process.env.MCP_DOC_GC_TTL_MS) || 30 * 24 * 60 * 60 * 1000; // 30 jours

function pruneOldStateFiles() {
  if (Math.random() >= GC_PROBABILITY) return;
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(stateDir)) {
      if (!f.startsWith('mcp-doc-seen-') || !f.endsWith('.json')) continue;
      const full = path.join(stateDir, f);
      const st = fs.statSync(full);
      if (now - st.mtimeMs > GC_TTL_MS) fs.rmSync(full, { force: true });
    }
  } catch {
    /* fail-open : la purge est un bonus d'hygiène, jamais un blocage */
  }
}

// Extrait le nom de serveur depuis "mcp__{server}__{tool}".
function serverName(toolName) {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(toolName || '');
  return m ? m[1] : null;
}

// Extrait le SUFFIXE outil depuis "mcp__{server}__{tool}" (tout ce qui suit
// le préfixe serveur). Ex: mcp__stripe__authenticate, server="stripe" → "authenticate".
function toolSuffix(toolName, server) {
  if (!server) return null;
  const prefix = `mcp__${server}__`;
  return toolName && toolName.startsWith(prefix) ? toolName.slice(prefix.length) : null;
}

// Lit une valeur imbriquée via un chemin pointé ("args.tool" → obj.args.tool).
// ⚠️ Retourne seulement des valeurs SCALAIRES sûres pour un nom de fichier
// (string/number) — un objet/array ne correspond à aucun .md, jamais planter.
function getByPath(obj, dottedPath) {
  if (!obj || typeof dottedPath !== 'string') return null;
  const val = dottedPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  return (typeof val === 'string' || typeof val === 'number') ? String(val) : null;
}

function readDocFile(relPath) {
  try {
    return fs.readFileSync(path.join(docsDir, relPath), 'utf8').trim();
  } catch {
    return null; // fichier absent = rien à injecter pour ce niveau
  }
}

// Collecte TOUTES les docs qui existent pour cet appel précis, du plus
// GLOBAL au plus SPÉCIFIQUE (même ordre que protect-files.js) :
//   1. docs/mcp/{server}.md
//   2. docs/mcp/{server}/{tool}.md       (suffixe outil, si présent)
//   3. docs/mcp/{server}/{subTool}.md    (paramètre sous-outil, si configuré ET présent)
// Concatène avec un séparateur, chaque bloc gardant sa source pour traçabilité.
function loadDocParts(config, server, toolName, toolInput) {
  const parts = [];

  const serverDoc = readDocFile(`${server}.md`);
  if (serverDoc) parts.push(serverDoc + `\n[source: docs/mcp/${server}.md]`);

  const suffix = toolSuffix(toolName, server);
  if (suffix) {
    const toolDoc = readDocFile(path.join(server, `${suffix}.md`));
    if (toolDoc) parts.push(toolDoc + `\n[source: docs/mcp/${server}/${suffix}.md]`);
  }

  const subToolParam = config.servers && config.servers[server] && config.servers[server].subToolParam;
  if (subToolParam) {
    const subTool = getByPath(toolInput, subToolParam);
    // ⚠️ Évite de relire le même fichier deux fois si suffix === subTool
    // (arrive si un serveur a À LA FOIS des sous-outils ET une convention de nommage identique).
    if (subTool && subTool !== suffix) {
      const subToolDoc = readDocFile(path.join(server, `${subTool}.md`));
      if (subToolDoc) parts.push(subToolDoc + `\n[source: docs/mcp/${server}/${subTool}.md]`);
    }
  }

  return parts;
}

function allow(doc, server) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: doc,
    },
    systemMessage: `📄 doc MCP: ${server}`,
  }));
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    const sessionId = data.session_id;
    const config = loadConfig();

    pruneOldStateFiles(); // hygiène : borne la croissance de state/, probabiliste, jamais bloquant

    const server = serverName(toolName);
    const active = server ? isServerActive(config, server) : false;
    const state = loadState(sessionId);

    // Décision AVANT toute incrémentation : lit le compteur du serveur ciblé
    // tel qu'il était avant cet appel (non affecté par cet appel lui-même).
    // ⚠️ Mode PAR SERVEUR : modeFor(config, server) — chaque serveur peut
    // avoir un mode différent du mode global (ex: Stripe en "dumb" fixe).
    let shouldInject = false;
    let serverMode = null;
    if (server && active) {
      serverMode = modeFor(config, server);
      const entry = state[server] || { seen: false, sinceLastCall: 0 };
      const threshold = thresholdFor(config, server);
      if (serverMode === 'dumb') shouldInject = true;
      else if (!entry.seen) shouldInject = true; // 1er appel du serveur, tous modes
      else if (serverMode === 'smart') shouldInject = entry.sinceLastCall >= threshold;
      else shouldInject = false; // "once" déjà vu = jamais
    }

    // ⚠️ COMPTEURS INDÉPENDANTS : CET appel (MCP actif/inactif ou natif) est
    // "étranger" à TOUS les AUTRES serveurs déjà vus SAUF `server` lui-même.
    // Chaque serveur cible n'avance QUE si SON PROPRE mode est "smart" (le
    // mode est par serveur, pas global) — un serveur en "once"/"dumb" n'a pas
    // de compteur à maintenir. Un appel à un serveur EXCLU par le filtre
    // compte quand même comme "étranger" pour les autres (le filtre ne
    // change pas la réalité : un outil a bien été appelé entre-temps).
    {
      let changed = false;
      for (const key of Object.keys(state)) {
        if (key === server) continue;
        if (state[key] && state[key].seen && modeFor(config, key) === 'smart') {
          state[key].sinceLastCall = (state[key].sinceLastCall || 0) + 1;
          changed = true;
        }
      }
      if (changed) saveState(sessionId, state);
    }

    if (!server || !active) process.exit(0); // outil natif ou serveur filtré : rien d'autre à faire

    // Rappeler ce serveur remet TOUJOURS son propre compteur à 0
    // (injecté ou non — c'est la "preuve" que le serveur est encore présent).
    state[server] = { seen: true, sinceLastCall: 0 };
    saveState(sessionId, state);

    if (!shouldInject) process.exit(0);

    const parts = loadDocParts(config, server, toolName, toolInput);
    if (parts.length === 0) process.exit(0); // aucune doc à aucun des 3 niveaux

    allow(parts.join('\n\n---\n\n'), server);
  } catch {
    process.exit(0); // fail-open
  }
});
