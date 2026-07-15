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
// ⚠️ CE FICHIER = SEUL POINT D'I/O (stdin/fs/stdout). Toute la logique
// DÉCISIONNELLE pure vit dans lib-pure.js (zéro fs, testable/mutable sans
// bruit). La sérialisation cross-process vit dans lock.js. Ce fichier ne
// fait QUE : lire stdin, appeler lib-pure, lire/écrire fs sous lock, écrire stdout.
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
// ⚠️ SECTION CRITIQUE (load→modifier→save de CE fichier) protégée par un lock
//   inter-process (lock.js) — Claude Code peut lancer des appels d'outils
//   indépendants EN PARALLÈLE ; sans lock, deux invocations concurrentes de ce
//   hook pour le MÊME session_id peuvent perdre silencieusement une écriture
//   (race read-modify-write classique). cf lock.js pour le détail du mécanisme.
//
// ⚠️ NE JAMAIS bloquer (deny/ask) — ce hook est PUREMENT informatif.
// ⚠️ FAIL-OPEN OBLIGATOIRE : toute erreur/parse KO → exit(0).
// ⚠️ Format de sortie PreToolUse IMPOSÉ par Claude Code :
//   stdout JSON hookSpecificOutput.permissionDecision + exit(0). Jamais stderr.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const lib = require('./lib-pure');
const { withLock } = require('./lock');
const { readStdinJson } = require('./stdin-json');

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

function storeFile(sessionId) {
  return path.join(stateDir, `mcp-doc-seen-${lib.sanitizeSessionId(sessionId)}.json`);
}

function lockDirFor(sessionId) {
  return path.join(stateDir, `.lock-${lib.sanitizeSessionId(sessionId)}`);
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

function readDocFile(relPath) {
  try {
    return fs.readFileSync(path.join(docsDir, relPath), 'utf8').trim();
  } catch {
    return null; // fichier absent = rien à injecter pour ce niveau
  }
}

// Résout les candidats calculés par lib.docCandidatePaths() en lisant
// réellement le disque, ne garde que ceux qui existent. Seul point d'I/O
// de la chaîne de granularité — la logique de calcul des chemins est pure.
// ⚠️ Retourne aussi `levels` = les niveaux RÉELLEMENT injectés (fichier trouvé),
// PAS tous les candidats calculés — le systemMessage doit refléter ce qui a
// vraiment été lu, pas ce qui aurait pu l'être.
function loadDocParts(config, server, toolName, toolInput) {
  const parts = [];
  const levels = [];
  for (const { relPath, sourceLabel, level } of lib.docCandidatePaths(config, server, toolName, toolInput)) {
    const content = readDocFile(relPath);
    if (content) {
      parts.push(content + `\n[source: ${sourceLabel}]`);
      levels.push(level);
    }
  }
  return { parts, levels };
}

// ⚠️ `showNotification` NE COUPE JAMAIS l'injection (additionalContext) —
// contrôle UNIQUEMENT le systemMessage visible. Couper l'injection entière
// n'aurait aucun sens (c'est la seule raison d'être du hook).
function allow(doc, server, levels, config) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: doc,
    },
  };
  if (lib.shouldShowNotification(config)) out.systemMessage = lib.formatSystemMessage(server, levels);
  console.log(JSON.stringify(out));
  process.exit(0);
}

readStdinJson((data) => {
  try {
    const toolName = data.tool_name || '';
    const toolInput = data.tool_input || {};
    const sessionId = data.session_id;
    const config = loadConfig();

    // ⚠️ INTERRUPTEUR GLOBAL : config.json → "enabled". ON par défaut. Coupe
    // TOUT (injection ET tracking d'état) — vérifié EN PREMIER, aucun effet
    // de bord même partiel quand désactivé. DISTINCT de "showNotification"
    // (qui ne coupe QUE le message visible, cf allow()) — 2 réglages indépendants.
    if (!lib.isFrameworkEnabled(config)) process.exit(0);

    pruneOldStateFiles(); // hygiène : borne la croissance de state/, probabiliste, jamais bloquant

    const server = lib.serverName(toolName);
    const active = server ? lib.isServerActive(config, server) : false;

    // ⚠️ SECTION CRITIQUE sous LOCK : load → décide → modifie compteurs des
    // AUTRES serveurs → sauvegarde. Protège contre deux invocations parallèles
    // du hook pour le MÊME session_id qui écraseraient l'une l'autre sans lock.
    // Fail-open : si le lock ne peut pas être acquis (contention/erreur fs),
    // fallback = pas d'injection plutôt que planter — cf lock.js.
    const result = withLock(lockDirFor(sessionId), () => {
      const state = loadState(sessionId);

      // Décision AVANT toute incrémentation : lit le compteur du serveur ciblé
      // tel qu'il était avant cet appel (non affecté par cet appel lui-même).
      let shouldInject = false;
      if (server && active) {
        const serverMode = lib.modeFor(config, server);
        const entry = state[server] || { seen: false, sinceLastCall: 0 };
        const threshold = lib.thresholdFor(config, server);
        shouldInject = lib.shouldInjectFor(serverMode, entry.seen, entry.sinceLastCall, threshold);
      }

      // ⚠️ COMPTEURS INDÉPENDANTS : CET appel (MCP actif/inactif ou natif) est
      // "étranger" à TOUS les AUTRES serveurs déjà vus SAUF `server` lui-même.
      // Chaque serveur cible n'avance QUE si SON PROPRE mode est "smart".
      let changed = false;
      for (const key of Object.keys(state)) {
        if (key === server) continue;
        if (state[key] && state[key].seen && lib.modeFor(config, key) === 'smart') {
          state[key].sinceLastCall = (state[key].sinceLastCall || 0) + 1;
          changed = true;
        }
      }

      if (!server || !active) {
        if (changed) saveState(sessionId, state);
        return { inject: false };
      }

      // Rappeler ce serveur remet TOUJOURS son propre compteur à 0.
      state[server] = { seen: true, sinceLastCall: 0 };
      saveState(sessionId, state);

      return { inject: shouldInject };
    }, { fallback: { inject: false } });

    if (!result || !result.inject) process.exit(0);

    const { parts, levels } = loadDocParts(config, server, toolName, toolInput);
    if (parts.length === 0) process.exit(0); // aucune doc à aucun des 3 niveaux

    allow(parts.join('\n\n---\n\n'), server, levels, config);
  } catch {
    process.exit(0); // fail-open
  }
}, () => process.exit(0)); // JSON invalide → fail-open
