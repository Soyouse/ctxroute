// ═══════════════════════════════════════════════════════════════════════
// GATE — la config COMMITTÉE doit être une config qui MARCHE (fail-closed)
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ NE JAMAIS SUPPRIMER NI ASSOUPLIR. Bug RÉEL (découvert le 15/07/2026,
// présent depuis le 1er commit) : `mcp-doc-config.json` a été committé avec
// des valeurs de FIXTURE laissées par les tests d'intégration
// (`filterMode: "whitelist"`, `filterList: ["testserver999"]`). Résultat :
// le framework tournait, sortait exit(0) à chaque appel MCP, n'injectait
// RIEN pour stripe/odoo — donc l'incident Stripe qui a motivé tout ce repo
// n'était PAS couvert, pendant des jours, EN SILENCE. Zéro test ne le voyait :
// tous les tests écrivaient leur propre config avant de s'exécuter.
//
// LEÇON : un hook qui n'injecte jamais est indiscernable d'un hook absent.
// C'est le "job qui meurt en silence" — un bug d'ARCHITECTURE, pas un détail.
// Ce gate est le dead-man switch : il assert que la config LIVRÉE couvre
// réellement quelque chose, indépendamment de ce que les tests fabriquent.
//
// Run : `npx vitest run config-gate.test.js` (inclus dans `npm test`).
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import lib from './lib-pure.js';

// Chaque ok(name, cond) = EXACTEMENT UN test vitest (même nom, même cond).
function ok(name, cond) {
  test(name, () => { assert.ok(cond, name); });
}

// ⚠️ CHEMINS EN DUR, VOLONTAIREMENT — NE JAMAIS passer par paths.js ici.
// paths.js honore MCP_DOC_CONFIG_PATH/MCP_DOC_DOCS_DIR (surcharges de test) :
// ce gate vérifie le fichier RÉELLEMENT LIVRÉ dans le repo, donc il doit être
// AVEUGLE à toute surcharge d'environnement. Sinon un env var traînant dans le
// shell/la CI ferait valider une autre config que celle qui part en prod —
// le gate se saborderait lui-même, exactement le bug qu'il existe pour attraper.
// ⚠️ PUBLICATION (19/07/2026) : mcp-doc-config.json = config UTILISATEUR,
// gitignorée (noms de skills/projets = données perso). Le repo livre
// mcp-doc-config.json.example. Ce gate valide la VRAIE config si présente
// (machine mainteneur/installée), sinon le .example (clone vierge/CI) —
// les DEUX doivent toujours passer les mêmes invariants.
const REAL_CONFIG = path.join(import.meta.dirname, 'mcp-doc-config.json');
const CONFIG_PATH = fs.existsSync(REAL_CONFIG)
  ? REAL_CONFIG
  : path.join(import.meta.dirname, 'mcp-doc-config.json.example');
const DOCS_DIR = path.join(import.meta.dirname, 'docs', 'mcp');

// ── La config (réelle ou .example livré) doit être lisible et valide ──
let config = null;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch { /* config reste null → tests suivants échouent proprement */ }

ok('la config (mcp-doc-config.json ou .example livré) existe et est un JSON valide', config !== null && typeof config === 'object');

if (config) {
  // ── Le framework doit être ALLUMÉ dans la config livrée ──
  ok('config livrée : enabled !== false (framework actif)', lib.isFrameworkEnabled(config));

  // ── "dumb" GLOBAL = fixture de test, jamais un défaut livré ──
  // (une doc en "dumb" reste légitime — via SON frontmatter, ex. stripe.md.)
  ok('config livrée : mode global !== "dumb" (bruit maximal = valeur de debug)', config.mode !== 'dumb');

  // ── ⚠️ LE CŒUR DU GATE : tout serveur ayant une doc DOIT être couvert. ──
  // C'est exactement ce qui a échoué : whitelist ["testserver999"] excluait
  // stripe/odoo alors que leurs docs existaient. Un doc écrit mais jamais
  // injecté = pire que pas de doc (fausse sensation de sécurité).
  let documented = [];
  try {
    documented = fs.readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith('.md') && !f.endsWith('.md.example'))
      .map((f) => f.slice(0, -3));
  } catch { /* pas de docs/mcp/ → liste vide, rien à garantir */ }

  // ⚠️ PAS de check "au moins un serveur documenté" ICI — erreur commise le
  // 15/07/2026, rouge sur les 3 OS en CI : `docs/mcp/*.md` est GITIGNORÉ (docs
  // perso), donc un checkout frais (CI, ou quiconque clone) n'en a AUCUN.
  // "Avoir des docs" est un invariant d'INSTALLATION (→ doctor.js --settings),
  // pas un invariant du REPO. Ne pas confondre les deux : un gate de repo doit
  // valoir sur un clone vierge, sinon il est faux pour tout le monde sauf son
  // auteur. Ici, zéro doc ⇒ la boucle ci-dessous est vide et le gate passe :
  // c'est CORRECT (rien à couvrir).
  for (const server of documented) {
    ok(`serveur documenté "${server}" est COUVERT par la config livrée (filtre)`, lib.isServerActive(config, server));
  }

  // ── Aucun résidu de fixture de test ne doit atteindre le repo ──
  const list = Array.isArray(config.filterList) ? config.filterList : [];
  ok('config livrée : aucun résidu de fixture de test dans filterList',
    !list.some((s) => /^testserver|^concserver|^server[ab]$/i.test(s)));
}

// ── DRIFT-TEST $schema : la config livrée reste dans le vocabulaire du schéma ──
// ⚠️ Une clé hors schéma = la classe exacte du bug testserver999 (résidu/typo
//    silencieux, le hook l'ignore sans un mot). Pas d'ajv (zéro dépendance) :
//    on vérifie l'ENVELOPPE (clés connues, types des enums) — l'IDE fait le reste.
{
  const schema = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'mcp-doc-config.schema.json'), 'utf8'));
  const knownKeys = Object.keys(schema.properties);
  for (const k of Object.keys(config)) {
    ok(`config livrée : clé "${k}" connue du schéma`, knownKeys.includes(k));
  }
  ok('config livrée : $schema pointe le fichier du repo', config.$schema === './mcp-doc-config.schema.json');
  ok('schéma : mode et filterMode restent des enums fermés',
    Array.isArray(schema.properties.mode.enum) && Array.isArray(schema.properties.filterMode.enum));
  const srvSchema = schema.properties.servers.additionalProperties;
  const srvKeys = Object.keys(srvSchema.properties);
  for (const [name, srv] of Object.entries(config.servers || {})) {
    for (const k of Object.keys(srv)) {
      ok(`config livrée : servers.${name}.${k} connue du schéma`, srvKeys.includes(k));
    }
  }
  // ── ⚠️ ZÉRO DOUBLON (décision mainteneur 17/07/2026) : le JSON ne porte JAMAIS de
  //    cadence — mode/threshold par doc = frontmatter de la doc, UNIQUEMENT.
  //    Deux emplacements pour la même vérité = la dérive que ce repo combat.
  ok('schéma : servers ne porte AUCUNE cadence (mode/threshold = frontmatter des docs)',
    !srvKeys.includes('mode') && !srvKeys.includes('threshold'));
}

// ── DRIFT-TEST frontmatter des docs MCP LIVRÉES (installation locale) ──
// ⚠️ Même classe de bug que `mach:` — un `mod: dumb` dans docs/mcp/stripe.md
//    serait ignoré EN SILENCE (fallback global) : la cadence voulue par
//    l'auteur n'existerait pas, sans un mot. Clés admises ici : mode/threshold
//    SEULEMENT (une doc MCP est déclenchée par son CHEMIN, jamais par match/mcp).
// ⚠️ docs/mcp/*.md est GITIGNORÉ → clone vierge = boucle vide = gate passe
//    (invariant d'installation, même règle que la couverture filtre ci-dessus).
{
  // ⚠️ Jugement DÉLÉGUÉ à frontmatter.validateMcp (seule autorité, partagée
  //    avec doc-write-guard.js — 2 codes pour 1 jugement = divergence garantie).
  const { parse, validateMcp } = await import('./frontmatter.js');
  const mdFiles = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { /* pas de docs/mcp */ }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith('.md') && !e.name.endsWith('.md.example')) mdFiles.push(path.join(dir, e.name));
    }
  };
  walk(DOCS_DIR);
  for (const f of mdFiles) {
    const { data } = parse(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(DOCS_DIR, f);
    const errs = validateMcp(data);
    ok(`doc MCP ${rel} : frontmatter sain (${errs.join(' · ') || 'ok'})`, errs.length === 0);
  }
}
