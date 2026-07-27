// ═══════════════════════════════════════════════════════════════════════
// vitest — config. ⚠️ `.mjs` VOLONTAIREMENT.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ LE REPO RESTE CommonJS (`package.json` sans `"type": "module"`), et ça
//    NE CHANGERA PAS. Les hooks sont spawnés à CHAQUE appel d'outil de chaque
//    agent ; le loader ESM de Node est plus lent que `require`, et le plan
//    mesure déjà « 95% de la latence = démarrage de Node ». Passer les SOURCES
//    en ESM ferait payer chaque geste de prod pour accélérer des tests.
//    ⚠️ NE JAMAIS ajouter `"type": "module"` au package.json.
//    D'où `.mjs` ici : ce fichier est ESM (Vite l'exige), le reste ne l'est pas.
//
// ⚠️ POURQUOI VITEST ET PLUS node:test (15/07/2026) :
//    node:test n'a pas de plugin perTest (tap-runner = coverage par FICHIER +
//    1 process/fichier/mutant) → on subissait `commandRunner` →
//    `coverageAnalysis: off` forcé → UN PROCESS NODE RELANCÉ PAR MUTANT
//    (609 × ~440 ms = 4,5 min de démarrage pur ; mesuré : 12 min en local,
//    4 min en CI). Doc officielle Stryker : « the command test runner comes
//    with a performance penalty… If possible, use one of the test runner
//    plugins ». C'était le mode DÉGRADÉ, subi, jamais choisi.
//    Le runner vitest ignore `coverageAnalysis` et force `perTest` + garde ses
//    workers vivants = plus de spawn par mutant.
//    ⚠️ La mutation tourne sur 100% des projets ici ⇒ « node:test suffit sans
//    mutation » ne s'applique JAMAIS : le runner DOIT avoir un plugin Stryker.
// ═══════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ⚠️ Cible EXPLICITE : seules les suites déterministes + property. Les
    //    scripts autonomes (doctor/lock/config-gate/integration) gardent leur
    //    propre entrée npm — ils spawnent des process et ne sont PAS mutés.
    include: ['*.test.js'],
    // ⚠️ EXCLUS de la découverte : le différentiel (75 min, gate de bascule
    //    uniquement) et les tests de parc (spawnent le vrai parc de hooks).
    //    Les inclure ici les ferait tourner à chaque `vitest run` — et pire,
    //    Stryker les lancerait PAR MUTANT.
    exclude: [
      '**/node_modules/**',
      'file-differential.test.js',
      'hooks-parc-gate.test.js',
      'deadline-vendor.test.js',
      'vendor-deadline.test.js',
      'deadline-charge.test.js',
    ],
    // ⚠️ DÉLAI 30 s — NE JAMAIS LE BAISSER (posé 27/07/2026, MESURÉ).
    //    Le défaut vitest (5 s) produisait des FAUX ROUGES à répétition sur les
    //    suites qui SPAWNENT de vrais process (doc-inject, turn-count,
    //    shadow-inject, porte-differential) : mesuré 6082 ms pour un test qui
    //    lance 4 process, et 4992 ms pour un VERT — on tranchait à 8 ms près.
    //    Le test n'était pas cassé, le chronomètre l'était.
    //    ⚠️ POURQUOI ÇA COMPTE : une suite qui rougit au hasard cesse d'être lue,
    //    et le jour où elle rougit pour une VRAIE raison, personne ne la croit.
    //    C'est la leçon EXACTE déjà payée sur `deadline.js` (seuil 2 s → 30 s) :
    //    « un seuil serré tue du travail légitime en silence = pire que le zombie ».
    //    Prendre la plus GRANDE valeur qui borne encore utilement un vrai blocage,
    //    jamais la plus petite qui « semble suffire ».
    testTimeout: 30000,
    hookTimeout: 30000,
    // ⚠️ Stryker gère SES propres workers parallèles : le runner vitest
    //    force le mono-thread de son côté. Ne pas tenter de régler la
    //    concurrence ici pour « accélérer » — Stryker l'écrase.
    reporters: ['default'],
  },
});
