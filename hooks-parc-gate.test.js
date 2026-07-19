// ═══════════════════════════════════════════════════════════════════════
// GATE DU PARC — aucun hook de ~/.claude/hooks/ ne peut zombifier
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ CE GATE COUVRE CE QUE `deadline-gate.test.js` NE VOIT PAS.
//    L'autre ne lit que CE repo (2 hooks). Le parc réel, c'est 7 hooks de plus
//    dans `~/.claude/hooks/` — dont `statusline.js`, LE coupable des 875 zombies
//    du 15/07/2026 (20 h de survie, 26 Go). Sans ce test, la règle serait prouvée
//    sur les 2 fichiers qui n'avaient jamais fui, et absente sur les 7 qui fuient.
//    Un principe appliqué à 22% du parc n'est pas de l'ingénierie, c'est une intention.
//
// ⚠️ SKIP SUR CLONE VIERGE — repo PUBLIC : il ne DOIT jamais exiger l'existence
//    de `~/.claude/hooks/`. Sauter n'est PAS échouer (cf gitignore.md, leçon du
//    15/07/2026 : un gate de repo doit valoir sur un clone vierge).
//
// ⚠️ NE JAMAIS ajouter d'exception « ce hook-là n'en a pas besoin ». Le hook qui
//    « n'en a pas besoin » est exactement celui qui zombifiera. Un fichier ne lit
//    pas stdin OU il porte une échéance. Pas de 3ᵉ cas.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PARC = path.join(os.homedir(), '.claude', 'hooks');
const present = fs.existsSync(PARC);

// Un HOOK = un .js qui lit stdin. ⚠️ Dérivé du CONTENU, jamais d'une liste à la
// main : une liste oublie le prochain fichier ajouté — le trou exact qu'on ferme.
function hooksDuParc() {
  return fs
    .readdirSync(PARC)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => ({ name: f, src: fs.readFileSync(path.join(PARC, f), 'utf8') }))
    .filter((h) => /process\.stdin/.test(h.src) || /require\(['"]\.\/stdin-json['"]\)/.test(h.src))
    // `deadline.js` lui-même = la copie vendorisée, il EST l'échéance.
    .filter((h) => h.name !== 'deadline.js');
}

test(
  'aucun hook de ~/.claude/hooks/ ne lit stdin sans échéance',
  { skip: !present && 'pas de ~/.claude/hooks/ (clone vierge / autre machine)', timeout: 300000 },
  () => {
    const hooks = hooksDuParc();

    // ⚠️ Zéro hook détecté = gate aveugle qui passerait au VERT pour toujours.
    //    Déjà vécu le 15/07/2026 sur deadline-gate.test.js : il ne cherchait que
    //    `process.stdin` et n'analysait AUCUN hook réel. Un gate vide CERTIFIE.
    assert.ok(hooks.length > 0, `aucun hook lisant stdin détecté dans ${PARC} — gate aveugle, vérifier hooksDuParc()`);

    const nus = hooks
      .filter((h) => !/require\(['"]\.\/deadline['"]\)/.test(h.src) || !/\barm\s*\(/.test(h.src))
      .map((h) => h.name);

    assert.deepStrictEqual(
      nus,
      [],
      `${nus.length}/${hooks.length} hook(s) du parc SANS échéance → zombie garanti quand le harnais ` +
        `ne ferme pas stdin (bug Claude Code Windows #68626 — 875 zombies mesurés le 15/07/2026).\n` +
        `Corriger dans CHACUN, avant toute I/O :\n` +
        `  const deadline = require('./deadline');\n` +
        `  deadline.arm();`
    );
  }
);
