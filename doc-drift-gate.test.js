// ═══════════════════════════════════════════════════════════════════════════
// DOC-DRIFT — une doc injectée qui MENT est PIRE que pas de doc (06/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// 🛑 LE DÉFAUT QU'IL FERME, ET IL EST VÉCU : le 03/08/2026, TROIS docs du parc
//    enseignaient l'INVERSE du code (`pw-mcp-child-guard.md` imposait le
//    `stdio:'ignore'` qui ÉTAIT le défaut à corriger · `pw-mcp-transports.md`
//    affirmait « pas conforme au 404 » deux heures après la mise en conformité ·
//    `pw-mcp-concierge.md` décrivait un `ONSTART` abandonné). Elles n'ont été
//    corrigées que parce qu'un agent PASSAIT dessus, par hasard.
//    ⚠️ Une doc injectée porte le ton d'un invariant prouvé (`🛑 OBLIGATOIRE`) :
//    personne ne la remet en cause. Cas limite atteint le même jour — le GATE
//    et sa DOC disaient la même chose FAUSSE : deux remparts d'accord entre eux
//    et tous deux à côté. Il a fallu un audit HUMAIN pour en sortir, ce qui est
//    exactement ce que le 0-human interdit.
//
// ⚠️ CE QU'IL COUVRE, ET SEULEMENT ÇA : la partie DÉCIDABLE du mensonge — une
//    doc qui cite un FICHIER qui n'existe plus (renommage, suppression). C'est
//    la classe qui arrive mécaniquement et que personne ne voit, parce qu'un
//    renommage ne touche jamais les docs qui parlent du fichier renommé.
// 🛑 IL NE PROUVE PAS qu'une doc dit vrai — aucun test ne le peut. Ne JAMAIS le
//    présenter comme « la défense contre les docs qui mentent » : ce serait le
//    faux sentiment de sécurité que ce fichier existe pour combattre.
//
// ⚠️ MESURE AVANT ÉCRITURE (06/08/2026, obligatoire avant tout gate) : 32 docs,
//    936 littéraux entre backticks, 64 fichiers `.js` cités, **0 introuvable**
//    une fois le parc pris en compte. Un critère à faux positifs aurait produit
//    un gate que personne ne lit — donc un gate mort. Ne PAS l'élargir aux
//    identifiants de fonctions sans refaire cette mesure : les docs citent
//    aussi des fonctions d'AUTRES projets, et le bruit tuerait le signal.

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = __dirname;
const MIROIR = path.join(REPO, 'docs', 'framework');
// Le parc n'existe pas sur un clone vierge (CI, fork) — cf parc-sync-gate.
const PARC = path.join(os.homedir(), '.claude', 'hooks');

// ⚠️ SOURCE UNIQUE de la règle « ce littéral est-il un fichier .js ? ».
//    Exportée de fait pour le negative-check : sabote la MÊME fonction, jamais
//    une copie — une copie resterait verte pendant que la vraie règle casse.
function fichiersCites(texte) {
  const out = new Set();
  for (const m of texte.matchAll(/`([^`\n]{3,60})`/g)) {
    const s = m[1].trim();
    // Nom de fichier NU (`budget.js`) ou avec un dossier (`sources/file.js`).
    // ⚠️ Pas de chemin absolu ni de `..` : ce sont des exemples, pas des cibles.
    if (/^[\w-]+(\/[\w-]+)*\.js$/.test(s)) out.add(s);
  }
  return [...out];
}

// ⚠️ TROIS RACINES, et l'ordre n'a aucune importance (existence, pas priorité) :
//    le repo, ses sources/, et le PARC — une doc du framework parle légitimement
//    de `protect-files.js` ou `statusline.js`, qui vivent chez le mainteneur.
//    MESURÉ : sans la racine parc, 8 des 64 fichiers seraient de FAUX rouges.
function localise(rel) {
  for (const base of [REPO, path.join(REPO, 'sources'), PARC]) {
    if (fs.existsSync(path.join(base, rel))) return base;
  }
  return null;
}

function docsDuMiroir() {
  return fs.readdirSync(MIROIR).filter((f) => f.endsWith('.md'));
}

test('DOC-DRIFT ① : tout fichier .js cité par une doc du framework EXISTE', () => {
  const morts = [];
  let verifies = 0;
  for (const doc of docsDuMiroir()) {
    const texte = fs.readFileSync(path.join(MIROIR, doc), 'utf8');
    for (const rel of fichiersCites(texte)) {
      const base = localise(rel);
      if (base === null) {
        // ⚠️ SUR CLONE VIERGE le parc est absent : on ne peut pas JUGER un
        //    fichier qui n'appartient pas au repo. On le saute EXPLICITEMENT
        //    plutôt que de rougir à tort — mais le volet reste actif pour tout
        //    ce qui vit dans le repo, donc il n'est jamais aveugle en CI.
        if (!fs.existsSync(PARC)) continue;
        morts.push(doc + ' cite `' + rel + '` — INTROUVABLE (repo, sources/, parc)');
      } else verifies++;
    }
  }
  assert.deepStrictEqual(morts, [],
    'Une doc INJECTÉE cite un fichier qui n\'existe plus. Renommage ou suppression :\n'
    + '  - soit le fichier a bougé → corriger la doc DANS LE MÊME GESTE ;\n'
    + '  - soit la doc est périmée → la réécrire, jamais la laisser mentir.\n'
    + morts.map((m) => '  ' + m).join('\n'));
  // ⚠️ ANTI-DORMANCE : sans ce plancher, une regex cassée rendrait ZÉRO citation
  //    et le gate serait VERT en n'analysant RIEN — le défaut exact qu'on a payé
  //    trois fois (deps-purete, deadline-gate, couches-gate).
  assert.ok(verifies >= 20, 'gate DORMANT : seulement ' + verifies + ' citations vérifiées (attendu ≥ 20)');
});

test('DOC-DRIFT ② : NEGATIVE-CHECK — une doc citant un fichier mort ROUGIT', () => {
  // ⚠️ EN MÉMOIRE, jamais sur un fichier réel : un sabotage sur disque a déjà
  //    fait tomber 38 tests d'autres suites qui lisaient le même fichier EN
  //    PARALLÈLE (03/08/2026). On sabote la DONNÉE, pas le dépôt.
  const faux = 'Voir `module-qui-nexiste-pas-du-tout.js` pour le détail.';
  const cites = fichiersCites(faux);
  assert.deepStrictEqual(cites, ['module-qui-nexiste-pas-du-tout.js'], 'la règle DOIT voir la citation');
  assert.strictEqual(localise(cites[0]), null, 'et la DOIT déclarer introuvable');
});

test('DOC-DRIFT ③ : la règle ne se déclenche PAS sur ce qui n\'est pas un fichier', () => {
  // ⚠️ CE VOLET PROTÈGE LA VALEUR DU GATE, pas son exactitude : un gate bruyant
  //    est un gate qu'on cesse de lire, puis qu'on contourne. Chaque forme
  //    ci-dessous est présente dans les docs RÉELLES du parc.
  const texte = [
    '`mode: dumb`', '`match`', '`--budget 0`', '`node doctor.js --quiet`',
    '`process.exit(0)`', '`{ shell: true }`', '`additionalContext`', '`0.146.0`',
  ].join(' ');
  assert.deepStrictEqual(fichiersCites(texte), [],
    'faux positif : le gate accuserait une doc saine');
});
