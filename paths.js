#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// SOURCE UNIQUE des chemins du framework (config / docs / state)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ TOUT chemin lu ou ÉCRIT au runtime est déclaré ICI, une seule fois.
// NE JAMAIS refaire un `path.join(__dirname, 'state')` ad-hoc dans un hook :
// `stateDir` était hardcodé à l'identique dans mcp-doc-inject.js ET
// mcp-doc-reset.js — deux copies d'une même vérité qui divergent en silence
// dès que l'une change (exactement la classe de bug que sanitizeSessionId()
// évite déjà pour le FORMAT du nom de fichier ; ici c'est son DOSSIER).
//
// ⚠️ Les 3 env vars sont RÉSERVÉES AUX TESTS ET À doctor.js — jamais un
// réglage utilisateur (la config utilisateur, c'est mcp-doc-config.json).
// Elles existent pour qu'un test/probe s'exécute en isolation TOTALE
// (tmpdir jetable) sans jamais toucher les fichiers livrés du repo. Bug vécu
// (15/07/2026) : les tests d'intégration écrivaient dans le VRAI
// mcp-doc-config.json → framework laissé désactivé en prod, en silence.
//
// ⚠️ Module I/O-adjacent (path + process.env) : NE JAMAIS l'importer depuis
// lib-pure.js, qui doit rester pur (cf .dependency-cruiser.json).
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const path = require('path');
const os = require('os');

// __dirname = racine du repo (ce fichier vit à la racine, par construction).
const ROOT = __dirname;

function configPath() {
  return process.env.MCP_DOC_CONFIG_PATH || path.join(ROOT, 'mcp-doc-config.json');
}

function docsDir() {
  return process.env.MCP_DOC_DOCS_DIR || path.join(ROOT, 'docs', 'mcp');
}

function stateDir() {
  return process.env.MCP_DOC_STATE_DIR || path.join(ROOT, 'state');
}

// Corpus des docs FICHIER (frontmatters migrés le 16/07/2026) — consommé par le
// shadow (puis par le moteur unifié après bascule). Env var RÉSERVÉE aux tests.
function fileDocsDir() {
  return process.env.MCP_DOC_FILEDOCS_DIR || path.join(os.homedir(), '.claude', 'hooks', 'docs');
}

// Corpus des docs SESSION (injectées à CHAQUE SessionStart : startup/resume/
// clear/compact — savoir « comme CLAUDE.md » mais géré par le framework).
// Env var RÉSERVÉE aux tests et à doctor.js.
function sessionDocsDir() {
  return process.env.MCP_DOC_SESSIONDOCS_DIR || path.join(ROOT, 'docs', 'session');
}

// Store des SKILLS du harnais (Claude Code : ~/.claude/commands/{nom}.md).
// LU SEULEMENT (le corps du skill est injecté tel quel) — on n'écrit JAMAIS
// dans un fichier du harnais. Env var RÉSERVÉE aux tests et à doctor.js.
function skillsDir() {
  return process.env.MCP_DOC_SKILLS_DIR || path.join(os.homedir(), '.claude', 'commands');
}

module.exports = { configPath, docsDir, stateDir, fileDocsDir, sessionDocsDir, skillsDir, ROOT };
