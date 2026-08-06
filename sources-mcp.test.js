// ═══════════════════════════════════════════════════════════════════════
// Tests DÉTERMINISTES de sources/mcp.js (cible Stryker).
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ Cible les responsabilités PROPRES du module : alignement ids corpus
//    ('mcp/…'), ordre global→spécifique, filtre serveur, decl résolue.
//    La sémantique fine (serverName, isSafePathSegment, seuils) est déjà
//    scellée dans lib-pure.test.js — ne pas la re-tester ici en double.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

import { describe, it, test, expect } from 'vitest';
import { matchingDocs, declFor } from './sources/mcp.js';

describe('sources/mcp — matchingDocs', () => {
  it('outil non-MCP → []', () => {
    expect(matchingDocs({}, { toolName: 'Read', toolInput: {} })).toEqual([]);
    expect(matchingDocs({}, { toolName: '', toolInput: {} })).toEqual([]);
  });

  it('serveur simple → doc niveau server + tool, ids corpus mcp/…, ordre global→spécifique', () => {
    const out = matchingDocs({}, { toolName: 'mcp__stripe__authenticate', toolInput: {} });
    expect(out).toEqual([
      { doc: 'mcp/stripe.md', sourceLabel: 'docs/mcp/stripe.md', level: 'server', server: 'stripe' },
      { doc: 'mcp/stripe/authenticate.md', sourceLabel: 'docs/mcp/stripe/authenticate.md', level: 'tool', server: 'stripe' },
    ]);
  });

  it('subToolParam configuré → niveau 3 depuis tool_input', () => {
    const config = { servers: { odoo: { subToolParam: 'args.tool' } } };
    const out = matchingDocs(config, {
      toolName: 'mcp__odoo__odoo_call',
      toolInput: { args: { tool: 'delete_record' } },
    });
    expect(out.map((c) => c.doc)).toEqual([
      'mcp/odoo.md',
      'mcp/odoo/odoo_call.md',
      'mcp/odoo/delete_record.md',
    ]);
    expect(out[2]).toEqual({
      doc: 'mcp/odoo/delete_record.md',
      sourceLabel: 'docs/mcp/odoo/delete_record.md',
      level: 'subTool',
      server: 'odoo',
    });
  });

  it('toolInput absent → traité comme {} (jamais un throw)', () => {
    const out = matchingDocs({}, { toolName: 'mcp__stripe__authenticate' });
    expect(out.map((c) => c.doc)).toEqual(['mcp/stripe.md', 'mcp/stripe/authenticate.md']);
  });

  it('filtre whitelist : serveur hors liste → [] ; dans la liste → docs', () => {
    const config = { filterMode: 'whitelist', filterList: ['odoo'] };
    expect(matchingDocs(config, { toolName: 'mcp__stripe__authenticate', toolInput: {} })).toEqual([]);
    expect(matchingDocs(config, { toolName: 'mcp__odoo__odoo_call', toolInput: {} }).length).toBeGreaterThan(0);
  });

  it('filtre blacklist : serveur listé → []', () => {
    const config = { filterMode: 'blacklist', filterList: ['umami'] };
    expect(matchingDocs(config, { toolName: 'mcp__umami__umami_call', toolInput: {} })).toEqual([]);
  });

  it('serveur multi-underscore (plugin_discord_discord) → id corpus correct', () => {
    const out = matchingDocs({}, { toolName: 'mcp__plugin_discord_discord__reply', toolInput: {} });
    expect(out[0].doc).toBe('mcp/plugin_discord_discord.md');
    expect(out[0].server).toBe('plugin_discord_discord');
  });
});

describe('sources/mcp — declFor', () => {
  it('défauts : smart / 4', () => {
    expect(declFor({}, 'stripe')).toEqual({ mode: 'smart', threshold: 4 });
  });

  it('globals : mode + defaultThreshold', () => {
    expect(declFor({ mode: 'once', defaultThreshold: 7 }, 'stripe')).toEqual({ mode: 'once', threshold: 7 });
  });

  it('override serveur > global', () => {
    const config = {
      mode: 'smart',
      defaultThreshold: 4,
      servers: { stripe: { mode: 'dumb', threshold: 1 } },
    };
    expect(declFor(config, 'stripe')).toEqual({ mode: 'dumb', threshold: 1 });
    expect(declFor(config, 'odoo')).toEqual({ mode: 'smart', threshold: 4 });
  });

  it('une decl ne porte QUE de la cadence — aucune clé de DÉCISION', () => {
    // ⚠️ Portait sur `confirm` (retiré le 05/08/2026). L'invariant est plus
    //    large et survit à son retrait : une source INFORME, elle ne décide rien.
    const CADENCE = ['mode', 'threshold', 'driftUnit', 'note', 'enforce'];
    for (const k of Object.keys(declFor({}, 'stripe'))) {
      expect(CADENCE).toContain(k);
    }
    expect('confirm' in declFor({}, 'stripe')).toBe(false);
  });
});

// ── declFor : le FRONTMATTER de la doc propose, la config globale dispose ──
// (décision mainteneur 17/07/2026 : JSON = global uniquement, cadence par doc = frontmatter.)
describe('sources/mcp — declFor, override par frontmatter', () => {
  it('fm.mode valide écrase le mode global', () => {
    expect(declFor({ mode: 'smart', defaultThreshold: 4 }, 'stripe', { mode: 'dumb' }))
      .toEqual({ mode: 'dumb', threshold: 4 });
  });

  it('fm.threshold entier >= 1 écrase le defaultThreshold global (borne 1 INCLUSE)', () => {
    expect(declFor({ mode: 'smart', defaultThreshold: 4 }, 'gworkspace', { threshold: 2 }))
      .toEqual({ mode: 'smart', threshold: 2 });
    expect(declFor({}, 'gworkspace', { threshold: 1 })).toEqual({ mode: 'smart', threshold: 1 });
  });

  it('fm.mode ET fm.threshold ensemble', () => {
    expect(declFor({}, 'odoo', { mode: 'once', threshold: 9 }))
      .toEqual({ mode: 'once', threshold: 9 });
  });

  it('fm invalide = fallback TOTAL (jamais de throw) : mode inconnu, threshold 0/float/string', () => {
    expect(declFor({ mode: 'smart', defaultThreshold: 4 }, 's', { mode: 'weekly' }))
      .toEqual({ mode: 'smart', threshold: 4 });
    expect(declFor({}, 's', { threshold: 0 })).toEqual({ mode: 'smart', threshold: 4 });
    expect(declFor({}, 's', { threshold: 2.5 })).toEqual({ mode: 'smart', threshold: 4 });
    expect(declFor({}, 's', { threshold: '3' })).toEqual({ mode: 'smart', threshold: 4 });
  });

  it('fm absent/undefined = comportement config pur (2 args, appels existants intacts)', () => {
    expect(declFor({ mode: 'once' }, 'stripe')).toEqual({ mode: 'once', threshold: 4 });
    expect(declFor({}, 'stripe', undefined)).toEqual({ mode: 'smart', threshold: 4 });
  });
});

// ── driftUnit (18/07/2026) : l'auteur propose, sinon ABSENT (cascade dans gate) ──
test('declFor : driftUnit du frontmatter propagé si valide, ABSENT sinon (fallback = gate)', () => {
  const config = {};
  expect(declFor(config, 's', { driftUnit: 'turn' }).driftUnit).toBe('turn');
  expect(declFor(config, 's', { driftUnit: 'tool' }).driftUnit).toBe('tool');
  expect('driftUnit' in declFor(config, 's', { driftUnit: 'bogus' })).toBe(false);
  expect('driftUnit' in declFor(config, 's', {})).toBe(false);
  expect('driftUnit' in declFor(config, 's', undefined)).toBe(false);
});

// ═══════════════════════════════════════════════════════════════════════════
// `enforce` — PROPAGÉ, pas filtré (défaut RÉEL corrigé le 06/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `enforce` (le mot qui REFUSE un geste) n'était PAS recopié par declFor :
//    accepté par validateMcp, documenté partout, INERTE sur le canal MCP —
//    donc là où vit l'incident FONDATEUR (le clic de paiement Stripe).
//    `create_refund` rendait `allow`. Un cran d'arrêt qui ne s'arrête pas est
//    PIRE que rien : on lui fait confiance.
// ⚠️ CES CAS VIVENT ICI et pas seulement dans `declfor-gate.test.js` : Stryker
//    ne mute QUE les suites déterministes déclarées. Le gate protège l'AVENIR
//    (toute clé future), ces cas protègent la LIGNE — les deux, jamais l'un
//    à la place de l'autre.

describe('sources/mcp — declFor propage `enforce`', () => {
  it('`enforce: true` est TRANSPORTÉ jusqu à la decl', () => {
    expect(declFor({}, 'stripe', { enforce: true }).enforce).toBe(true);
  });

  it('`enforce: false` EXPLICITE survit — sinon la désinscription est impossible', () => {
    // Sans lui, une catégorie passée en `defaults.mcp.enforce` serait
    // INDÉSINSCRIPTIBLE : l'impasse de toute cascade.
    expect(declFor({}, 'stripe', { enforce: false }).enforce).toBe(false);
  });

  it('valeur NON booléenne → ABSENTE (jamais prise pour un oui)', () => {
    // Un typo ne doit pas devenir une décision de blocage.
    expect(declFor({}, 'stripe', { enforce: 'oui' }).enforce).toBeUndefined();
    expect(declFor({}, 'stripe', { enforce: 1 }).enforce).toBeUndefined();
  });

  it('absent du frontmatter → absent de la decl (la cascade tranchera)', () => {
    expect('enforce' in declFor({}, 'stripe', {})).toBe(false);
  });
});
