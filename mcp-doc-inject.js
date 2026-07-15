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
// ⚠️ 1 SEUL FICHIER CODE pour TOUS les MCP présents/futurs. Ajouter un MCP
//   au standard = déposer `docs/mcp/{server}.md`. Aucun code par serveur.
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

// Extrait le nom de serveur depuis "mcp__{server}__{tool}".
function serverName(toolName) {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(toolName || '');
  return m ? m[1] : null;
}

function loadDoc(server) {
  try {
    return fs.readFileSync(path.join(docsDir, `${server}.md`), 'utf8').trim();
  } catch {
    return null; // pas de doc pour ce serveur = rien à injecter
  }
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
    const sessionId = data.session_id;
    const config = loadConfig();

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

    const doc = loadDoc(server);
    if (!doc) process.exit(0); // pas de doc pour ce serveur

    allow(doc + `\n[source: .claude/hooks/docs/mcp/${server}.md]`, server);
  } catch {
    process.exit(0); // fail-open
  }
});
