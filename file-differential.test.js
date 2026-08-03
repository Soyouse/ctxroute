// ═══════════════════════════════════════════════════════════════════════
// TEST DIFFÉRENTIEL — sources/file.js DOIT être indiscernable de protect-files.js
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ C'EST LE FILET DU REFACTOR. Personne ne relit 529 règles à la main.
//    Sans ce test, une divergence de sémantique = une doc qui cesse d'être
//    injectée, en SILENCE, sur un fichier critique, découvert des mois plus tard.
//
// ORACLE = le VRAI script de prod, spawné, pas une réimplémentation de référence.
//    Comparer deux relectures du même code prouve seulement que j'ai lu deux fois.
//    protect-files.js marque chaque doc « [source: .claude/hooks/<doc>] » → l'ordre
//    et l'identité des docs sont directement observables sur sa sortie réelle.
//
// ⚠️ CE TEST EST SKIPPÉ si protect-files.js est absent (checkout frais, CI, autre
//    machine) — le repo public ne dépend JAMAIS du home directory du mainteneur.
//    Sauter n'est PAS échouer : il hurle en local, là où le refactor se fait.
//    (Leçon du 15/07/2026 : un gate de repo doit valoir sur un clone VIERGE.)
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { matchingDocs } from './sources/file';

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const LEGACY = path.join(HOOKS_DIR, 'protect-files.js');
const RULES_PATH = path.join(HOOKS_DIR, 'protected-paths.json');

const available = fs.existsSync(LEGACY) && fs.existsSync(RULES_PATH);

// ── ORACLE : spawne le vrai hook, extrait les docs dans l'ordre ──
// ⚠️ Les marqueurs [source: ...] apparaissent dans l'ordre d'injection réel.
//    On lit CET ordre, jamais un Set — l'ordre parent→enfant EST le contrat.
//
// ⚠️ SPAWN PARALLÈLE OBLIGATOIRE, ce n'est pas une optimisation gratuite.
//    Mesuré le 15/07/2026 : 2021 cas × 440 ms de démarrage Node = 15 MINUTES en
//    séquentiel. Un gate de 15 min n'est jamais lancé → gate mort → aucune
//    protection. La réponse N'EST JAMAIS d'échantillonner le corpus (plafond
//    silencieux : « vert » en n'ayant testé qu'un tiers des règles) — les spawns
//    sont indépendants, donc on les parallélise. 15 min → ~1 min, 0 règle sautée.
// ⚠️ ORACLE — 2 PIÈGES VÉCUS LE 15/07/2026, LES DEUX ONT ACCUSÉ LE MOTEUR À TORT.
//    Un oracle faux est PIRE qu'aucun oracle : il condamne du code correct.
//
// PIÈGE 1 — 61 docs de `~/.claude/hooks/docs/` contiennent un `[source: ...]` EN DUR
//    dans leur CONTENU (un agent a recopié la sortie injectée dans le fichier).
//    Compter tous les marqueurs comptait ces lignes comme des injections.
// PIÈGE 2 — la sortie du hook est du **JSON** : les retours à la ligne y sont
//    ÉCHAPPÉS (`\n`), donc découper le stdout brut sur un vrai `\n\n---\n\n` ne
//    trouve QU'UN bloc → seul le dernier doc était vu → 43 fausses divergences,
//    exactement les cas MULTI-DOCS.
//
// ⚠️ LA LEÇON : PARSER LE FORMAT, JAMAIS BRICOLER DU TEXTE. Le hook émet un contrat
//    JSON (`hookSpecificOutput.additionalContext`) — le lire comme du JSON. Toute
//    « astuce » regex sur le stdout brut re-tombera dans l'un des deux pièges.
// ⚠️ EXTRAIT dans oracle.js le 16/07/2026 (partagé avec shadow-reconcile.js) :
//    il n'existe qu'UNE lecture de la sortie de l'oracle — deux parseurs = deux
//    façons de mentir. Les 2 pièges (marqueur en dur, JSON échappé) y sont scellés.
import { legacyDocs as oracleDocs } from './oracle.js';
function legacyDocs(payload) {
  return oracleDocs(LEGACY, payload);
}

// Pool à concurrence bornée. ⚠️ Ne PAS lancer 2021 spawns d'un coup :
// 2021 process Node simultanés = la machine tombe (ou l'OS refuse les handles).
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function newDocs(rules, payload) {
  return matchingDocs(rules, payload).map((d) => d.doc);
}

// ⚠️ Corpus dérivé des VRAIES règles — jamais une liste écrite à la main.
//    Une liste manuelle ne couvre que ce à quoi j'ai pensé ; les 529 patterns
//    sont, eux, exactement ce qui tourne en prod.
function buildCorpus(rules) {
  const cases = [];
  for (const r of rules) {
    if (typeof r.pattern !== 'string' || !r.pattern) continue;
    const p = r.pattern.replace(/\/$/, '');
    const base = `C:/Users/dev/Desktop/${p}`;
    const scopeHint = Array.isArray(r.scope) && r.scope.length ? r.scope[0] : '';

    // Chemin nu — révèle les règles scopées qui NE doivent PAS matcher hors scope.
    cases.push({ toolName: 'Read', toolInput: { file_path: base } });
    // Chemin portant le scope — révèle le match nominal.
    if (scopeHint) {
      cases.push({ toolName: 'Read', toolInput: { file_path: `C:/Users/dev/Desktop/${scopeHint}/${p}` } });
    }
    // Écriture — même match, mais chemin d'exécution ask/allow différent côté legacy.
    cases.push({ toolName: 'Edit', toolInput: { file_path: base } });
    // Casse + backslashes — scelle norm() (le piège cross-platform).
    cases.push({ toolName: 'Read', toolInput: { file_path: base.replace(/\//g, '\\').toUpperCase() } });
  }
  return cases;
}

test('différentiel sources/file.js ≡ protect-files.js sur les vraies règles', { skip: !available && 'protect-files.js absent (clone vierge)', timeout: 6000000 }, async () => {
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')).rules;
  const corpus = buildCorpus(rules);

  // ⚠️ ZÉRO PLAFOND SILENCIEUX : on annonce la taille réelle du corpus.
  //    Un gate qui tronque sans le dire ment (« couvert » alors qu'il ne l'est pas).
  console.log(`  → ${corpus.length} cas dérivés de ${rules.length} règles réelles, aucun échantillonnage`);

  const results = await mapPool(corpus, 12, async (payload) => {
    const a = await legacyDocs(payload);
    const b = newDocs(rules, payload);
    // ⚠️ join('|') = comparaison ORDONNÉE. Un Set passerait alors que l'ordre
    //    parent→enfant est cassé — exactement la régression qu'on cherche.
    return a.join('|') === b.join('|')
      ? null
      : { entree: payload.toolInput.file_path, outil: payload.toolName, ancien: a, nouveau: b };
  });

  const divergences = results.filter(Boolean);
  assert.deepStrictEqual(
    divergences.slice(0, 5),
    [],
    `${divergences.length}/${corpus.length} divergences (5 premières ci-dessus)`
  );
});

test('différentiel : commandes Bash (reconstruction cd + skip git)', { skip: !available && 'protect-files.js absent (clone vierge)', timeout: 6000000 }, async () => {
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')).rules;
  const cases = [
    { toolName: 'Bash', toolInput: { command: 'cd C:/Users/dev/Desktop/ctxroute && node lib-pure.js' } },
    { toolName: 'Bash', toolInput: { command: 'git commit -m "fix lib-pure.js"' } }, // faux positif connu → doit rester vide
    { toolName: 'Bash', toolInput: { command: 'cat lib-pure.js' } },
    { toolName: 'Bash', toolInput: { command: 'cd /srv && ls' } },
  ];
  for (const payload of cases) {
    assert.deepStrictEqual(
      newDocs(rules, payload),
      await legacyDocs(payload),
      `divergence sur: ${payload.toolInput.command}`
    );
  }
});
