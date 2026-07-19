// ═══════════════════════════════════════════════════════════════════════
// DIFFÉRENTIEL LOADER — rulesFromCorpus(302 docs migrées) ≡ protected-paths.json
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LE FILET DE LA BASCULE côté DONNÉES : file-differential.test.js prouve que le
//    MOTEUR (sources/file.js) est équivalent à protect-files.js — mais les deux y
//    lisent le MÊME protected-paths.json. Ce test prouve l'autre moitié : les règles
//    RECONSTRUITES depuis les frontmatters donnent les MÊMES docs, dans le MÊME ordre,
//    que les règles JSON. In-process (zéro spawn) → tourne à CHAQUE npm test.
//
// ⚠️ PIÈGE COUVERT : l'ENTRELACEMENT. Dans le JSON, les règles d'une doc peuvent être
//    dispersées (doc A aux index 0 et 10, doc B au 5). Le loader regroupe par doc
//    (rank = index de la 1ʳᵉ règle) → l'ordre d'évaluation change pour les règles
//    tardives. Seul un rejeu sur corpus réel prouve que ça ne change RIEN aux docs
//    injectées (le dédup « première gagnante » masque l'entrelacement… ou pas).
//
// ⚠️ SKIPPÉ sur clone vierge (home absent) — hurle en local, là où la bascule se joue.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { matchingDocs } from './sources/file';
import { rulesFromCorpus } from './loader.js';

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const RULES_PATH = path.join(HOOKS_DIR, 'protected-paths.json');
const DOCS_DIR = path.join(HOOKS_DIR, 'docs');
const available = fs.existsSync(RULES_PATH) && fs.existsSync(DOCS_DIR);

function readCorpus(dir, prefix) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + e.name;
    if (e.isDirectory()) out.push(...readCorpus(path.join(dir, e.name), rel + '/'));
    else if (e.name.endsWith('.md')) out.push({ doc: rel, text: fs.readFileSync(path.join(dir, e.name), 'utf8') });
  }
  return out;
}

// Cas dérivés des règles réelles — même dérivation que file-differential.test.js.
function buildCases(rules) {
  const cases = [];
  for (const r of rules) {
    if (typeof r.pattern !== 'string' || !r.pattern) continue;
    const p = r.pattern.replace(/\/$/, '');
    const base = `C:/Users/dev/Desktop/${p}`;
    const scopeHint = Array.isArray(r.scope) && r.scope.length ? r.scope[0] : '';
    cases.push({ toolName: 'Read', toolInput: { file_path: base } });
    if (scopeHint) cases.push({ toolName: 'Read', toolInput: { file_path: `C:/Users/dev/Desktop/${scopeHint}/${p}` } });
    cases.push({ toolName: 'Edit', toolInput: { file_path: base.replace(/\//g, '\\').toUpperCase() } });
  }
  return cases;
}

test('différentiel loader : frontmatters ≡ protected-paths.json (docs identiques, ORDONNÉES)', { skip: !available && 'home absent (clone vierge)' }, () => {
  const jsonRules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')).rules;
  const loaderRules = rulesFromCorpus(readCorpus(DOCS_DIR, 'docs/'));

  const cases = buildCases(jsonRules);
  const divergences = [];
  for (const payload of cases) {
    const a = matchingDocs(jsonRules, payload).map((d) => d.doc).join('|');
    const b = matchingDocs(loaderRules, payload).map((d) => d.doc).join('|');
    if (a !== b) divergences.push({ entree: payload.toolInput.file_path, json: a, loader: b });
  }
  assert.deepStrictEqual(divergences.slice(0, 5), [], `${divergences.length}/${cases.length} divergences loader↔JSON`);
});
