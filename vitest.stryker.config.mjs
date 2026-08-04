// ═══════════════════════════════════════════════════════════════════════
// vitest — config DÉDIÉE À STRYKER (stryker.conf.json → vitest.configFile).
// ⚠️ N'inclut QUE les suites DÉTERMINISTES couvrant les modules mutés.
//    - JAMAIS les property-tests (lents, non déterministes : un run flaky
//      par mutant = score qui ment) — leur invariant DOIT avoir son cas
//      déterministe dans une suite ci-dessous (cf lib-pure.md).
//    - JAMAIS les suites à spawn (doctor/integration/lint-corpus/lock) :
//      elles ne couvrent pas les modules purs en-process, elles ne feraient
//      que gonfler le dry-run initial.
// ⚠️ Nouveau module pur muté ⇒ sa suite déterministe s'ajoute ICI (et le
//    gate mutation-workflow-gate.test.js vérifie le miroir avec mutation.yml).
// ═══════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'deps-criticite-pure.test.js',
      'lib-pure.test.js',
      'canari.test.js',
      'fuite-pure.test.js',
      'sources-file.test.js',
      'sources-tool.test.js',
      'sources-mcp.test.js',
      'sources-session.test.js',
      'sources-skill.test.js',
      'frontmatter.test.js',
      'migrate.test.js',
      'loader.test.js',
      'lint.test.js',
      'collisions.test.js',
      'gate.test.js',
      'budget.test.js',
    ],
    exclude: ['**/node_modules/**'],
    reporters: ['default'],
  },
});
