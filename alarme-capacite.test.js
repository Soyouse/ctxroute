// ═══════════════════════════════════════════════════════════════════════
// L'ALARME DE CAPACITÉ DOIT CRIER — et se taire quand tout va bien.
// ═══════════════════════════════════════════════════════════════════════
//
// 🔴 CE QU'ELLE PROTÈGE, ET POURQUOI ÇA VAUT UN TEST DÉDIÉ (07/08/2026).
//    Quand la charge d'un geste dépasse la capacité des N trames, rien n'est
//    PERDU (la file draine au geste suivant) — mais l'agent AGIT avant d'avoir
//    tout reçu. C'est la dégradation la plus dangereuse du framework parce
//    qu'elle est parfaitement SILENCIEUSE : aucune erreur, aucun rouge, aucun
//    test qui tombe. Exactement le trou « rien ne mesure le DÉBIT » du backlog.
//    Précédent MESURÉ le 05/08/2026 : un skill livré en 11 gestes au lieu d'1,
//    avec 995 tests verts, mutation 100 %, doctor 27/27 et canari vivant.
//
// ⚠️ SPAWN RÉEL OBLIGATOIRE, jamais un appel en mémoire : l'alarme voyage dans
//    `systemMessage`, c'est-à-dire dans le DIALECTE DE SORTIE de la coquille.
//    Un test in-process validerait la composition du texte sans prouver qu'il
//    atteint la sortie du hook — le « vert qui ment » que ce repo traque.
//
// ⚠️ LE CAS NÉGATIF EST LA MOITIÉ QUI COMPTE : une alarme qui crie TOUJOURS
//    est une alarme qu'on cesse de lire (leçon du rush mode). On exige donc
//    aussi le SILENCE quand la capacité suffit.
//
// ⚠️ ISOLATION TOTALE (`CTXROUTE_CONFIG_PATH` + `CTXROUTE_STATE_DIR` en
//    tmpdir) : ne JAMAIS laisser un test écrire dans la config ou les stores
//    livrés — bug RÉEL du 15/07/2026, une fixture polluée avait rendu le
//    framework muet pendant des jours.
// ═══════════════════════════════════════════════════════════════════════

import { test } from 'vitest';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PORTE = path.join(ICI, 'doc-inject.js');
// Fichier RÉEL du repo, choisi parce qu'il porte une doc injectable volumineuse.
const CIBLE = path.join(ICI, 'porte-core.js');

/** Lance la porte avec un budget imposé et rend son `systemMessage`. */
function badge({ budgetInjection, paquet, paquets, racine }) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ICI, 'ctxroute-config.json'), 'utf8'));
  cfg.budgetInjection = budgetInjection;
  const cfgPath = path.join(racine, `cfg-${budgetInjection}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));

  const payload = JSON.stringify({
    session_id: 'alarme-' + budgetInjection,
    tool_name: 'Read',
    tool_input: { file_path: CIBLE },
    // ⚠️ invocationId STABLE entre les trames d'un même cas : sans lui, chaque
    //    processus redéciderait et le plan ne serait pas partagé.
    tool_use_id: 'inv-' + budgetInjection,
  });

  const r = spawnSync(process.execPath, [PORTE, '--paquet', String(paquet), '--paquets', String(paquets)], {
    input: payload,
    encoding: 'utf8',
    env: { ...process.env, CTXROUTE_CONFIG_PATH: cfgPath, CTXROUTE_STATE_DIR: path.join(racine, 'state') },
  });
  if (!r.stdout || r.stdout.trim() === '') return '';
  try { return JSON.parse(r.stdout).systemMessage || ''; } catch { return ''; }
}

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-alarme-'));
  fs.mkdirSync(path.join(d, 'state'), { recursive: true });
  return d;
}

test('CRIE — capacité dépassée : la DERNIÈRE trame porte l\'alarme, avec le réglage à changer', () => {
  const racine = tmp();
  try {
    // Budget minuscule + 2 trames ⇒ report GARANTI, quel que soit le corpus.
    const msg = badge({ budgetInjection: 900, paquet: 2, paquets: 2, racine });
    assert.ok(msg.includes('REPORTÉE'), 'aucune alarme alors que la capacité est dépassée : ' + JSON.stringify(msg));
    // ⚠️ Le message DOIT porter l'action : une alarme qui ne dit pas quoi faire
    //    renvoie l'humain lire le code. Nommer la clé EXACTE est le contrat.
    assert.ok(msg.includes('paquets'), 'l\'alarme ne nomme pas le réglage à changer : ' + msg);
    assert.ok(msg.includes('ctxroute-config.json'), 'l\'alarme ne dit pas OÙ régler : ' + msg);
    // Le badge normal survit : l'alarme s'AJOUTE, elle ne remplace pas.
    assert.ok(msg.includes('📄'), 'l\'alarme a écrasé le badge au lieu de s\'y ajouter : ' + msg);
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test('SE TAIT — une trame NON finale ne répète pas l\'alarme (12 trames = 12 cris = alarme illisible)', () => {
  const racine = tmp();
  try {
    const msg = badge({ budgetInjection: 900, paquet: 1, paquets: 2, racine });
    assert.ok(!msg.includes('REPORTÉE'),
      'une trame intermédiaire crie aussi : avec 12 déclarations l\'alarme apparaîtrait 12 fois — ' + msg);
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test('NEGATIVE — capacité SUFFISANTE (câblage RÉEL, 12 trames) : aucune trame ne crie', () => {
  // ⚠️ ON REJOUE LES 12 TRAMES, PAS UNE SEULE. L'alarme ne vit que sur la
  //    DERNIÈRE trame PORTEUSE, et les dernières trames déclarées sont souvent
  //    VIDES (charge mesurée 65 265 c ⇒ ~9 trames sur 12). Sonder un indice
  //    choisi à la main donnerait un vert qui ne prouve rien : c'est
  //    l'invariant « AUCUNE trame ne crie » qu'il faut vérifier.
  // ⚠️ BUDGET PAR DÉFAUT (8 000) : `budgetInjection` ne peut que RÉDUIRE le
  //    budget (Math.min avec la borne du harnais) — lui donner 60 000 ne
  //    l'augmente PAS. Première version de ce test faussement ROUGE pour cette
  //    raison ; l'erreur était dans le test, pas dans le code.
  const racine = tmp();
  try {
    const N = 12;
    const badges = [];
    for (let k = 1; k <= N; k++) badges.push(badge({ budgetInjection: 8000, paquet: k, paquets: N, racine }));
    const crient = badges.filter((m) => m.includes('REPORTÉE'));
    assert.deepStrictEqual(crient, [],
      'alarme émise alors que la capacité suffit — une alarme permanente est une alarme qu\'on cesse de lire');
    // Contre-épreuve : sans contenu émis, le cas négatif serait vide donc sans valeur.
    assert.ok(badges.some((m) => m.includes('📄')),
      'aucune trame n\'a rien émis : ce cas négatif ne prouve rien — ' + JSON.stringify(badges));
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});
