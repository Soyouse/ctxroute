#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Logique DÉCISIONNELLE PURE — zéro I/O (aucun fs/process/network).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ NE JAMAIS importer `fs`/`path`/`process.env` ici. Ce module existe pour
// isoler la décision de l'I/O résiduel (doctrine : "fonction pure → testable
// /mutable ; I/O résiduel = intégration/contrat"). C'est ce qui permet à
// Stryker de muter cette logique sans bruit (un fichier mêlé à du fs/stdin
// produit des mutants équivalents non détectables — faux signal).
//
// Consommé par mcp-doc-inject.js (le seul point d'I/O : lit stdin/fs, appelle
// ces fonctions, écrit stdout/fs). AUCUNE fonction ici ne doit avoir d'effet
// de bord observable — mêmes entrées ⇒ mêmes sorties, toujours.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Sanitise un session_id pour un nom de fichier sûr cross-OS. 'unknown' si vide.
// ⚠️ UN SEUL fallback ('unknown' en sortie) — pas de double-default redondant
// (un `|| 'unknown'` sur l'entrée ET la sortie produit un mutant équivalent
// indétectable : les deux chemins convergent silencieusement).
function sanitizeSessionId(sessionId) {
  const safe = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'unknown';
}

// Extrait le nom de serveur depuis "mcp__{server}__{tool}". null si pas un outil MCP.
// ⚠️ PAS de garde falsy en amont : RegExp.prototype.exec() coerce déjà tout
// argument non-string en string (undefined→"undefined", null→"null"...) —
// AUCUNE de ces coercions ne matche jamais le préfixe "mcp__", donc une garde
// explicite serait un mutant équivalent (zéro protection réelle en plus).
function serverName(toolName) {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(toolName);
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

// Seuil effectif pour CE serveur : override servers.{server}.threshold > defaultThreshold > 4.
function thresholdFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].threshold;
  return Number.isInteger(override) ? override : (Number.isInteger(config.defaultThreshold) ? config.defaultThreshold : 4);
}

// Mode effectif pour CE serveur : override servers.{server}.mode > mode global > "smart".
function modeFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].mode;
  return override || config.mode || 'smart';
}

// Interrupteur GLOBAL du framework entier (config.json → "enabled").
// ⚠️ Coupe TOUT (injection additionalContext ET tracking d'état/compteurs) —
// pattern standard (ESLint, git hooks SKIP=...) pour désactiver temporairement
// sans retirer le câblage settings.json. DISTINCT de "showNotification" (qui ne
// coupe QUE le message visible) — les 2 réglages sont indépendants et composables :
// enabled:false + showNotification:true = incohérent mais inoffensif (rien à notifier).
// ON par défaut — SEULE la valeur `false` littérale désactive (fail-open).
function isFrameworkEnabled(config) {
  return config.enabled !== false;
}

// Interrupteur de la NOTIFICATION VISIBLE uniquement (config.json → "showNotification").
// ⚠️ NE COUPE JAMAIS l'injection elle-même (additionalContext) — seulement le
// systemMessage user-only qui l'accompagne. Couper l'injection entière n'aurait
// aucun sens (c'est la seule raison d'être du framework) ; ce réglage sert
// uniquement à l'utilisateur qui préfère ne PAS voir le badge "📄 [mcp-doc-hooks]"
// à chaque injection tout en gardant le bénéfice réel (contexte livré à l'agent).
// ON par défaut — SEULE la valeur `false` littérale désactive la notification
// (fail-open : une config cassée ne doit jamais désactiver silencieusement
// la transparence envers l'utilisateur).
function shouldShowNotification(config) {
  return config.showNotification !== false;
}

// Formatte le systemMessage USER-ONLY affiché quand une injection a lieu.
// ⚠️ Préfixe "[mcp-doc-hooks]" EXPLICITE pour que l'utilisateur distingue
// cette source des autres systèmes de doc injectable (ex: protect-files.js
// affiche juste "📄 doc: xxx" sans préciser sa provenance — ambigu si les
// deux systèmes tournent dans la même session, cf incident 15/07/2026 où
// Théo a confondu les deux sources).
// `levels` = tableau des labels de niveau injectés cette fois (ex: ["server"],
// ["server","tool"], ["server","tool","subTool"]) — rend visible la granularité
// réelle, pas juste "un truc a été injecté pour ce serveur".
function formatSystemMessage(server, levels) {
  const suffix = Array.isArray(levels) && levels.length > 1 ? ` (${levels.slice(1).join('+')})` : '';
  return `📄 [mcp-doc-hooks] ${server}${suffix}`;
}

// Le serveur est-il couvert par le framework selon filterMode/filterList ?
// ⚠️ "whitelist" et "blacklist" sont symétriques : whitelist = liste des SEULS
// autorisés, blacklist = liste des SEULS exclus. "none"/valeur inconnue = tout couvert
// (fail-open : une config cassée ne doit jamais silencieusement tout désactiver).
function isServerActive(config, server) {
  const filterMode = config.filterMode; // ⚠️ pas de défaut 'none' : toute valeur ≠ whitelist/blacklist tombe déjà sur `return true` plus bas — un défaut explicite serait un mutant équivalent (jamais comparé à 'none' lui-même).
  const list = Array.isArray(config.filterList) ? config.filterList : [];
  if (filterMode === 'whitelist') return list.includes(server);
  if (filterMode === 'blacklist') return !list.includes(server);
  return true;
}

// Décide s'il faut (ré)injecter pour CE serveur, à partir de son état AVANT
// cet appel (entrySeen/sinceLastCall non affectés par l'appel courant).
// Pure : ne lit/écrit aucun état, se contente de trancher.
function shouldInjectFor(mode, entrySeen, sinceLastCall, threshold) {
  if (mode === 'dumb') return true;
  if (!entrySeen) return true; // 1er appel du serveur, tous modes
  if (mode === 'smart') return sinceLastCall >= threshold;
  return false; // "once" déjà vu = jamais
}

// Calcule les chemins RELATIFS (sous docs/mcp/) des docs candidates pour cet
// appel précis, du plus GLOBAL au plus SPÉCIFIQUE — AUCUNE lecture disque ici,
// juste le calcul des chemins. Le caller (I/O) filtre ceux qui existent vraiment.
//   1. {server}.md
//   2. {server}/{tool}.md       (suffixe outil, si présent)
//   3. {server}/{subTool}.md    (paramètre sous-outil, si configuré ET présent)
// ⚠️ Dédoublonne le niveau 3 si subTool === suffix (sinon double lecture du même fichier).
// ⚠️ Chaque candidat porte un `level` ("server"/"tool"/"subTool") — permet à
// l'appelant (I/O) de composer un systemMessage qui montre la granularité
// RÉELLEMENT injectée (pas juste "un truc a été injecté"), cf formatSystemMessage().
function docCandidatePaths(config, server, toolName, toolInput) {
  const candidates = [{ relPath: `${server}.md`, sourceLabel: `docs/mcp/${server}.md`, level: 'server' }];

  const suffix = toolSuffix(toolName, server);
  if (suffix) {
    candidates.push({
      relPath: `${server}/${suffix}.md`,
      sourceLabel: `docs/mcp/${server}/${suffix}.md`,
      level: 'tool',
    });
  }

  // ⚠️ Pas de garde `if (subToolParam)` avant l'appel : getByPath() est déjà
  // sûre sur une entrée falsy (typeof dottedPath !== 'string' → null immédiat).
  // Une garde redondante ici serait un mutant équivalent (même résultat avec/sans).
  const subToolParam = config.servers && config.servers[server] && config.servers[server].subToolParam;
  const subTool = getByPath(toolInput, subToolParam);
  if (subTool && subTool !== suffix) {
    candidates.push({
      relPath: `${server}/${subTool}.md`,
      sourceLabel: `docs/mcp/${server}/${subTool}.md`,
      level: 'subTool',
    });
  }

  return candidates;
}

module.exports = {
  sanitizeSessionId,
  serverName,
  toolSuffix,
  getByPath,
  thresholdFor,
  modeFor,
  isServerActive,
  isFrameworkEnabled,
  shouldShowNotification,
  formatSystemMessage,
  shouldInjectFor,
  docCandidatePaths,
};
