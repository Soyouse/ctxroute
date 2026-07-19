// ═══════════════════════════════════════════════════════════════════════
// PROPERTY-BASED (fast-check) — invariants de lib-pure.js sur inputs générés
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ POURQUOI EN PLUS des tests par cas (lib-pure.test.js) : un test par cas
// ne couvre que les entrées auxquelles l'auteur a PENSÉ. Pour un
// parseur/sanitizer, c'est exactement l'angle mort — l'attaquant (ou la
// réalité) fournit l'entrée à laquelle personne n'a pensé. Doctrine :
// "parseur/serializer/scanner → property-based AUTOMATIQUE".
//
// lib-pure.js EST un parseur : serverName()/toolSuffix() découpent un format
// ("mcp__{server}__{tool}"), getByPath() interprète un chemin pointé,
// isSafePathSegment() est un sanitizer. Les 4 sont ici.
//
// ⚠️ INVARIANTS DE SÉCURITÉ (property 1) : NE JAMAIS les affaiblir. Ils
// disent "AUCUN input, quel qu'il soit, ne fait sortir un chemin de
// docs/mcp/" — une garantie universelle, pas une liste d'attaques connues.
//
// ⚠️ Ces propriétés sont TOTALES : elles exigent aussi "ne jamais lever".
// Un throw dans lib-pure remonterait au hook → fail-open → silence.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import fc from 'fast-check';
import lib from './lib-pure.js';

// Chaque propriété fast-check = EXACTEMENT UN test vitest (même nom, même
// property, mêmes numRuns) — fc.assert lève sur contre-exemple, vitest rapporte.
function prop(name, property) {
  test(name, () => {
    fc.assert(property, { numRuns: 1000 });
  });
}

// ── 1. SÉCURITÉ : aucun candidat ne peut échapper à docs/mcp/ ──
// LE property test qui compte : quel que soit le tool_name, le nom de serveur,
// le subToolParam et le tool_input (arbitraires, y compris hostiles), AUCUN
// relPath produit ne contient de séparateur de dossier remontant ni de NUL.
prop('SÉCURITÉ: aucun relPath ne contient ".." ni octet NUL, quel que soit l\'input',
  fc.property(
    fc.string(), fc.string(), fc.string(), fc.anything(),
    (server, toolName, subToolParam, toolInput) => {
      const config = { servers: { [server]: { subToolParam } } };
      const candidates = lib.docCandidatePaths(config, server, toolName, toolInput);
      // ⚠️ TOUS les segments sont vérifiés, y compris le nom de SERVEUR : c'est
      // lui qui portait le trou trouvé le 15/07/2026 (serverName acceptait `/`).
      return candidates.every((c) =>
        c.relPath.replace(/\.md$/, '').split('/').every(
          (s) => s !== '..' && s !== '.' && s !== '' && !s.includes('\0') && !s.includes('\\')
        ));
    }
  ));

prop('SÉCURITÉ: isSafePathSegment rejette TOUTE chaîne contenant un séparateur ou un NUL',
  fc.property(fc.string(), (s) => {
    const dangerous = s.includes('/') || s.includes('\\') || s.includes('\0') || s === '' || s === '.' || s === '..';
    return dangerous ? lib.isSafePathSegment(s) === false : lib.isSafePathSegment(s) === true;
  }));

// ── 2. TOTALITÉ : lib-pure ne lève JAMAIS (un throw = fail-open = silence) ──
prop('TOTALITÉ: serverName ne lève jamais, quel que soit l\'input',
  fc.property(fc.anything(), (x) => { lib.serverName(x); return true; }));

prop('TOTALITÉ: getByPath ne lève jamais et ne rend que string|number|null',
  fc.property(fc.anything(), fc.anything(), (obj, p) => {
    const v = lib.getByPath(obj, p);
    return v === null || typeof v === 'string';
  }));

// ⚠️ Contrat : serveur SÛR → ≥1 candidat (niveau serveur) ; serveur NON SÛR →
// ZÉRO candidat (jamais un chemin hors docs/mcp/). Les deux branches ici.
prop('TOTALITÉ: docCandidatePaths ne lève jamais et respecte le contrat sûr→≥1 / non sûr→0',
  fc.property(fc.anything(), fc.string(), fc.string(), fc.anything(), (config, server, toolName, toolInput) => {
    const c = lib.docCandidatePaths(config && typeof config === 'object' ? config : {}, server, toolName, toolInput);
    if (!Array.isArray(c)) return false;
    return lib.isSafePathSegment(server)
      ? c.length >= 1 && c[0].level === 'server'
      : c.length === 0;
  }));

// ── 3. ROUND-TRIP : serverName ∘ "mcp__{s}__{t}" = identité ──
// Paire encode↔decode → property round-trip (doctrine).
const serverArb = fc.stringMatching(/^[a-zA-Z0-9-]+(_[a-zA-Z0-9-]+)*$/).filter((s) => s.length > 0 && !s.includes('__'));
prop('ROUND-TRIP: serverName(`mcp__${s}__${t}`) === s pour tout nom de serveur valide',
  fc.property(serverArb, fc.stringMatching(/^[a-zA-Z0-9_]+$/), (s, t) => lib.serverName(`mcp__${s}__${t}`) === s));

prop('ROUND-TRIP: toolSuffix(`mcp__${s}__${t}`, s) === t',
  fc.property(serverArb, fc.stringMatching(/^[a-zA-Z0-9_]+$/), (s, t) =>
    t.length === 0 || lib.toolSuffix(`mcp__${s}__${t}`, s) === t));

// ── 4. SANITISATION : sanitizeSessionId produit toujours un nom de fichier sûr ──
prop('sanitizeSessionId: sortie TOUJOURS non vide et [a-zA-Z0-9_-] uniquement',
  fc.property(fc.anything(), (x) => {
    const out = lib.sanitizeSessionId(x);
    return typeof out === 'string' && out.length > 0 && /^[a-zA-Z0-9_-]+$/.test(out);
  }));

// ── 5. DÉCISION : shouldInjectFor est totale et déterministe ──
prop('shouldInjectFor: "dumb" injecte TOUJOURS, quel que soit l\'état',
  fc.property(fc.boolean(), fc.integer(), fc.integer(), (seen, since, th) =>
    lib.shouldInjectFor('dumb', seen, since, th) === true));

prop('shouldInjectFor: jamais vu → injecte TOUJOURS, quel que soit le mode',
  fc.property(fc.string(), fc.integer(), fc.integer(), (mode, since, th) =>
    lib.shouldInjectFor(mode, false, since, th) === true));

prop('shouldInjectFor: "once" déjà vu → JAMAIS de réinjection',
  fc.property(fc.integer(), fc.integer(), (since, th) =>
    lib.shouldInjectFor('once', true, since, th) === false));

// ── 6. FAIL-OPEN : une config absurde ne désactive jamais le framework ──
// Seul `enabled: false` littéral coupe — tout le reste doit rester ON.
prop('FAIL-OPEN: seule la valeur false littérale désactive le framework',
  fc.property(fc.anything().filter((v) => v !== false), (v) =>
    lib.isFrameworkEnabled({ enabled: v }) === true));

prop('FAIL-OPEN: filterMode inconnu → serveur couvert (jamais une désactivation silencieuse)',
  fc.property(fc.string().filter((m) => m !== 'whitelist' && m !== 'blacklist'), fc.string(), (mode, server) =>
    lib.isServerActive({ filterMode: mode, filterList: [] }, server) === true));
