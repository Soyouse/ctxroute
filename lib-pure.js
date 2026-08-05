#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// Logique DÉCISIONNELLE PURE — zéro I/O (aucun fs/process/network).
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ NE JAMAIS importer `fs`/`path`/`process.env` ici. Ce module existe pour
// isoler la décision de l'I/O résiduel (doctrine : "fonction pure → testable
// /mutable ; I/O résiduel = intégration/contrat"). C'est ce qui permet à
// Stryker de muter cette logique sans bruit (un fichier mêlé à du fs/stdin
// produit des mutants équivalents non détectables — faux signal).
//
// Consommé par legacy-mcp-inject.js (le seul point d'I/O : lit stdin/fs, appelle
// ces fonctions, écrit stdout/fs). AUCUNE fonction ici ne doit avoir d'effet
// de bord observable — mêmes entrées ⇒ mêmes sorties, toujours.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Sanitise un session_id pour un nom de fichier sûr cross-OS. 'unknown' si vide.
// ⚠️ UN SEUL fallback ('unknown' en sortie) — pas de double-default redondant
// (un `|| 'unknown'` sur l'entrée ET la sortie produit un mutant équivalent
// indétectable : les deux chemins convergent silencieusement).
// ⚠️ TOTALITÉ : garde typeof OBLIGATOIRE — `String(x)` LÈVE sur un objet dont
// `toString` n'est pas une fonction (ex: {"toString":0}, JSON parfaitement
// valide donc atteignable depuis un payload de hook). Ce n'est PAS une garde
// redondante : trouvé par property-based le 15/07/2026, contre un commentaire
// qui affirmait justement que "la coercion JS suffit". Elle ne suffit pas.
function sanitizeSessionId(sessionId) {
  if (typeof sessionId !== 'string' && typeof sessionId !== 'number') return 'unknown';
  const safe = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'unknown';
}

// SCOPE D'ÉTAT PAR AGENT (19/07/2026) — SOURCE UNIQUE du format de clé de store.
// Doctrine : agent maître et CHAQUE sous-agent = des contextes DISTINCTS → un
// état d'injection (once/smart) DISTINCT par agent. Le harnais fournit
// `agent_id` UNIQUEMENT dans les hooks tirés DANS un sous-agent (doc officielle
// hooks.md, vérifié 19/07/2026 + mesuré payload réel) ; `session_id` et
// `transcript_path` sont PARTAGÉS avec le maître — ne JAMAIS s'en servir pour
// distinguer les agents.
// ⚠️ Sans agent_id ⇒ clé strictement IDENTIQUE à l'historique (rétro-compat,
// parité différentielle intacte). Séparateur `--agent-` : alphabet de
// sanitizeSessionId ⇒ aucune collision possible avec un session_id.
// ⚠️ Ne composer la clé QU'ICI — la recopier dans une porte = la dérive
// silencieuse classique (bug fondateur du trou sous-agents).
function scopeId(sessionId, agentId) {
  const base = sanitizeSessionId(sessionId);
  if (agentId === undefined || agentId === null || agentId === '') return base;
  return base + '--agent-' + sanitizeSessionId(agentId);
}

// Extrait le nom de serveur depuis "mcp__{server}__{tool}". null si pas un outil MCP.
// ⚠️ CORRECTION 15/07/2026 — ce commentaire affirmait AVANT que "exec() coerce
// déjà tout argument non-string, donc une garde serait un mutant équivalent".
// C'EST FAUX, et le property-based l'a prouvé : `{"toString": 0}` (JSON valide,
// donc atteignable depuis un payload de hook) fait LEVER la coercion
// ("Cannot convert object to primitive value"). La garde typeof ci-dessous
// n'est PAS redondante — c'est la condition de TOTALITÉ de la fonction.
// Leçon : "la coercion JS s'en charge" est une hypothèse à VÉRIFIER, pas à
// commenter. Un throw ici remonterait au hook → fail-open → silence total.
// ⚠️ SÉCURITÉ — la classe de caractères est VOLONTAIREMENT RESTRICTIVE
// ([a-zA-Z0-9-], jamais `[^_]`). NE JAMAIS l'élargir. Trou RÉEL trouvé par
// property-based le 15/07/2026 : `[^_]+` matche aussi `/`, `\` et `.`, donc
// `mcp__../../etc__x` produisait server="../../etc" → chemin de doc hors de
// docs/mcp/ (les tests écrits à la main n'avaient pas vu ce cas). Les vrais
// noms de serveurs MCP sont des identifiants (stripe, qa-seo,
// plugin_discord_discord) : rien de légitime n'est perdu ici.
function serverName(toolName) {
  if (typeof toolName !== 'string') return null;
  const m = /^mcp__([a-zA-Z0-9-]+(?:_[a-zA-Z0-9-]+)*?)__/.exec(toolName);
  return m ? m[1] : null;
}

// Extrait le SUFFIXE outil depuis "mcp__{server}__{tool}" (tout ce qui suit
// le préfixe serveur). Ex: mcp__stripe__authenticate, server="stripe" → "authenticate".
// ⚠️ TOTALITÉ : `typeof toolName !== 'string'` — un objet sans .startsWith
// lèverait un TypeError (même classe que serverName ci-dessus, cf property test).
function toolSuffix(toolName, server) {
  if (!server || typeof toolName !== 'string') return null;
  const prefix = `mcp__${server}__`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : null;
}

// Un segment est-il sûr comme composant de chemin de doc (docs/mcp/{seg}.md) ?
// ⚠️ SÉCURITÉ — NE JAMAIS RETIRER. `subTool` vient de tool_input, donc d'une
// valeur potentiellement dérivée de données EXTERNES (retour d'API, contenu
// web, ticket client). Sans ce filtre, un subTool = "../../../../secrets"
// fait sortir path.join() de docs/mcp/ et INJECTE le contenu d'un .md
// arbitraire du disque dans le contexte de l'agent COMME UNE CONSIGNE
// FAISANT AUTORITÉ (primitive d'injection de prompt, pas une simple lecture).
// Rejette tout séparateur de chemin, tout '..', tout NUL, tout absolu/UNC.
// Miroir de sanitizeSessionId() : même classe de risque (donnée non maîtrisée
// → nom de fichier), donc même réflexe — filtrer, jamais faire confiance.
function isSafePathSegment(seg) {
  if (typeof seg !== 'string' || seg === '') return false;
  if (seg === '.' || seg === '..') return false;
  return !/[/\\\0]/.test(seg);
}

// Lit une valeur imbriquée via un chemin pointé ("args.tool" → obj.args.tool).
// ⚠️ Retourne seulement des valeurs SCALAIRES sûres pour un nom de fichier
// (string/number) — un objet/array ne correspond à aucun .md, jamais planter.
function getByPath(obj, dottedPath) {
  if (!obj || typeof dottedPath !== 'string') return null;
  const val = dottedPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  return (typeof val === 'string' || typeof val === 'number') ? String(val) : null;
}

// Seuil effectif pour CE serveur : override servers.{server}.threshold > defaultThreshold > 4.
function thresholdFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].threshold;
  return Number.isInteger(override) ? override : (Number.isInteger(config.defaultThreshold) ? config.defaultThreshold : 4);
}

// Mode effectif pour CE serveur : override servers.{server}.mode > mode global > "smart".
function modeFor(config, server) {
  const override = config.servers && config.servers[server] && config.servers[server].mode;
  return override || config.mode || 'smart';
}

// Interrupteur GLOBAL du framework entier (config.json → "enabled").
// ⚠️ Coupe TOUT (injection additionalContext ET tracking d'état/compteurs) —
// pattern standard (ESLint, git hooks SKIP=...) pour désactiver temporairement
// sans retirer le câblage settings.json. DISTINCT de "showNotification" (qui ne
// coupe QUE le message visible) — les 2 réglages sont indépendants et composables :
// enabled:false + showNotification:true = incohérent mais inoffensif (rien à notifier).
// ON par défaut — SEULE la valeur `false` littérale désactive (fail-open).
function isFrameworkEnabled(config) {
  return config.enabled !== false;
}

// Interrupteur de la NOTIFICATION VISIBLE uniquement (config.json → "showNotification").
// ⚠️ NE COUPE JAMAIS l'injection elle-même (additionalContext) — seulement le
// systemMessage user-only qui l'accompagne. Couper l'injection entière n'aurait
// aucun sens (c'est la seule raison d'être du framework) ; ce réglage sert
// uniquement à l'utilisateur qui préfère ne PAS voir le badge "📄 [ctxroute]"
// à chaque injection tout en gardant le bénéfice réel (contexte livré à l'agent).
// ON par défaut — SEULE la valeur `false` littérale désactive la notification
// (fail-open : une config cassée ne doit jamais désactiver silencieusement
// la transparence envers l'utilisateur).
function shouldShowNotification(config) {
  return config.showNotification !== false;
}

// Formatte le systemMessage USER-ONLY affiché quand une injection a lieu.
// ⚠️ Préfixe "[ctxroute]" EXPLICITE pour que l'utilisateur distingue
// cette source des autres systèmes de doc injectable (ex: protect-files.js
// affiche juste "📄 doc: xxx" sans préciser sa provenance — ambigu si les
// deux systèmes tournent dans la même session, cf incident 15/07/2026 où
// le mainteneur a confondu les deux sources).
// `levels` = tableau des labels de niveau injectés cette fois (ex: ["server"],
// ["server","tool"], ["server","tool","subTool"]) — rend visible la granularité
// réelle, pas juste "un truc a été injecté pour ce serveur".
function formatSystemMessage(server, levels) {
  const suffix = Array.isArray(levels) && levels.length > 1 ? ` (${levels.slice(1).join('+')})` : '';
  return `📄 [ctxroute] ${server}${suffix}`;
}

// Le serveur est-il couvert par le framework selon filterMode/filterList ?
// ⚠️ "whitelist" et "blacklist" sont symétriques : whitelist = liste des SEULS
// autorisés, blacklist = liste des SEULS exclus. "none"/valeur inconnue = tout couvert
// (fail-open : une config cassée ne doit jamais silencieusement tout désactiver).
function isServerActive(config, server) {
  const filterMode = config.filterMode; // ⚠️ pas de défaut 'none' : toute valeur ≠ whitelist/blacklist tombe déjà sur `return true` plus bas — un défaut explicite serait un mutant équivalent (jamais comparé à 'none' lui-même).
  const list = Array.isArray(config.filterList) ? config.filterList : [];
  if (filterMode === 'whitelist') return list.includes(server);
  if (filterMode === 'blacklist') return !list.includes(server);
  return true;
}

// Décide s'il faut (ré)injecter pour CE serveur, à partir de son état AVANT
// cet appel (entrySeen/sinceLastCall non affectés par l'appel courant).
// Pure : ne lit/écrit aucun état, se contente de trancher.
function shouldInjectFor(mode, entrySeen, sinceLastCall, threshold) {
  if (mode === 'dumb') return true;
  if (!entrySeen) return true; // 1er appel du serveur, tous modes
  if (mode === 'smart') return sinceLastCall >= threshold;
  return false; // "once" déjà vu = jamais
}

// Calcule les chemins RELATIFS (sous docs/mcp/) des docs candidates pour cet
// appel précis, du plus GLOBAL au plus SPÉCIFIQUE — AUCUNE lecture disque ici,
// juste le calcul des chemins. Le caller (I/O) filtre ceux qui existent vraiment.
//   1. {server}.md
//   2. {server}/{tool}.md       (suffixe outil, si présent)
//   3. {server}/{subTool}.md    (paramètre sous-outil, si configuré ET présent)
// ⚠️ Dédoublonne le niveau 3 si subTool === suffix (sinon double lecture du même fichier).
// ⚠️ Chaque candidat porte un `level` ("server"/"tool"/"subTool") — permet à
// l'appelant (I/O) de composer un systemMessage qui montre la granularité
// RÉELLEMENT injectée (pas juste "un truc a été injecté"), cf formatSystemMessage().
function docCandidatePaths(config, server, toolName, toolInput) {
  // ⚠️ DEFENSE-IN-DEPTH : `server` arrive normalement de serverName() (déjà
  // restrictif), mais cette fonction est publique — un futur appelant pourrait
  // lui passer un nom non validé. Zéro candidat plutôt qu'un chemin hors
  // docs/mcp/. NE JAMAIS retirer en se disant "l'appelant a déjà validé" :
  // c'est exactement l'hypothèse qui a créé le trou trouvé le 15/07/2026.
  if (!isSafePathSegment(server)) return [];

  const candidates = [{ relPath: `${server}.md`, sourceLabel: `docs/mcp/${server}.md`, level: 'server' }];

  // ⚠️ isSafePathSegment OBLIGATOIRE sur suffix ET subTool : tous deux
  // finissent en composant de chemin lu sur disque puis injecté dans le
  // contexte de l'agent. Cf isSafePathSegment() pour la classe de risque.
  const rawSuffix = toolSuffix(toolName, server);
  const suffix = isSafePathSegment(rawSuffix) ? rawSuffix : null;
  if (suffix) {
    candidates.push({
      relPath: `${server}/${suffix}.md`,
      sourceLabel: `docs/mcp/${server}/${suffix}.md`,
      level: 'tool',
    });
  }

  // ⚠️ Pas de garde `if (subToolParam)` avant l'appel : getByPath() est déjà
  // sûre sur une entrée falsy (typeof dottedPath !== 'string' → null immédiat).
  // Une garde redondante ici serait un mutant équivalent (même résultat avec/sans).
  const subToolParam = config.servers && config.servers[server] && config.servers[server].subToolParam;
  const subTool = getByPath(toolInput, subToolParam);
  if (isSafePathSegment(subTool) && subTool !== suffix) {
    candidates.push({
      relPath: `${server}/${subTool}.md`,
      sourceLabel: `docs/mcp/${server}/${subTool}.md`,
      level: 'subTool',
    });
  }

  return candidates;
}

/**
 * Lit `--paquet k` / `--paquets N` dans une ligne de commande.
 *
 * ⚠️ PUR et PARTAGÉ par les coquilles : le multi-trames se DÉCLARE en
 *    configuration (le même script déclaré N fois avec un indice différent),
 *    jamais en code. Tous les harnais savent faire ça — c'est ce qui garde le
 *    mécanisme portable. Dupliquer ce parsing dans chaque coquille rouvrirait
 *    la dérive que le repo combat (et jscpd le dirait).
 * ⚠️ Valeur absente/absurde ⇒ `{ paquet: 1, nbPaquets: 1 }` = trame unique =
 *    comportement d'aujourd'hui. Une déclaration mal écrite DÉGRADE, elle ne
 *    casse jamais l'injection.
 */
function parsePaquetArgs(argv) {
  // ⚠️ Repli IMMÉDIAT sur entrée non-tableau (et non un `: []` de secours) :
  //    un tableau de secours ne sert qu'à `indexOf`, qui rendrait -1 de toute
  //    façon ⇒ la branche serait INDISTINGUABLE, donc un mutant équivalent.
  if (!Array.isArray(argv)) return { paquet: 1, nbPaquets: 1 };
  const nombre = (nom) => {
    const i = argv.indexOf(nom);
    // ⚠️ Drapeau ABSENT ⇒ 1. Sans cette sortie, `argv[i + 1]` lirait `argv[0]`
    //    (i = -1) : une ligne de commande contenant un nombre nu serait prise
    //    pour une déclaration de paquets. Bug réel, trouvé par mutation.
    if (i < 0) return 1;
    const v = Number(argv[i + 1]);
    // ⚠️ `Math.max` et NON `v >= 1 ? v : 1` : à v = 1 les deux branches du
    //    ternaire rendent la même chose, ce qui rend le comparateur INTUABLE
    //    (mutant équivalent). Le clamp exprime la même règle, testable.
    return Number.isInteger(v) ? Math.max(1, v) : 1;
  };
  const nbPaquets = nombre('--paquets');
  const paquet = nombre('--paquet');
  // ⚠️ Un indice hors bornes ne doit JAMAIS émettre le paquet d'un autre :
  //    on retombe sur la trame unique, jamais sur un contenu faux.
  if (paquet > nbPaquets) return { paquet: 1, nbPaquets: 1 };
  return { paquet, nbPaquets };
}

/**
 * BUDGET DÉCLARÉ PAR LE CÂBLAGE — `--budget N`, à côté de l'`additionalContextLimit`
 * du MÊME bloc de `requirements.toml`. Scellé par `budget-declare-gate.test.js`,
 * qui exige que les deux chiffres soient ÉGAUX.
 *
 * ⚠️ SÉMANTIQUE REPRISE MOT POUR MOT DE CODEX — mesurée dans le binaire 0.146.0 :
 *    *« Configured `additionalContext` spill threshold. `null` uses 2,500 tokens;
 *    `0` disables spilling. »* Donc **`0` = AUCUNE limite**, et c'est ce que notre
 *    câblage déclare. Reprendre LEUR convention plutôt qu'en inventer une :
 *    deux conventions pour un même chiffre, c'est la divergence garantie.
 *
 * ⚠️ POURQUOI EN ARGUMENT ET PAS EN DUR NI LU AU RUNTIME. En dur = une 2ᵉ source
 *    de vérité qui dérive dès que le câblage change (le défaut EXACT qu'on
 *    corrige : la limite valait 0 depuis le 04/08 et le moteur supposait 8 000,
 *    donc un skill partait en 7 morceaux pour rien, en silence, tout vert). Lu au
 *    runtime = une I/O de plus à CHAQUE appel d'outil, sur un chemin fail-open.
 *    L'argument fait voyager le chiffre AVEC la déclaration — même motif que
 *    `--paquet k --paquets N` côté Claude Code, rien de neuf.
 *
 * ⚠️ ABSENT = comportement d'AVANT à l'octet (plancher framework). Un câblage
 *    ancien n'est jamais cassé par cette évolution.
 * ⚠️ NE JAMAIS écrire ici une valeur de harnais en dur : c'est le câblage qui
 *    parle, ce fichier ne fait que le transmettre.
 */
function budgetDeclare(argv) {
  const i = argv.indexOf('--budget');
  // ⚠️ `i === -1` EST NÉCESSAIRE et n'est PAS une garde de confort : sans elle,
  //    `argv[i + 1]` vaudrait `argv[0]` — donc un premier argument NUMÉRIQUE
  //    serait lu comme un budget alors qu'aucun `--budget` n'a été déclaré.
  //    Ça ne se voit pas avec un argv réel (argv[0] = chemin de node), d'où un
  //    test dédié qui rend le cas OBSERVABLE : sans lui, 7 mutants survivaient
  //    ici, et la garde ne prouvait rien.
  // ⚠️ La borne `i + 1 >= argv.length` a été RETIRÉE (05/08/2026) : elle était
  //    REDONDANTE — `argv[i + 1]` vaut alors `undefined`, `Number(undefined)`
  //    vaut `NaN`, et `Number.isInteger` le rejette déjà. On ÉLIMINE une
  //    équivalence par construction, on ne la désactive JAMAIS avec un
  //    commentaire Stryker.
  if (i === -1) return undefined;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 0) return undefined; // valeur illisible = plancher
  return n === 0 ? Infinity : n;
}

module.exports = {
  budgetDeclare,
  parsePaquetArgs,
  sanitizeSessionId,
  scopeId,
  serverName,
  toolSuffix,
  isSafePathSegment,
  getByPath,
  thresholdFor,
  modeFor,
  isServerActive,
  isFrameworkEnabled,
  shouldShowNotification,
  formatSystemMessage,
  shouldInjectFor,
  docCandidatePaths,
};
