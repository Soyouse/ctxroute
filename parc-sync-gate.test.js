// ═══════════════════════════════════════════════════════════════════════
// GATE PARC↔REPO — le repo est AUTO-SUFFISANT pour un fork (19/07/2026).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE (décision mainteneur) : un fork/mainteneur externe doit
//    trouver DANS le repo la totale — skill du framework + docs injectables
//    DU framework. Or ces fichiers VIVENT câblés dans le parc du mainteneur
//    (~/.claude/commands/mcp-doc-hooks.md + ~/.claude/hooks/docs/mcp-doc-hooks/)
//    → deux copies. Ce gate rend la dérive IMPOSSIBLE : tout écart = ROUGE.
//
// ⚠️ SENS DE LA VÉRITÉ : le PARC est la copie CÂBLÉE (ce que les agents
//    reçoivent), docs/framework/ est le MIROIR VERSIONNÉ. Éditer le parc →
//    recopier ici (cp) dans le MÊME geste. Un fork sans parc édite le repo.
//
// ⚠️ SKIP PROPRE si le parc n'existe pas (CI, checkout frais, machine fork) :
//    l'égalité n'a de sens que là où les deux copies existent. Sur la machine
//    du mainteneur, ce gate tourne à CHAQUE npm test.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_DIR = path.join(import.meta.dirname, 'docs', 'framework');
const PARC_SKILL = path.join(os.homedir(), '.claude', 'commands', 'mcp-doc-hooks.md');
const PARC_DOCS = path.join(os.homedir(), '.claude', 'hooks', 'docs', 'mcp-doc-hooks');

const parcExists = fs.existsSync(PARC_DOCS) && fs.existsSync(PARC_SKILL);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('docs/framework/ existe et n\'est pas vide (la totale pour un fork)', () => {
  const files = fs.readdirSync(REPO_DIR).filter((f) => f.endsWith('.md'));
  assert.ok(files.includes('SKILL.md'), 'SKILL.md absent de docs/framework/ — un fork n\'a pas le skill.');
  assert.ok(files.length >= 20, `docs/framework/ ne contient que ${files.length} fichiers — docs injectables manquantes.`);
});

test.skipIf(!parcExists)('SKILL.md du repo == skill câblé du parc (dérive = ROUGE, recopier)', () => {
  assert.strictEqual(read(path.join(REPO_DIR, 'SKILL.md')), read(PARC_SKILL),
    'docs/framework/SKILL.md diverge de ~/.claude/commands/mcp-doc-hooks.md — recopier le parc vers le repo (ou l\'inverse sur un fork).');
});

test.skipIf(!parcExists)('chaque doc injectable du parc a son miroir IDENTIQUE dans le repo (aucune oubliée)', () => {
  for (const f of fs.readdirSync(PARC_DOCS).filter((x) => x.endsWith('.md'))) {
    const mirror = path.join(REPO_DIR, f);
    assert.ok(fs.existsSync(mirror), `doc du parc SANS miroir repo : ${f} — un fork ne l'aura pas.`);
    assert.strictEqual(read(mirror), read(path.join(PARC_DOCS, f)),
      `dérive parc↔repo sur ${f} — recopier dans le même geste que l'édition.`);
  }
});

test.skipIf(!parcExists)('aucun fichier repo orphelin (doc supprimée du parc mais laissée dans le repo)', () => {
  const parcFiles = new Set(fs.readdirSync(PARC_DOCS).filter((x) => x.endsWith('.md')));
  for (const f of fs.readdirSync(REPO_DIR).filter((x) => x.endsWith('.md') && x !== 'SKILL.md')) {
    assert.ok(parcFiles.has(f), `fichier repo orphelin : docs/framework/${f} (absent du parc) — le supprimer ou re-câbler.`);
  }
});
