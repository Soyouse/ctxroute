// ═══════════════════════════════════════════════════════════════════════
// vitest — config des suites LOURDES, exclues du run par défaut.
// ⚠️ vitest ignore un fichier listé dans `exclude` MÊME s'il est nommé en
//    argument CLI — d'où cette 2e config : c'est le SEUL moyen de lancer ces
//    suites sans les faire entrer dans `vitest run` (et donc dans Stryker).
// ⚠️ NE JAMAIS fusionner avec vitest.config.mjs : Stryker lance la config par
//    défaut ; y inclure ces suites = les spawner PAR MUTANT (le bug qu'on tue).
// ═══════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'deadline-charge.test.js',   // 24 spawns simultanés, ~60 s
      'hooks-parc-gate.test.js',   // lit le VRAI parc ~/.claude/hooks (lecture seule)
      'deadline-vendor.test.js',   // drift-test copie vendorisée
      'vendor-deadline.test.js',   // preuve sur copie tmpdir (~min)
      'file-differential.test.js', // ~75 min — gate de bascule uniquement
    ],
    exclude: ['**/node_modules/**'],
    testTimeout: 6000000,
    // Ces suites spawnent des process et lisent un état partagé (parc réel) :
    // la parallélisation inter-fichiers fausserait charge et mesures.
    fileParallelism: false,
    reporters: ['default'],
  },
});
