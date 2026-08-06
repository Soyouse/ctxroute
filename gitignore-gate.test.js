// ═══════════════════════════════════════════════════════════════════════
// GATE — AUCUN fichier de state/ n'est tracké par git.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ Né d'un incident RÉEL (16/07/2026) : `state/*.json` ne couvrait pas `.jsonl`
//    → le journal SHADOW (payloads réels : chemins, commandes des sessions de
//    le mainteneur) est parti sur GitHub dans un commit. `state/` = runtime, PRIVÉ,
//    jamais committable — quel que soit le format qu'un futur hook y écrira.
//    Le pattern par-extension re-cassera au prochain format ; ce gate, non.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

test('GATE : git ne tracke AUCUN fichier sous state/', () => {
  const out = execFileSync('git', ['ls-files', 'state/'], { cwd: __dirname, encoding: 'utf8' }).trim();
  assert.strictEqual(out, '', `fichiers de state/ TRACKÉS (données runtime privées → GitHub) :\n${out}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// DOCS PERSO — les 3 NIVEAUX MCP sont ignorés, pas seulement le premier
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 TROU DE FUITE RÉEL (06/08/2026, repo PUBLIC) : `docs/mcp/*.md` ne couvrait
//    que le niveau 1 (serveur). Les niveaux 2 et 3 —
//    `docs/mcp/{server}/{tool}.md` et `{subTool}.md` — n'étaient PAS ignorés,
//    alors que ce sont les docs les plus SPÉCIFIQUES, donc les plus susceptibles
//    de nommer un client, un montant, un identifiant. Découvert en créant les
//    premières docs de niveau 2 : `git status` les proposait au commit.
// ⚠️ Le trou existait depuis que la granularité 3 niveaux existe — personne ne
//    l'avait vu parce que personne n'avait encore écrit de doc de niveau 2.
//    Une classe d'erreur dormante n'est pas une classe d'erreur absente.
// ⚠️ TESTE LA RÈGLE, PAS LES FICHIERS : `git check-ignore` juge des chemins
//    FICTIFS, donc ce gate vaut sur un CLONE VIERGE (où aucune doc perso
//    n'existe). Exiger la présence d'un fichier serait vert chez son auteur et
//    faux partout ailleurs — l'erreur déjà commise le 15/07/2026 par config-gate.

function estIgnore(rel) {
  try {
    execFileSync('git', ['check-ignore', '-q', rel], { cwd: __dirname });
    return true;
  } catch {
    return false; // exit 1 = non ignoré
  }
}

test('GATE : les 3 NIVEAUX de docs MCP perso sont ignorés', () => {
  const doivent = [
    'docs/mcp/stripe.md',                       // niveau 1 — serveur
    'docs/mcp/stripe/create_refund.md',         // niveau 2 — outil
    'docs/mcp/odoo/delete_record.md',           // niveau 3 — sous-outil
    'docs/session/outils.md',                   // savoir de session, perso aussi
  ];
  const fuites = doivent.filter((r) => !estIgnore(r));
  assert.deepStrictEqual(fuites, [],
    'CHEMINS NON IGNORÉS sur un dépôt PUBLIC :\n  ' + fuites.join('\n  ')
    + '\nCes docs portent des noms de clients, des montants, des identifiants.'
    + '\nCorriger .gitignore (`**` couvre les sous-dossiers), jamais le contourner.');
});

test('GATE : les `.md.example` GÉNÉRIQUES restent poussables (les 3 niveaux)', () => {
  // ⚠️ CONTREPARTIE OBLIGATOIRE : un `.gitignore` trop large tuerait les
  //    exemples publics, donc la doc d'installation du projet. Sans ce volet,
  //    « tout ignorer » passerait pour une correction valable.
  const doiventPasser = [
    'docs/mcp/stripe.md.example',
    'docs/mcp/stripe/create_refund.md.example',
    'docs/session/outils.md.example',
  ];
  const perdus = doiventPasser.filter(estIgnore);
  assert.deepStrictEqual(perdus, [],
    'exemples PUBLICS devenus invisibles : ' + perdus.join(', '));
});
