#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// DOCTOR — dead-man switch : le framework CRIE s'il est mort
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE : un hook PreToolUse mort est INDISCERNABLE d'un hook
// absent. Il n'y a AUCUN symptôme visible — pas d'erreur, pas de log, juste
// une doc qui n'arrive plus dans le contexte de l'agent. Déjà vécu deux fois
// le 15/07/2026 : (1) config de fixture committée → 0 injection pendant des
// jours ; (2) lock cassé sur checkout frais → invisible en local. Les tests
// unitaires ne voient RIEN de tout ça : ils fabriquent leur propre config et
// n'exercent jamais le câblage réel.
//
// CE QUE ÇA COUVRE (ce qu'aucun autre gate ne couvre) :
//   1. PROBE bout-en-bout : spawn le VRAI hook, en isolation totale (tmpdir),
//      avec un payload MCP synthétique → assert qu'un additionalContext sort.
//      Attrape : node cassé, crash au chargement, dépendance manquante,
//      contrat de sortie Claude Code changé, exit(0) silencieux.
//   2. CÂBLAGE (--settings <path>) : le settings.json de la machine référence
//      -t-il des fichiers hooks qui EXISTENT vraiment ? Attrape : fichier
//      renommé/déplacé, chemin absolu périmé — LA cause la plus probable de
//      mort silencieuse, puisque le câblage vit HORS du repo (donc aucun test
//      du repo ne peut le voir).
//
// ⚠️ SORTIE BRUYANTE ET EXIT ≠ 0 en cas d'échec : c'est tout l'intérêt.
// NE JAMAIS le rendre fail-open comme les hooks — un hook doit être silencieux
// et non-bloquant en prod, un DIAGNOSTIC doit hurler. Rôles opposés, jamais
// fusionnés.
//
// Usage :
//   node doctor.js                             → probe bout-en-bout
//   node doctor.js --settings ~/.claude/settings.json → probe + câblage
// ═══════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ⚠️ HOOK UNIQUE depuis la fusion (17/07/2026) : doc-inject.js (la porte)
//    injecte TOUTES les docs — fichier (frontmatters) ET MCP (docs/mcp/).
//    legacy-mcp-inject.js est RETIRÉ du câblage (gardé dans le repo pour le
//    différentiel mcp-differential.test.js et le rollback).
const PORTE = path.join(__dirname, 'doc-inject.js');
const RESET_HOOK = path.join(__dirname, 'ctxroute-reset.js');
// Porte SŒUR SessionStart (docs/session/ injectées à chaque début de session).
const SESSION_PORTE = path.join(__dirname, 'session-inject.js');
// Garde d'écriture PostToolUse (feedback temps réel sur doc invalide).
const WRITE_GUARD = path.join(__dirname, 'doc-write-guard.js');
// Porte TOUR (UserPromptSubmit) : compteur de tours pour driftUnit 'turn'.
const TURN_PORTE = path.join(__dirname, 'turn-count.js');
// Coquilles CODEX (19/07/2026) : mêmes cœurs (porte-core/guard-core), dialecte
// Codex CLI. reset/turn-count/session-inject se câblent TELS QUELS côté Codex.
const CODEX_PORTE = path.join(__dirname, 'codex-doc-inject.js');
const CODEX_GUARD = path.join(__dirname, 'codex-doc-write-guard.js');

// ⚠️ --quiet : SILENCE TOTAL tant que tout va bien, cri intégral dès qu'un
// check tombe. Mode destiné au câblage SessionStart : un diagnostic qui parle
// à chaque session devient du bruit, et le bruit se fait ignorer — donc il ne
// serait plus lu le jour où il a quelque chose d'important à dire.
// ⚠️ N'affecte QUE la sortie de succès : les échecs hurlent toujours.
const QUIET = process.argv.includes('--quiet');
const say = (msg) => { if (!QUIET) console.log(msg); };

const problems = [];
const checks = [];

function check(name, cond, detail) {
  checks.push({ name, ok: !!cond });
  if (cond) say(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}`); problems.push(detail || name); }
}

// ── 1. PROBE BOUT-EN-BOUT ────────────────────────────────────────────
// Isolation TOTALE via les 3 env vars de paths.js : ne touche NI la config
// livrée, NI docs/mcp/, NI state/. Un probe qui pollue le repo serait la
// répétition exacte du bug qu'on cherche à empêcher.
function probe() {
  say('probe bout-en-bout (spawn du hook réel) :');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxroute-doctor-'));
  const docsDir = path.join(tmp, 'docs');
  const fileDocsDir = path.join(tmp, 'filedocs');
  const stateDir = path.join(tmp, 'state');
  const configPath = path.join(tmp, 'config.json');
  const SENTINEL = 'DOCTOR_PROBE_SENTINEL';
  const FILE_SENTINEL = 'DOCTOR_PROBE_FILE_SENTINEL';

  try {
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(fileDocsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'doctorprobe.md'), `# probe\n${SENTINEL}\n`);
    fs.writeFileSync(path.join(fileDocsDir, 'doctorprobe-file.md'),
      `---\nmatch: doctor-probe-target.js\nmode: dumb\n---\n${FILE_SENTINEL}\n`);
    fs.writeFileSync(configPath, JSON.stringify({
      mode: 'dumb', filterMode: 'none', servers: {},
      // Skill synthétique pour le Probe 5 (source skill). dumb = injecte à chaque appel.
      skills: { doctorprobeskill: { match: ['doctor-probe-skill-target'], servers: ['doctorprobesrv'], mode: 'dumb' } },
    }));

    const env = {
      ...process.env,
      CTXROUTE_CONFIG_PATH: configPath,
      CTXROUTE_DOCS_DIR: docsDir,
      CTXROUTE_FILEDOCS_DIR: fileDocsDir,
      CTXROUTE_STATE_DIR: stateDir,
      CTXROUTE_GC_PROBABILITY: '0', // purge désactivée : le probe ne doit rien supprimer
    };

    // Probe 1 — voie MCP de la porte (source sources/mcp.js).
    const r = spawnSync(process.execPath, [PORTE], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'mcp__doctorprobe__ping',
        session_id: 'doctor-probe',
        tool_input: {},
      }),
      encoding: 'utf8',
      env,
    });

    check('la porte s\'exécute sans crash (exit 0)', r.status === 0,
      `doc-inject.js a quitté avec le code ${r.status} — stderr: ${(r.stderr || '').trim().slice(0, 300)}`);

    let out = null;
    try { out = JSON.parse((r.stdout || '').trim()); } catch { /* out reste null */ }

    check('la porte émet un JSON de décision valide sur stdout', out !== null,
      `stdout illisible ou vide : ${(r.stdout || '').trim().slice(0, 200)}`);

    check('la décision respecte le contrat PreToolUse de Claude Code',
      out && out.hookSpecificOutput && out.hookSpecificOutput.permissionDecision === 'allow',
      'hookSpecificOutput.permissionDecision !== "allow" — contrat de sortie Claude Code cassé.');

    check('la doc MCP est RÉELLEMENT injectée (additionalContext contient la sentinelle)',
      out && out.hookSpecificOutput && String(out.hookSpecificOutput.additionalContext || '').includes(SENTINEL),
      'La porte tourne mais N\'INJECTE RIEN côté MCP — mort silencieuse, exactement le bug du 15/07/2026.');

    // Probe 2 — voie FICHIER de la porte (source sources/file.js, frontmatters).
    const rf = spawnSync(process.execPath, [PORTE], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        session_id: 'doctor-probe',
        tool_input: { file_path: 'C:/tmp/doctor-probe-target.js' },
      }),
      encoding: 'utf8',
      env,
    });
    let outF = null;
    try { outF = JSON.parse((rf.stdout || '').trim()); } catch { /* outF reste null */ }
    check('la doc FICHIER est RÉELLEMENT injectée (voie frontmatter vivante)',
      rf.status === 0 && outF && outF.hookSpecificOutput
        && String(outF.hookSpecificOutput.additionalContext || '').includes(FILE_SENTINEL),
      'La porte tourne mais N\'INJECTE RIEN côté FICHIER — mort silencieuse de la voie frontmatter.');

    // Le reset PreCompact doit SUPPRIMER RÉELLEMENT les 3 stores — « exit 0 »
    // seul ne prouve RIEN (un reset qui sort proprement sans rien effacer =
    // docs plus jamais réinjectées après compaction, EN SILENCE — trou du
    // doctor trouvé le 19/07/2026). Preuve = poser les 3 fichiers, reset,
    // exiger leur ABSENCE.
    fs.mkdirSync(stateDir, { recursive: true });
    const storeFiles = ['doc-seen-', 'ctxroute-seen-', 'turn-count-'].map((p) => path.join(stateDir, `${p}doctor-probe.json`));
    for (const f of storeFiles) fs.writeFileSync(f, '{}');
    const rr = spawnSync(process.execPath, [RESET_HOOK], {
      input: JSON.stringify({ hook_event_name: 'PreCompact', session_id: 'doctor-probe', trigger: 'auto' }),
      encoding: 'utf8',
      env,
    });
    check('le reset PreCompact SUPPRIME réellement les 3 stores (pas juste exit 0)',
      rr.status === 0 && storeFiles.every((f) => !fs.existsSync(f)),
      'ctxroute-reset.js sort en exit 0 mais les stores SURVIVENT — docs jamais réinjectées après compaction, en silence.');

    // Probe 3 — porte SESSION (docs/session/ → SessionStart). Même pattern :
    // une porte qui tourne sans injecter = mort silencieuse.
    const SESSION_SENTINEL = 'DOCTOR_PROBE_SESSION_SENTINEL';
    const sessionDocsDir = path.join(tmp, 'sessiondocs');
    fs.mkdirSync(sessionDocsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDocsDir, 'doctorprobe-session.md'), `${SESSION_SENTINEL}\n`);
    const rs = spawnSync(process.execPath, [SESSION_PORTE], {
      input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'doctor-probe' }),
      encoding: 'utf8',
      env: { ...env, CTXROUTE_SESSIONDOCS_DIR: sessionDocsDir },
    });
    let outS = null;
    try { outS = JSON.parse((rs.stdout || '').trim()); } catch { /* outS reste null */ }
    check('la doc SESSION est RÉELLEMENT injectée (porte SessionStart vivante)',
      rs.status === 0 && outS && outS.hookSpecificOutput
        && outS.hookSpecificOutput.hookEventName === 'SessionStart'
        && String(outS.hookSpecificOutput.additionalContext || '').includes(SESSION_SENTINEL),
      'session-inject.js tourne mais N\'INJECTE RIEN — mort silencieuse de la voie session.');

    // Probe 4 — garde d'écriture (doc invalide → feedback block). Une garde
    // muette laisse les agents écrire des docs mortes sans un mot.
    const badDoc = path.join(fileDocsDir, 'doctorprobe-invalide.md');
    fs.writeFileSync(badDoc, '---\nmach: typo.js\n---\ncontenu\n');
    const rg = spawnSync(process.execPath, [WRITE_GUARD], {
      input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: badDoc } }),
      encoding: 'utf8',
      env,
    });
    let outG = null;
    try { outG = JSON.parse((rg.stdout || '').trim()); } catch { /* outG reste null */ }
    check('la GARDE D\'ÉCRITURE signale une doc invalide (feedback temps réel vivant)',
      rg.status === 0 && outG && outG.decision === 'block',
      'doc-write-guard.js ne signale PAS une doc invalide — les agents écrivent des docs mortes en silence.');

    // Probe 5 — source SKILL (config.skills → CORPS du skill par périmètre,
    // décision mainteneur 18/07/2026). Le probe pose un VRAI fichier skill dans un
    // store isolé et exige que son CONTENU soit injecté (pas un pointeur).
    const SKILL_SENTINEL = 'DOCTOR_PROBE_SKILL_SENTINEL';
    const skillsDirProbe = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDirProbe, { recursive: true });
    fs.writeFileSync(path.join(skillsDirProbe, 'doctorprobeskill.md'), `# doctorprobeskill\n${SKILL_SENTINEL}\n`);
    const rk = spawnSync(process.execPath, [PORTE], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        session_id: 'doctor-probe',
        tool_input: { file_path: 'C:/tmp/doctor-probe-skill-target.js' },
      }),
      encoding: 'utf8',
      env: { ...env, CTXROUTE_SKILLS_DIR: skillsDirProbe },
    });
    let outK = null;
    try { outK = JSON.parse((rk.stdout || '').trim()); } catch { /* outK reste null */ }
    check('le CORPS du skill est RÉELLEMENT injecté (source skill vivante)',
      rk.status === 0 && outK && outK.hookSpecificOutput
        && String(outK.hookSpecificOutput.additionalContext || '').includes(SKILL_SENTINEL),
      'sources/skill.js tourne mais N\'INJECTE PAS le contenu du skill — mort silencieuse de la voie skill.');

    // Probe 6 — porte TOUR (turn-count.js, UserPromptSubmit). Muette par
    // contrat (stdout = contexte injecté !) : la preuve de vie est le STORE
    // incrémenté, jamais la sortie. Un compteur mort = les docs driftUnit
    // 'turn' ne se réinjectent plus jamais, en silence.
    const rt = spawnSync(process.execPath, [TURN_PORTE], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'doctor-probe', prompt: 'probe' }),
      encoding: 'utf8',
      env,
    });
    let turns = null;
    try {
      turns = JSON.parse(fs.readFileSync(path.join(stateDir, 'turn-count-doctor-probe.json'), 'utf8')).turns;
    } catch { /* turns reste null */ }
    check('le compteur de TOURS incrémente RÉELLEMENT (porte turn-count vivante) et reste MUET',
      rt.status === 0 && (rt.stdout || '').trim() === '' && turns === 1,
      'turn-count.js ne compte pas (ou parle sur stdout = pollution de contexte) — driftUnit turn mort en silence.');
    // Probe 7 — coquille CODEX PreToolUse (codex-doc-inject.js). Payload au
    // dialecte Codex (Bash + command, pas d'agent_id). Preuve d'EFFET RÉEL :
    // sentinelle dans additionalContext, et JAMAIS de permissionDecision
    // (contrat coquille : on informe, on ne décide pas).
    const rc = spawnSync(process.execPath, [CODEX_PORTE], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        session_id: 'doctor-probe-codex',
        tool_input: { command: 'cat C:/tmp/doctor-probe-target.js' },
      }),
      encoding: 'utf8',
      env,
    });
    let outC = null;
    try { outC = JSON.parse((rc.stdout || '').trim()); } catch { /* outC reste null */ }
    check('la coquille CODEX injecte RÉELLEMENT (dialecte Codex vivant, sans permissionDecision)',
      rc.status === 0 && outC && outC.hookSpecificOutput
        && outC.hookSpecificOutput.permissionDecision === undefined
        && String(outC.hookSpecificOutput.additionalContext || '').includes(FILE_SENTINEL),
      'codex-doc-inject.js n\'injecte pas (ou émet un permissionDecision) — voie Codex morte ou hors contrat.');

    // Probe 8 — garde d'écriture CODEX (chemins extraits du patch apply_patch).
    const rgc = spawnSync(process.execPath, [CODEX_GUARD], {
      input: JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'apply_patch',
        tool_input: { command: `*** Begin Patch\n*** Update File: ${badDoc}\n*** End Patch` },
      }),
      encoding: 'utf8',
      env,
    });
    let outGC = null;
    try { outGC = JSON.parse((rgc.stdout || '').trim()); } catch { /* outGC reste null */ }
    check('la GARDE CODEX signale une doc invalide écrite via apply_patch',
      rgc.status === 0 && outGC && outGC.decision === 'block',
      'codex-doc-write-guard.js ne signale PAS une doc invalide dans un patch — écritures Codex sans filet.');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* tmpdir OS, jamais bloquant */ }
  }
}

// ── 2. CÂBLAGE settings.json ─────────────────────────────────────────
// ⚠️ Le câblage vit HORS du repo → AUCUN test du repo ne peut le voir.
// C'est précisément là que la mort silencieuse frappe (fichier déplacé,
// chemin absolu périmé). D'où le check explicite, opt-in par --settings.
function checkWiring(settingsPath) {
  say(`\ncâblage (${settingsPath}) :`);
  let raw = null;
  try { raw = fs.readFileSync(settingsPath, 'utf8'); } catch { /* raw reste null */ }
  if (raw === null) { check('settings.json lisible', false, `settings.json introuvable : ${settingsPath}`); return; }

  let settings = null;
  try { settings = JSON.parse(raw); } catch { /* settings reste null */ }
  check('settings.json est un JSON valide', settings !== null, `JSON invalide : ${settingsPath}`);
  if (!settings) return;

  // Récupère toute commande de hook mentionnant nos 2 fichiers, quel que soit
  // l'événement — on ne présume PAS de la structure exacte de settings.json
  // (elle évolue avec Claude Code ; un parsing rigide serait un faux négatif).
  const commands = JSON.stringify(settings).match(/"command"\s*:\s*"([^"]+)"/g) || [];

  // ── RESET (ctxroute-reset.js, PreCompact) : sans lui, docs jamais réinjectées
  //    après compaction, en silence.
  const resets = commands.filter((c) => c.includes('ctxroute-reset'));
  check('le reset PreCompact est câblé (ctxroute-reset.js)', resets.length >= 1,
    'ctxroute-reset.js absent de settings.json : plus de réinjection après compaction, en silence.');
  for (const c of resets) {
    const m = /([A-Za-z]:[\\/][^"]*?|\/[^"]*?)ctxroute-reset\.js/.exec(c);
    if (!m) continue;
    const file = `${m[1]}ctxroute-reset.js`;
    check('le fichier câblé existe : ctxroute-reset.js', fs.existsSync(file),
      `settings.json pointe vers un fichier INEXISTANT : ${file} — hook mort en silence.`);
    check('le fichier câblé est bien CE repo : ctxroute-reset.js',
      path.resolve(file) === path.resolve(path.join(__dirname, 'ctxroute-reset.js')),
      `settings.json pointe vers une AUTRE copie du framework : ${file} (ce repo : ${__dirname}) — tes modifications ici ne s'appliquent pas.`);
  }

  // ── HOOK UNIQUE : depuis la fusion (17/07/2026), legacy-mcp-inject.js ne doit
  //    PLUS être câblé — la porte injecte aussi les docs MCP. Le laisser =
  //    docs MCP injectées EN DOUBLE à chaque appel (tokens brûlés en silence).
  check('legacy-mcp-inject.js n\'est PLUS câblé (la porte couvre le MCP — sinon double injection)',
    !commands.some((c) => c.includes('legacy-mcp-inject')),
    'legacy-mcp-inject.js encore câblé dans settings.json : docs MCP injectées en DOUBLE (porte + legacy).');

  // ── PORTE (doc-inject.js) : l'injecteur UNIQUE (fichier + MCP) depuis la fusion.
  // ⚠️ `doc-inject.js` ≠ `legacy-mcp-inject.js` (legacy retiré). Une porte non câblée
  //    ou pointant vers un fichier mort = plus AUCUNE doc injectée, EN SILENCE —
  //    exactement le mode de panne que ce dead-man switch existe pour attraper.
  const porte = commands.filter((c) => /doc-inject\.js/.test(c) && !c.includes('legacy-mcp-inject'));
  check('la PORTE (doc-inject.js) est câblée — sinon plus AUCUNE doc injectée', porte.length >= 1,
    'doc-inject.js absent de settings.json : depuis la fusion, c\'est LUI qui injecte TOUTES les docs. Mort silencieux.');
  for (const c of porte) {
    const m = /([A-Za-z]:[\\/][^"]*?|\/[^"]*?)doc-inject\.js/.exec(c);
    if (!m) continue;
    const file = `${m[1]}doc-inject.js`;
    check('le fichier câblé existe : doc-inject.js', fs.existsSync(file),
      `settings.json pointe vers une PORTE inexistante : ${file} — hook mort en silence.`);
    check('la PORTE câblée est bien CE repo : doc-inject.js',
      path.resolve(file) === path.resolve(path.join(__dirname, 'doc-inject.js')),
      `settings.json pointe vers une AUTRE copie de la porte : ${file} (ce repo : ${__dirname}).`);
  }

  // ── PORTE SESSION (session-inject.js, SessionStart) : sans elle, plus
  //    aucune doc de session injectée au démarrage/après compaction, en silence.
  const sessionPorte = commands.filter((c) => c.includes('session-inject'));
  check('la porte SESSION (session-inject.js) est câblée en SessionStart', sessionPorte.length >= 1,
    'session-inject.js absent de settings.json : plus aucune doc docs/session/ injectée, en silence.');
  for (const c of sessionPorte) {
    const m = /([A-Za-z]:[\\/][^"]*?|\/[^"]*?)session-inject\.js/.exec(c);
    if (!m) continue;
    const file = `${m[1]}session-inject.js`;
    check('le fichier câblé existe : session-inject.js', fs.existsSync(file),
      `settings.json pointe vers une porte session inexistante : ${file} — hook mort en silence.`);
    check('la porte SESSION câblée est bien CE repo : session-inject.js',
      path.resolve(file) === path.resolve(path.join(__dirname, 'session-inject.js')),
      `settings.json pointe vers une AUTRE copie de la porte session : ${file} (ce repo : ${__dirname}).`);
  }

  // ── GARDE D'ÉCRITURE (doc-write-guard.js, PostToolUse Write|Edit) : sans
  //    elle, une doc invalide n'est vue qu'au prochain démarrage/push.
  check('la garde d\'écriture (doc-write-guard.js) est câblée en PostToolUse',
    commands.some((c) => c.includes('doc-write-guard')),
    'doc-write-guard.js absent de settings.json : plus de feedback temps réel sur doc invalide.');

  // ── PORTE TOUR (turn-count.js, UserPromptSubmit) : sans elle, toute doc/skill
  //    en driftUnit 'turn' ne se réinjecte plus JAMAIS (compteur figé), en silence.
  check('la porte TOUR (turn-count.js) est câblée en UserPromptSubmit',
    commands.some((c) => c.includes('turn-count')),
    'turn-count.js absent de settings.json : driftUnit turn mort — docs jamais réinjectées, en silence.');
}

// ── 2bis. CÂBLAGE CODEX (~/.codex/hooks.json ou config.toml) ─────────
// ⚠️ Même raison d'être que checkWiring : le câblage Codex vit HORS du repo.
// Opt-in par --codex-hooks <path>. Vérifie les 5 voies (2 coquilles Codex +
// 3 portes RÉUTILISÉES telles quelles : reset, session, tour) + l'ANTI-DOUBLE
// INJECTION : l'ancien mécanisme (copie protect-files.js dans ~/.codex) ne
// doit PLUS être câblé en même temps que codex-doc-inject — sinon chaque doc
// arrive EN DOUBLE à chaque appel d'outil (tokens brûlés en silence).
function checkCodexWiring(hooksPath) {
  say(`\ncâblage CODEX (${hooksPath}) :`);
  let raw = null;
  try { raw = fs.readFileSync(hooksPath, 'utf8'); } catch { /* raw reste null */ }
  if (raw === null) { check('config hooks Codex lisible', false, `fichier introuvable : ${hooksPath}`); return; }

  // Match TEXTUEL volontaire (comme checkWiring) : JSON (hooks.json) ET TOML
  // (config.toml) sans parseur dédié — on cherche les références de fichiers,
  // pas la structure (elle évolue avec Codex ; un parsing rigide = faux négatif).
  const wired = (name) => raw.includes(name);
  const expectRepo = (name) => {
    // Toute occurrence du fichier doit pointer CE repo (jamais une copie).
    const re = new RegExp(`([A-Za-z]:[\\\\/][^"'\\s]*?|/[^"'\\s]*?)${name.replace('.', '\\.')}`, 'g');
    let m; let all = true; let found = false;
    while ((m = re.exec(raw)) !== null) {
      found = true;
      const file = `${m[1]}${name}`.replace(/\\\\/g, '\\');
      if (path.resolve(file) !== path.resolve(path.join(__dirname, name))) all = false;
      if (!fs.existsSync(path.resolve(file))) all = false;
    }
    return found && all;
  };

  check('la coquille CODEX (codex-doc-inject.js) est câblée en PreToolUse', wired('codex-doc-inject.js'),
    'codex-doc-inject.js absent du câblage Codex : AUCUNE doc injectée côté Codex, en silence.');
  check('la garde CODEX (codex-doc-write-guard.js) est câblée en PostToolUse', wired('codex-doc-write-guard.js'),
    'codex-doc-write-guard.js absent : écritures apply_patch sans filet temps réel.');
  check('le reset (ctxroute-reset.js, PORTE RÉUTILISÉE) est câblé en PreCompact', wired('ctxroute-reset.js'),
    'ctxroute-reset.js absent du câblage Codex : plus de réinjection après compaction, en silence.');
  check('la porte SESSION (session-inject.js, RÉUTILISÉE) est câblée en SessionStart', wired('session-inject.js'),
    'session-inject.js absent du câblage Codex : docs/session/ jamais injectées côté Codex.');
  check('la porte TOUR (turn-count.js, RÉUTILISÉE) est câblée en UserPromptSubmit', wired('turn-count.js'),
    'turn-count.js absent du câblage Codex : driftUnit turn mort côté Codex.');
  for (const name of ['codex-doc-inject.js', 'codex-doc-write-guard.js', 'ctxroute-reset.js', 'session-inject.js', 'turn-count.js']) {
    if (wired(name)) {
      check(`le fichier câblé existe et est CE repo : ${name}`, expectRepo(name),
        `le câblage Codex pointe vers une copie/un fichier inexistant pour ${name} (ce repo : ${__dirname}).`);
    }
  }
  // ── LE PLAFOND DE CONTEXTE CODEX (04/08/2026) ──────────────────────
  // ⚠️ Codex SPILLE sur disque tout additionalContext dépassant son défaut de
  //    2500 TOKENS et n'envoie qu'un aperçu, SANS le dire au hook : la panne
  //    silencieuse que ce framework combat. Seul `additionalContextLimit = 0`
  //    (doc officielle : « pass the handler's complete additional context
  //    directly to the model ») garantit la livraison intégrale.
  // ⚠️ Vérifié PAR BLOC, jamais sur le fichier entier : une seule occurrence
  //    quelque part laisserait l'AUTRE émetteur muet — c'est précisément le
  //    faux vert qu'un match global produirait.
  // ⚠️ N'exiger le réglage QUE des voies qui ÉMETTENT du contexte : l'imposer
  //    au reset/à la garde/au compteur (qui n'émettent rien) serait une
  //    déclaration inerte, la classe d'erreur tuée le 31/07 et le 04/08.
  // ⚠️ Découpage par `command` et NON par `[[hooks.` : le doctor accepte TOML
  //    (requirements.toml, le terrain réel) ET JSON (hooks.json) — un split sur
  //    la syntaxe TOML rendrait ce check MUET sur un câblage JSON, c'est-à-dire
  //    inerte, exactement le défaut du 03/08. `command` existe dans les deux.
  //    Contrat : le réglage vit dans le bloc de SON hook, après son `command`.
  // ⚠️ GUILLEMETS OPTIONNELS obligatoires dans les 2 motifs : TOML écrit
  //    `command = '...'`, JSON écrit `"command":"..."`. Un motif sans `"?`
  //    ne voit RIEN en JSON — le check passait alors au vert par accident
  //    (bloc unique) ou au rouge à tort. Mesuré ici même le 04/08/2026.
  const blocs = raw.split(/(?="?command"?\s*[=:])/);
  for (const emetteur of ['codex-doc-inject.js', 'session-inject.js']) {
    if (!wired(emetteur)) continue;
    const bloc = blocs.find((b) => b.includes(emetteur));
    check(`${emetteur} declare additionalContextLimit = 0 (livraison INTEGRALE)`,
      Boolean(bloc) && /additionalContextLimit"?\s*[=:]\s*0(?!\d)/.test(bloc),
      `${emetteur} est cable SANS additionalContextLimit = 0 : Codex applique son defaut de 2500 tokens, `
      + 'ecrit le surplus sur disque et n\'envoie qu\'un APERCU au modele, en SILENCE. '
      + 'Les grosses docs et les skills n\'arrivent donc jamais entiers cote Codex.');
  }

  // ⚠️ Match restreint aux lignes `command` : un COMMENTAIRE d'avertissement a
  //    le droit de nommer protect-files.js sans déclencher (faux positif vécu
  //    le 19/07/2026 sur le _comment du hooks.json fraîchement câblé).
  check('l\'ancien protect-files.js n\'est PLUS câblé côté Codex (sinon DOUBLE injection)',
    !/command[^\n]*protect-files\.js/.test(raw),
    'protect-files.js encore câblé dans les hooks Codex EN MÊME TEMPS que la coquille : chaque doc arrive en DOUBLE.');
}

say('ctxroute doctor\n');
probe();

// ── 3. INSTALLATION RÉELLE (uniquement avec --settings) ──────────────
// ⚠️ Ce check ne vaut QUE pour une install vivante, JAMAIS pour le repo :
// `docs/mcp/*.md` est gitignoré, donc un checkout frais (CI, clone) n'en a
// aucun — l'exiger côté repo a mis la CI au rouge sur 3 OS le 15/07/2026.
// "Des docs existent" est un invariant d'INSTALLATION, pas de dépôt.
function checkInstall() {
  const paths = require('./paths');
  say('\ninstallation :');
  let docs = [];
  try {
    docs = fs.readdirSync(paths.docsDir()).filter((f) => f.endsWith('.md') && !f.endsWith('.md.example'));
  } catch { /* dossier absent → docs vide → check ci-dessous échoue, c'est voulu */ }
  check('au moins un serveur MCP est documenté (sans doc, le framework ne sert à rien)', docs.length > 0,
    `Aucun docs/mcp/*.md dans ${paths.docsDir()} — le hook tourne mais n'a rien à injecter.`);
}

const idx = process.argv.indexOf('--settings');
if (idx !== -1 && process.argv[idx + 1]) { checkInstall(); checkWiring(process.argv[idx + 1]); }
// Câblage Codex : opt-in, indépendant de --settings (une machine peut n'avoir
// qu'un harnais). Usage : node doctor.js --codex-hooks ~/.codex/hooks.json
const idxC = process.argv.indexOf('--codex-hooks');
if (idxC !== -1 && process.argv[idxC + 1]) checkCodexWiring(process.argv[idxC + 1]);

const failed = checks.filter((c) => !c.ok).length;
if (failed > 0 || !QUIET) console.log(`\n${checks.length - failed} ok, ${failed} problème(s)`);
if (failed > 0) {
  // ⚠️ BRUYANT VOLONTAIREMENT (stderr + exit 1) : le silence EST le bug.
  console.error('\n🚨 ctxroute est CASSÉ — aucune doc MCP n\'est injectée :');
  for (const p of problems) console.error(`   • ${p}`);
  process.exit(1);
}
say('✅ framework vivant : le hook tourne ET injecte réellement.');
