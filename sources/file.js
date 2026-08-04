// ═══════════════════════════════════════════════════════════════════════
// SOURCE « fichier » — PURE. payload -> quels docs, dans quel ordre ?
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O. Pas de fs, pas de path, pas de process. Comme lib-pure.js :
//    cette pureté N'EST PAS un confort de test, c'est la CONDITION pour que
//    Stryker mute sans produire de mutants équivalents (faux signal de couverture).
//    Scellé par .dependency-cruiser.json.
//
// ⚠️ CE MODULE NE CONNAÎT AUCUN HARNAIS. Il ne sait rien de Claude Code, de
//    `permissionDecision` ni de `hookSpecificOutput`. Il répond à une question,
//    il ne décide RIEN. Traduire en dialecte de harnais = le rôle de la porte
//    (legacy-mcp-inject.js, protect-files.js, futur portage Codex).
//    Y introduire un format de sortie = casser le portage multi-harnais.
//
// ⚠️ SÉMANTIQUE FIGÉE — réplique EXACTE de protect-files.js (529 règles en prod).
//    Scellée par le test différentiel (file-differential.test.js) qui rejoue
//    l'ancien et le nouveau moteur et exige des docs IDENTIQUES ET ORDONNÉES.
//    Toute « amélioration » ici sans mise à jour du différentiel = régression
//    silencieuse sur des règles que PERSONNE ne relit à la main.
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ norm() = normalisation pour `.includes()` robuste cross-platform.
//   - Backslash Windows → slash POSIX (sinon scope "api-site/src" rate sur "C:\api-site\src")
//   - Lowercase (sinon scope "api-site" rate sur "API-SITE")
// Appliqué uniformément sur pattern, scope, exclude, paths, commands.
// ⚠️ NE JAMAIS normaliser le CONTENU d'une doc — seule la comparaison l'est.
function norm(s) {
  return (s == null ? '' : String(s)).replace(/\\/g, '/').toLowerCase();
}

// ⚠️ Extraction des chemins — réplique exacte de protect-files.js.
//   file_path (Read/Edit/Write/SSH) · remotePath (upload/download) · path (Grep natif + SSH grep)
//   apply_patch (Codex) : les chemins vivent DANS le texte du patch, jamais en param.
//   Claude n'envoie jamais apply_patch — ce bloc est mort côté Claude, VIVANT côté Codex.
//   ⚠️ NE PAS le retirer en croyant à du code mort : c'est la moitié du portage.
function extractFilePaths(toolName, toolInput) {
  const filePaths = [];
  if (typeof toolInput.file_path === 'string') filePaths.push(toolInput.file_path);
  if (typeof toolInput.remotePath === 'string') filePaths.push(toolInput.remotePath);
  if (typeof toolInput.path === 'string') filePaths.push(toolInput.path);
  // ⚠️ `cwd` (18/07/2026) : chemin candidat posé UNIQUEMENT par sources/skill.js
  //    (périmètre par répertoire courant — signal MESURÉ commun aux contrats de
  //    hooks Claude Code et Codex). INERTE pour les docs fichier : aucun outil
  //    réel ne met `cwd` dans tool_input et la porte ne l'injecte que côté
  //    skill — parité protect-files intacte PAR CONSTRUCTION.
  if (typeof toolInput.cwd === 'string') filePaths.push(toolInput.cwd);

  if (toolName === 'apply_patch') {
    // Stryker disable next-line StringLiteral: mutant ÉQUIVALENT prouvé (16/07/2026) — le fallback
    // ne traverse QUE la regex `*** ... File:`, qui ne trouve jamais de marqueur dans le littéral
    // du mutant. Restructurer pour l'éviter par construction = interdit sans rejouer le différentiel.
    // ⚠️ `command` = shape RÉEL Codex CLI ≥ 0.144 (doc officielle re-lue le
    //    19/07/2026 : « Bash and apply_patch use tool_input.command ») ;
    //    input/patch = shapes historiques conservés (rétro-compat, coût nul).
    const patch = toolInput.input || toolInput.patch || toolInput.command || '';
    const re = /\*\*\* (?:Update|Add|Delete) File:\s*(.+)/g;
    let m;
    while ((m = re.exec(String(patch))) !== null) filePaths.push(m[1].trim());
  }
  return filePaths;
}

// EXCLUDE : matché contre le contexte EN COURS (chemin/commande) uniquement.
// SCOPE   : matché contre TOUS les params string de l'outil concaténés.
// ⚠️ Asymétrie VOLONTAIRE, pas un oubli — cf règle Documentation du CLAUDE.md global.
//    scope absent OU tableau vide = « pas de filtre ». Sans le check de longueur,
//    Array.isArray=true + .some sur [] = false → skip SILENCIEUX de la règle.
function shouldSkip(rule, context, toolInput) {
  const ctx = norm(context);
  if (Array.isArray(rule.exclude) && rule.exclude.some((ex) => ctx.includes(norm(ex)))) return true;
  if (Array.isArray(rule.scope) && rule.scope.length > 0) {
    const allValues = norm(
      Object.values(toolInput)
        .filter((v) => typeof v === 'string')
        .join(' ')
    );
    if (!rule.scope.some((s) => allValues.includes(norm(s)))) return true;
  }
  return false;
}

// ⚠️ Reconstruction `cd /chemin && commande` — permet de matcher "infra-mcp/server.js"
//    sans chemin absolu. NE COUVRE PAS pushd, subshell, double cd (limite connue,
//    héritée telle quelle : l'élargir ferait diverger le différentiel).
function bashCandidates(command) {
  const out = [command];
  const cdMatch = command.match(/\bcd\s+["']?([^\s"'&;]+)["']?\s*(?:&&|;)/);
  if (cdMatch) {
    const afterCd = command.split(/&&|;/).slice(1).join(' ');
    for (const w of afterCd.trim().split(/\s+/)) out.push(cdMatch[1] + '/' + w);
  }
  return out;
}

/**
 * LA fonction de la source fichier. PURE.
 *
 * @param {Array} rules  - règles { pattern, doc, scope?, exclude? }, ORDRE SIGNIFIANT.
 * @param {object} payload - { toolName, toolInput } neutre, aucun dialecte de harnais.
 * @returns {Array} refs de docs { doc }, dans l'ordre d'injection, dédupées.
 *
 * ⚠️ ORDRE = rule-major (boucle règles → boucle chemins), JAMAIS path-major.
 *    C'est l'ordre parent→enfant dont dépend la concaténation « doc globale → doc spécifique ».
 * ⚠️ DÉDUP = la PREMIÈRE règle qui pointe sur un .md gagne. Les suivantes sont ignorées.
 *    Inverser (dernière gagne) casserait l'ordre parent/enfant en silence.
 */
function matchingDocs(rules, payload) {
  // Stryker disable next-line StringLiteral: mutant ÉQUIVALENT prouvé (16/07/2026) — toolName n'est
  // comparé qu'à 'Bash'/'apply_patch' (jamais à vide) : le littéral du mutant échoue pareil.
  // Restructurer pour l'éviter par construction = interdit sans rejouer le différentiel.
  const toolName = (payload && payload.toolName) || '';
  const toolInput = (payload && payload.toolInput) || {};

  // ⚠️ Les commandes git sont IGNORÉES : un nom de fichier dans un message de commit
  //    déclenche un faux positif (« fix validation.ts » matche le pattern validation.ts).
  const command = typeof toolInput.command === 'string' ? toolInput.command : '';
  if (toolName === 'Bash' && /^\s*git\s+/.test(command)) return [];

  if (!Array.isArray(rules)) return [];

  const filePaths = extractFilePaths(toolName, toolInput);
  const matched = [];
  const seen = new Set();

  const add = (rule) => {
    if (typeof rule.doc !== 'string' || seen.has(rule.doc)) return;
    seen.add(rule.doc);
    matched.push({ doc: rule.doc });
  };

  for (const rule of rules) {
    if (!rule || typeof rule.pattern !== 'string') continue;
    const normPattern = norm(rule.pattern);

    for (const fp of filePaths) {
      if (norm(fp).includes(normPattern) && !shouldSkip(rule, fp, toolInput)) add(rule);
    }

    if (toolName === 'Bash' && command) {
      for (const cand of bashCandidates(command)) {
        if (norm(cand).includes(normPattern) && !shouldSkip(rule, cand, toolInput)) add(rule);
      }
    }
  }

  return matched;
}

module.exports = { matchingDocs, norm, extractFilePaths, shouldSkip, bashCandidates };
