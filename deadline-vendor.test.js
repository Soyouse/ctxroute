// ═══════════════════════════════════════════════════════════════════════
// DRIFT-TEST — la copie vendorisée de deadline.js ne doit JAMAIS diverger
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI UNE COPIE PLUTÔT QU'UN require() :
//    Les hooks de `~/.claude/hooks/` ne DOIVENT PAS dépendre de ce repo.
//    Un `require('C:/Users/dev/Desktop/ctxroute/deadline.js')` marcherait
//    aujourd'hui et mourrait le jour où le dossier bouge/disparaît — l'environnement
//    perso deviendrait OTAGE d'un repo public. `deadline.js` est autonome
//    (gate `deadline-stays-standalone`) EXPRÈS POUR ÇA : il est copiable tel quel.
//
// ⚠️ MAIS UNE COPIE DÉRIVE — c'est l'ennemi n°1 (vérité partagée dupliquée sans
//    lien dans le code). La copie n'est acceptable QUE parce que ce test existe.
//    Le supprimer transforme un vendoring maîtrisé en dette silencieuse :
//    corriger un bug dans l'original ne corrigerait plus les 7 hooks, et RIEN
//    ne le dirait. Ne JAMAIS le supprimer « parce qu'il gêne ».
//
// ⚠️ SKIP SUR CLONE VIERGE — le repo est PUBLIC : il ne DOIT jamais exiger
//    l'existence de `~/.claude/hooks/`. Ce test ne hurle que là où les DEUX
//    copies existent, c.-à-d. chez le mainteneur. Un gate de repo doit valoir sur un
//    clone vierge (leçon du 15/07/2026, cf gitignore.md).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ORIGINAL = path.join(__dirname, 'deadline.js');
const VENDOR = path.join(os.homedir(), '.claude', 'hooks', 'deadline.js');

const vendored = fs.existsSync(VENDOR);

test(
  'la copie vendorisée de deadline.js est IDENTIQUE à l\'original',
  { skip: !vendored && 'pas de copie vendorisée (clone vierge / autre machine)', timeout: 300000 },
  () => {
    // ⚠️ Comparaison sur le contenu NORMALISÉ (fins de ligne) : git peut convertir
    //    LF↔CRLF au checkout (.gitattributes), ce qui ferait rougir le test pour
    //    une raison qui n'est PAS une dérive. On compare le code, pas les octets.
    const norm = (s) => s.replace(/\r\n/g, '\n');
    const a = norm(fs.readFileSync(ORIGINAL, 'utf8'));
    const b = norm(fs.readFileSync(VENDOR, 'utf8'));

    assert.strictEqual(
      b,
      a,
      'DÉRIVE : ~/.claude/hooks/deadline.js ≠ ctxroute/deadline.js.\n' +
        'Les 7 hooks du parc tournent donc sur une version différente de celle testée ici.\n' +
        'Corriger en recopiant l\'original :\n' +
        `  cp "${ORIGINAL}" "${VENDOR}"`
    );
  }
);
