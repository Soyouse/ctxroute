// ═══════════════════════════════════════════════════════════════════════
// GATE — LE BUDGET DU MOTEUR SUIT LA LIMITE DÉCLARÉE AU HARNAIS
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LE DÉFAUT QU'IL FERME, MESURÉ LE 05/08/2026. Le câblage Codex déclarait
//    `additionalContextLimit = 0` (= « disables spilling », donc AUCUNE limite)
//    depuis le 04/08. Son commentaire disait même « c'est POUR ÇA que Codex n'a
//    pas besoin de fragmentation ». Mais PERSONNE ne l'avait dit au moteur : la
//    coquille ne passait aucun budget, le moteur appliquait son plancher de
//    8 000, et un skill de 76 000 c partait en **11 gestes au lieu d'1**.
//    Tout était vert — 995 tests, mutation 100 %, doctor 27/27, canari vivant.
//    C'est un VERT QUI MENT : pas une panne, une DÉGRADATION silencieuse.
//
// ⚠️ LA CLASSE D'ERREUR, à retenir plus que le cas : **tout ce qu'on DÉCLARE à
//    un harnais doit être RELU par le moteur, jamais deviné en parallèle.**
//    Deux endroits pour un même chiffre = divergence garantie. C'est le
//    couplage implicite, ennemi n°1 de la doctrine du parc.
//
// ⚠️ POURQUOI EN ARGUMENT DE COMMANDE. Le chiffre voyage AVEC sa déclaration,
//    dans le même bloc TOML, l'un sous l'autre — on ne peut plus en changer un
//    seul sans que ce gate rougisse. Les alternatives ont été écartées :
//    en dur dans le code = la 2ᵉ source qu'on vient de supprimer ; lu au
//    runtime = une I/O de plus à CHAQUE appel d'outil sur un chemin fail-open.
//    C'est exactement le motif déjà éprouvé de `--paquet k --paquets N`.
//
// ⚠️ SKIP PROPRE si le câblage machine n'existe pas (CI, checkout frais, fork) :
//    un gate qui exige la machine du mainteneur serait ROUGE chez tout le monde.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import fs from 'node:fs';
import assert from 'node:assert';

const CABLAGE = 'C:/ProgramData/OpenAI/Codex/requirements.toml';
const present = fs.existsSync(CABLAGE);

/**
 * Découpe le TOML en BLOCS de hook et rend, pour chacun, la commande et la
 * limite déclarée. ⚠️ Volontairement rustique : on ne parse pas le TOML (pas de
 * dépendance pour un gate), on lit des blocs séparés par `[[`. Ce qui compte
 * est que les deux valeurs soient lues DANS LE MÊME bloc — c'est là qu'est
 * l'invariant.
 */
function blocs(toml) {
  return toml
    .split(/\n(?=\[\[)/)
    .map((b) => {
      const cmd = /^command\s*=\s*['"]([^'"]+)['"]/m.exec(b);
      const lim = /^additionalContextLimit\s*=\s*(-?\d+)/m.exec(b);
      if (!cmd) return null;
      const budget = /--budget\s+(-?\d+)/.exec(cmd[1]);
      const script = /([\w-]+)\.js/.exec(cmd[1]);
      return {
        script: script ? script[1] + '.js' : cmd[1],
        limite: lim ? Number(lim[1]) : null,
        budget: budget ? Number(budget[1]) : null,
      };
    })
    .filter(Boolean);
}

// Un ÉMETTEUR est un hook qui peut produire de l'`additionalContext` : c'est
// exactement celui pour qui Codex accepte un `additionalContextLimit` (les
// autres, le binaire les ignore — « this event cannot emit additionalContext »).
const emetteurs = (bs) => bs.filter((b) => b.limite !== null);

test.skipIf(!present)('GATE : chaque émetteur Codex DÉCLARE son budget au moteur', () => {
  const sans = emetteurs(blocs(fs.readFileSync(CABLAGE, 'utf8')))
    .filter((b) => b.budget === null)
    .map((b) => b.script);
  assert.deepStrictEqual(
    sans,
    [],
    'Ces hooks déclarent une limite au harnais mais ne la passent PAS au moteur :\n  '
      + sans.join('\n  ')
      + "\n⇒ le moteur applique son plancher et morcelle pour rien, EN SILENCE."
      + "\n   Ajouter `--budget <même chiffre>` à leur `command`.");
});

test.skipIf(!present)('GATE : limite déclarée et budget passé sont le MÊME chiffre', () => {
  const ecarts = emetteurs(blocs(fs.readFileSync(CABLAGE, 'utf8')))
    .filter((b) => b.budget !== null && b.budget !== b.limite)
    .map((b) => `${b.script} : additionalContextLimit=${b.limite} mais --budget ${b.budget}`);
  assert.deepStrictEqual(
    ecarts,
    [],
    'DIVERGENCE entre ce qu on déclare au harnais et ce qu on dit au moteur :\n  '
      + ecarts.join('\n  '));
});

// ⚠️ NEGATIVE-CHECK OBLIGATOIRE — leçon des `*-must-stay-pure` (03/08/2026),
//    documentés partout comme LA garantie et incapables de rougir. Un gate non
//    saboté est un gate présumé inerte.
// ⚠️ SABOTAGE EN MÉMOIRE, jamais sur le fichier réel : c'est une POLITIQUE
//    MACHINE en production, lue par tous les agents Codex qui tournent.
test('NEGATIVE : une divergence est DÉTECTÉE (gate non inerte)', () => {
  const sain = [
    '[[hooks.PreToolUse.hooks]]',
    "command = 'node x/codex-doc-inject.js --budget 0'",
    'additionalContextLimit = 0',
  ].join('\n');
  const divergent = sain.replace('--budget 0', '--budget 5000');
  const muet = sain.replace(' --budget 0', '');

  assert.strictEqual(emetteurs(blocs(sain)).filter((b) => b.budget !== b.limite).length, 0,
    'témoin : un câblage cohérent ne rougit pas');
  assert.strictEqual(emetteurs(blocs(divergent)).filter((b) => b.budget !== b.limite).length, 1,
    'SABOTAGE NON DÉTECTÉ : deux chiffres différents passeraient au vert.');
  assert.strictEqual(emetteurs(blocs(muet)).filter((b) => b.budget === null).length, 1,
    'SABOTAGE NON DÉTECTÉ : un émetteur sans budget passerait au vert.');
});
