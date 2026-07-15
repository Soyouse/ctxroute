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
function docCandidatePaths(config, server, toolName, toolInput) {
  const candidates = [{ relPath: `${server}.md`, sourceLabel: `docs/mcp/${server}.md` }];

  const suffix = toolSuffix(toolName, server);
  if (suffix) {
    candidates.push({
      relPath: `${server}/${suffix}.md`,
      sourceLabel: `docs/mcp/${server}/${suffix}.md`,
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
  shouldInjectFor,
  docCandidatePaths,
};
