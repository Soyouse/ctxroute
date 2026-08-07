// ⚠️ CE QUE CETTE SUITE PROTÈGE : le SEUL témoin qui regarde l'autre bout du
//    tuyau. S'il se trompe, on croit être surveillé alors qu'on ne l'est pas —
//    une fausse confiance vaut moins que pas de témoin du tout.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  verdict, etiquette, compterInjections, SEUIL_EMISSIONS, FENETRE_OCTETS, MARQUE_INJECTION,
} from './canari.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ PLUS AUCUN DIALECTE DE HARNAIS ICI (07/08/2026). Cette suite déclarait
//    `MARQUE_APPEL = '"type":"tool_use"'` pour simuler le comptage des appels
//    dans le transcript. Ce comptage a été SUPPRIMÉ : la doc officielle Codex
//    dit « the transcript format isn't a stable interface for hooks and may
//    change over time ». Le dénominateur vient désormais de notre propre
//    compteur d'émissions (`emission-core`), et la ligne de bruit ci-dessous ne
//    sert plus qu'à prouver qu'on ne compte PAS n'importe quoi.
const bruitHarnais = () => '{"type":"tool_use","name":"Read"}\n';
const injection = () => 'ma doc\n[source: .claude/hooks/docs/x.md]\n';

// ── LE VERDICT ──────────────────────────────────────────────────────────
test('VIVANT : UNE SEULE injection constatée suffit — on ne compte jamais un attendu', () => {
  // ⚠️ Invariant de conception : le canari ne compare PAS « reçu » à « espéré »
  //    (ce serait de l'estimation). Une trace = le canal transporte. Point.
  assert.equal(verdict(1000, 1), 'vivant');
  assert.equal(verdict(0, 1), 'vivant');
});

test('MORT : des appels, ZÉRO injection, au-delà du seuil', () => {
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort');
  assert.equal(verdict(SEUIL_EMISSIONS + 500, 0), 'mort');
});

test('FRONTIÈRE du seuil : à SEUIL-1 on se TAIT, à SEUIL pile on accuse', () => {
  // ⚠️ Le silence sous le seuil est un CHOIX : accuser trop tôt fabriquerait
  //    des fausses alertes, et un gate qui crie sur du sain cesse d'être lu.
  assert.equal(verdict(SEUIL_EMISSIONS - 1, 0), 'indecidable');
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort');
});

test('INDÉCIDABLE : session qui démarre (rien observé) ⇒ aucune accusation', () => {
  assert.equal(verdict(0, 0), 'indecidable');
});

test('TOTAL : entrées absurdes ⇒ jamais un throw, jamais une accusation', () => {
  // ⚠️ Un canari qui plante est un canari MUET — pire qu'absent, puisqu'on
  //    croirait être surveillé. Il doit encaisser n'importe quelle entrée.
  for (const mauvais of [undefined, null, NaN, -3, 1.5, '30', {}, []]) {
    assert.equal(verdict(mauvais, 0), 'indecidable', 'emissions=' + String(mauvais));
    assert.equal(verdict(SEUIL_EMISSIONS, mauvais), 'mort', 'injections=' + String(mauvais));
  }
});

test("SEUIL : valeur de CONTRAT écrite en dur (jamais dérivée du code testé)", () => {
  // ⚠️ Dériver l'attendu de la constante muterait AVEC le code : le mutant
  //    deviendrait invisible. Précédent réel du parc, cf quality-configs.
  assert.equal(SEUIL_EMISSIONS, 25);
  assert.equal(FENETRE_OCTETS, 2097152);
});

// ── L'ÉTIQUETTE ─────────────────────────────────────────────────────────
test("ÉTIQUETTE : MUETTE quand tout va bien, explicite quand c'est mort", () => {
  // ⚠️ Le silence sur le sain EST la fonctionnalité : une alarme permanente
  //    devient un décor. Ne jamais y mettre un « ✅ ok ».
  assert.equal(etiquette('vivant'), '');
  assert.equal(etiquette('indecidable'), '');
  assert.equal(etiquette('mort'), '💉⚠️ INJECTION MORTE');
  assert.equal(etiquette('nimporte quoi'), '');
});

// ── LE COMPTAGE ─────────────────────────────────────────────────────────
test('COMPTAGE : seules NOS marques comptent — le bruit du harnais est ignoré', () => {
  // ⚠️ CE TEST EST LE CŒUR DU CHANGEMENT DU 07/08/2026. Le transcript contient
  //    quantité de structures propres au harnais ; aucune ne doit peser sur le
  //    verdict, parce que leur format n'est garanti par personne. Seule
  //    `[source:` — que NOUS écrivons — est comptée.
  const s = bruitHarnais() + injection() + bruitHarnais() + bruitHarnais();
  assert.equal(compterInjections(s), 1);
  assert.equal(compterInjections(bruitHarnais().repeat(50)), 0);
});

test('COMPTAGE : occurrences ADJACENTES toutes vues (pas de chevauchement raté)', () => {
  // ⚠️ CONTRAT CHANGÉ le 07/08/2026 (défaut ㉘) — l'INTENTION du test est
  //    intacte (le balayage ne doit pas rater deux occurrences collées), seule
  //    la fixture change : une marque NUE, sans étiquette, ne prouve plus rien.
  //    Ne PAS revenir aux marques nues « parce que c'était plus simple » : ce
  //    sont elles qui rendaient le canari vert sur du texte qui PARLE de lui.
  const m = MARQUE_INJECTION + ' docs/session/a.md]';
  assert.equal(compterInjections(m + m), 2);
  assert.equal(compterInjections(m.repeat(7)), 7);
  // La marque NUE répétée ne prouve AUCUNE injection.
  assert.equal(compterInjections(MARQUE_INJECTION.repeat(7)), 0);
});

test('COMPTAGE : ligne TRONQUÉE en tête ⇒ robuste (la fenêtre coupe au milieu)', () => {
  // ⚠️ La lecture bornée COUPE forcément une ligne. Compter des sous-chaînes
  //    (et non du JSON parsé) est ce qui rend ça inoffensif — ne pas « améliorer »
  //    en parsant, le canari deviendrait fragile au découpage ET dépendant d'un
  //    format que la doc Codex déclare instable, pour zéro gain.
  const tronque = 'e":"tool_use","name":"Bash"}\n' + bruitHarnais() + injection();
  assert.equal(compterInjections(tronque), 1);
});

test('COMPTAGE : entrée non-chaîne ⇒ zéro, jamais un throw', () => {
  for (const mauvais of [undefined, null, 42, {}, []]) {
    assert.equal(compterInjections(mauvais), 0);
  }
});

// ⚠️ TEST SUPPRIMÉ, ET C'EST UN GAIN — « marque d'appel ABSENTE ou VIDE ⇒ zéro ».
//    Il protégeait d'un vrai piège : une coquille oubliant de fournir sa marque
//    de dialecte aurait compté une occurrence à CHAQUE position, fabriquant un
//    verdict « mort » de toutes pièces. Ce paramètre n'existe plus : le mode de
//    panne est ÉLIMINÉ PAR CONSTRUCTION, pas désactivé. Doctrine du repo — on
//    supprime la cause, on ne garde pas un test qui fige du code inutile.

// ── NEGATIVE-CHECK ──────────────────────────────────────────────────────
test('NEGATIVE-CHECK : le canari SAIT accuser (sinon il certifie au lieu de protéger)', () => {
  // ⚠️ Un dead-man switch jamais déclenché est une fausse confiance. On vérifie
  //    ici qu'il existe bien une entrée qui produit l'alerte — et une qui ne la
  //    produit PAS, sans quoi « mort » serait une constante.
  assert.equal(verdict(SEUIL_EMISSIONS, 0), 'mort', 'il sait accuser');
  assert.notEqual(verdict(SEUIL_EMISSIONS, 1), 'mort', "…et il sait s'abstenir");
  assert.notEqual(verdict(SEUIL_EMISSIONS - 1, 0), 'mort', "…et il sait attendre d'en savoir assez");
});

// ── ㉘ AUTO-RÉFÉRENCE : le marqueur CITÉ n'est pas le marqueur LIVRÉ ─────
// ⚠️ DÉFAUT RÉEL trouvé le 07/08/2026 en fermant ② bis (run Codex réel).
//    `compterInjections` comptait TOUTE occurrence de `[source:`. Or ce
//    littéral apparaît dans du TEXTE QUI EN PARLE : les commentaires de
//    `canari.js` lui-même, et 64 docs du parc sur 386 (MESURÉ ce jour) qui
//    citent un fichier source sous cette forme.
// 🛑 CONSÉQUENCE, et c'est ce qui la rend grave : un agent qui LIT une de ces
//    docs — c'est-à-dire exactement le geste de quelqu'un qui ENQUÊTE sur une
//    injection morte — faisait passer le canari au VERT. Le dead-man switch se
//    désamorçait au moment précis où on avait besoin de lui.
// ✅ FILTRE : seule une étiquette de forme ÉMISE compte (`.md` en suffixe, ou
//    préfixe `skill/`). Mesure du parc : sur les marqueurs EN DUR, 23 citent un
//    `.js`, 18 un `.ts`, 7 un `.tsx`, 4 un `.sh`, 3 un `.py` — 4 seulement un
//    `.md`. Le filtre en élimine donc l'écrasante majorité.
// ⚠️ CE N'EST PAS LE FIX COMPLET, et ne jamais le présenter comme tel : il
//    reste 4 docs du parc citant un `.md`. Le fix TOTAL (n'accepter que les
//    étiquettes RÉELLEMENT émises, lues dans le store) exige de toucher
//    `emission-core.js`, par où passe tout le contexte de tous les agents.
test('㉘ une étiquette qui CITE un fichier source ne prouve AUCUNE injection', () => {
  // ⚠️ Chemins GÉNÉRIQUES : dépôt public, jamais un nom de projet/client réel
  //    (gate `fuite-perso-gate` — il a rougi sur la 1re version de ce test).
  assert.equal(compterInjections('voir [source: src/handlers/lifecycle.js]'), 0);
  assert.equal(compterInjections('cf [source: packages/seo/src/rss.ts]'), 0);
  assert.equal(compterInjections('cf [source: deploy.sh] et [source: a.py]'), 0);
});

test('㉘ le commentaire de canari.js sur sa PROPRE marque ne compte pas', () => {
  // ⚠️ Le cas ironique : l'agent qui enquête lit `canari.js`, dont un
  //    commentaire contient `[source: …]`. Avant le fix, ça suffisait à
  //    déclarer le canal vivant.
  assert.equal(compterInjections('(`[source: …]`, posé par la porte)'), 0);
  assert.equal(compterInjections('[source: ]'), 0);
});

test('㉘ une VRAIE étiquette émise compte toujours — aucun faux négatif', () => {
  assert.equal(compterInjections(injection()), 1);
  assert.equal(compterInjections('[source: docs/session/outils.md]'), 1);
  assert.equal(compterInjections('[source: docs/mcp/stripe.md]'), 1);
  assert.equal(compterInjections('[source: skill/ctxroute]'), 1);
  assert.equal(compterInjections(injection() + injection()), 2);
});

test('㉘ étiquette TRONQUÉE par la fenêtre : jamais comptée, jamais une erreur', () => {
  // ⚠️ La fenêtre de 2 Mo coupe au milieu d'une ligne PAR CONSTRUCTION. Une
  //    marque sans `]` est indécidable : on ne compte pas, on ne throw pas.
  assert.equal(compterInjections('bla [source: .claude/hooks/docs/x.m'), 0);
  assert.equal(compterInjections('[source:'), 0);
});

test('㉘ BORNE : un `]` très lointain ne fabrique pas une étiquette', () => {
  // ⚠️ Sans borne, n'importe quelle prose contenant `[source:` puis, 3 000
  //    caractères plus loin, un `]` finissant par « .md » validerait.
  const loin = '[source: ' + 'x'.repeat(300) + '.md]';
  assert.equal(compterInjections(loin), 0);
  // Juste sous la borne : compté (preuve que la borne est bien la limite).
  const court = '[source: ' + 'x'.repeat(150) + '.md]';
  assert.equal(compterInjections(court), 1);
});

test('㉘ TRONCATURE : sans la garde `fin !== -1`, une coupure FABRIQUE une étiquette', () => {
  // ⚠️ FIXTURE DISCRIMINANTE (mutant survivant du 07/08/2026). La fenêtre coupe
  //    juste APRÈS un `.md` mais AVANT le `]`. Sans la garde, `slice(debut, -1)`
  //    rogne le dernier caractère et rend « docs/a.md » — une étiquette PARFAITE
  //    fabriquée par la coupure elle-même. La 1re fixture (« …/x.m ») ne
  //    distinguait rien : elle échouait déjà sur la forme.
  assert.equal(compterInjections('[source: docs/a.mdZ'), 0);
});

test('㉘ BORNE EXACTE : 200 caractères passent, 201 non', () => {
  const etiquette200 = 'x'.repeat(197) + '.md';
  const etiquette201 = 'x'.repeat(198) + '.md';
  assert.equal(etiquette200.length, 200);
  assert.equal(compterInjections('[source: ' + etiquette200 + ']'), 1);
  assert.equal(compterInjections('[source: ' + etiquette201 + ']'), 0);
});
