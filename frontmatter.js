// ═══════════════════════════════════════════════════════════════════════
// PARSER DE FRONTMATTER — PUR. Le doc déclare son propre déclencheur.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ZÉRO I/O (comme lib-pure.js / sources/file.js). L'appelant lit le fichier.
//
// POURQUOI CE FICHIER EXISTE : avant lui, une règle vivait dans protected-paths.json
// et son contenu dans un .md — 2 choses à synchroniser, donc 2 façons de dériver
// EN SILENCE : doc sans règle = jamais injectée ; règle sans doc = morte.
// Avec le frontmatter il n'y a plus deux choses. Ces bugs n'existent plus,
// ils ne sont pas « attrapés ».
//
// ⚠️ SOUS-ENSEMBLE DE YAML DÉLIBÉRÉ — PAS un parser YAML, et n'en deviendra JAMAIS un.
//    Supporté : `cle: valeur`, `cle: [a, b]`, `cle: true|false|nombre`.
//    YAML complet = ancres, refs, types implicites, `norway problem` (`no` → false),
//    surface d'attaque et dépendance externe. On lit 5 champs connus, pas un langage.
//    Vouloir « juste ajouter le multi-ligne » = la première marche vers un parser YAML.
//
// ⚠️ TOTALITÉ OBLIGATOIRE : ne DOIT JAMAIS throw, quel que soit l'octet reçu.
//    Un parser qui throw sur une doc malformée fait planter le hook → plus AUCUNE
//    doc injectée nulle part (un mauvais .md casserait tout le système).
//    Fail-open : frontmatter illisible = pas de déclaration = doc inerte, jamais un crash.
//    Scellé par property-based (frontmatter.property.test.js) : totalité sur input généré.
// ═══════════════════════════════════════════════════════════════════════

// Délimiteur : `---` seul sur sa ligne, en TOUT DÉBUT de fichier.
// ⚠️ Accepte le BOM UTF-8 et CRLF (Windows) — sinon 100% des docs éditées sous
//    Windows seraient silencieusement sans frontmatter. Piège réel, pas théorique.
const FM_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function parseScalar(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  // ⚠️ Nombre SEULEMENT si la chaîne entière est un nombre — sinon "12-factor"
  //    deviendrait 12. Number() seul accepte trop (espaces, '', hex).
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // Guillemets optionnels, retirés s'ils enveloppent toute la valeur.
  const m = /^(['"])([\s\S]*)\1$/.exec(v);
  return m ? m[2] : v;
}

function parseList(inner) {
  // `[a, b]` — liste inline uniquement (le format des scope/exclude existants).
  return inner
    .split(',')
    .map((s) => parseScalar(s))
    .filter((s) => s !== '');
}

/**
 * @param {string} text - contenu brut d'un .md
 * @returns {{ data: object, body: string, hasFrontmatter: boolean }}
 *
 * ⚠️ `body` = le .md SANS le frontmatter : c'est lui qui part dans le contexte
 *    de l'agent. Injecter le frontmatter serait du bruit réinjecté à chaque
 *    accès (exactement ce que la règle Documentation interdit).
 */
function parse(text) {
  if (typeof text !== 'string') return { data: {}, body: '', hasFrontmatter: false };

  const m = FM_RE.exec(text);
  if (!m) return { data: {}, body: text, hasFrontmatter: false };

  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    // ⚠️ PAS de garde « ignorer commentaires/lignes vides » : elle serait REDONDANTE.
    //    La regex ci-dessous exige `[A-Za-z0-9_-]+` en tête — un `#` ou une ligne vide
    //    ne matchent JAMAIS, donc sont déjà ignorés. Ajouter la garde = 3 mutants
    //    ÉQUIVALENTS indétectables (doctrine : éviter par construction, pas tester).
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*([\s\S]*)$/.exec(line);
    if (!kv) continue; // ⚠️ ligne non conforme = IGNORÉE, jamais un throw (totalité).
    const key = kv[1];
    // ⚠️ PAS de .trim() ici : `parseScalar` trim déjà → redondant = mutant équivalent.
    const raw = kv[2];
    // ⚠️ `rules` = JSON inline, AVANT le chemin liste : parseList couperait le JSON
    //    sur ses virgules internes. JSON.parse est TOTAL ici (try/catch) — un JSON
    //    cassé laisse la valeur BRUTE (string) → `validate` la met en ROUGE, jamais un throw.
    //    JSON ≠ mini-langage maison : c'est le format d'ORIGINE des règles migrées.
    if (key === 'rules') {
      try {
        data[key] = JSON.parse(raw);
      } catch (e) {
        data[key] = parseScalar(raw);
      }
      continue;
    }
    const list = /^\[([\s\S]*)\]$/.exec(raw);
    data[key] = list ? parseList(list[1]) : parseScalar(raw);
  }

  return { data, body: text.slice(m[0].length), hasFrontmatter: true };
}

/**
 * Valide une déclaration. ⚠️ GATE : un frontmatter invalide DOIT être ROUGE.
 * Sans ça, un `match:` mal orthographié = doc silencieuse — le bug d'aujourd'hui,
 * juste déguisé en nouveau format. C'est la raison d'être du refactor.
 *
 * @returns {string[]} erreurs (vide = valide)
 */
const MODES = ['dumb', 'once', 'smart'];
// ⚠️ `driftUnit` (18/07/2026) : l'UNITÉ du compteur `smart` — `tool` (appels
//    d'outils, défaut framework) ou `turn` (tours de conversation, compteur
//    alimenté par la porte turn-count.js sur UserPromptSubmit). SOURCE UNIQUE
//    du vocabulaire (comme MODES) : gate.js, sources/mcp.js et sources/skill.js
//    importent d'ICI — jamais une 2ᵉ liste. Dégénéré hors de smart (dumb=0,
//    once=∞ : l'unité d'un tick n'y change rien). Cascade 3 étages identique à
//    mode/threshold : entrée > global (defaultDriftUnit / skillDefaults) > 'tool'.
const DRIFT_UNITS = ['tool', 'turn'];
// ⚠️ `threshold` (17/07/2026) : seuil smart PAR DOC — l'auteur propose, la config
//    dispose (même philosophie que `mode`). Lu par gate.thresholdForDoc (fichier)
//    et sources/mcp.declFor (MCP). Entier ≥ 1 : un seuil 0 = réinjection
//    permanente déguisée (c'est le rôle de `mode: dumb`, pas d'un seuil).
// ⚠️ `note` (04/08/2026) — LE SEUL CHAMP QUE LE MOTEUR NE LIT JAMAIS.
//    Destinataire = l'agent (ou l'humain) qui vient MODIFIER cette doc, pas
//    celui qui agit : « pourquoi ce `mode`, pourquoi ce `scope`, à re-vérifier
//    après telle version ». Il est invisible à l'injection PAR CONSTRUCTION —
//    le frontmatter entier est retiré du corps émis (scellé par un test dédié,
//    jamais par la seule bonne volonté).
//
// 🛑 BORNE, à ne JAMAIS franchir : `note` ne porte QUE du méta sur le RÉGLAGE.
//    JAMAIS le POURQUOI D'UN INVARIANT — celui-là doit rester dans le corps,
//    visible de l'agent qui agit : un invariant privé de sa raison DÉRIVE (le
//    suivant ne voit pas ce qu'il casse et le contourne). Le risque n'est pas
//    technique, il est GRAVITATIONNEL : dès qu'une zone invisible existe, le
//    « pourquoi » y migre parce qu'il est long et « encombre ». Décision
//    mainteneur du 03/08/2026, conservée telle quelle.
//
// ⚠️ Le moteur ne DOIT jamais en dépendre : aucune décision, aucun matching,
//    aucun tri. Le jour où une source la lirait, ce serait un champ de config
//    déguisé en commentaire — donc une 2ᵉ vérité.
const KNOWN = ['match', 'mcp', 'rules', 'tool', 'inject', 'scope', 'exclude', 'mode', 'confirm', 'rank', 'threshold', 'driftUnit', 'note', 'enforce'];

// ⚠️ `inject: never` — LE SILENCE DEVIENT UNE DÉCLARATION, jamais un oubli.
//    MESURÉ le 15/07/2026 : 14 docs sur 306 ne sont visées par AUCUNE règle.
//    La PLUPART sont volontaires (doctrine : `*-reference.md` en on-demand,
//    pattern `route.ts` trop générique → pas de pattern). MAIS une doc
//    volontairement muette et une doc dont le pattern a été OUBLIÉ sont
//    RIGOUREUSEMENT indiscernables : deux fichiers silencieux.
//    Avec cette clé, `never` = décidé (vert) et rien = oublié (ROUGE).
//    ⚠️ SEULE valeur admise : `never`. Pas de `always`/`auto` — ce serait une
//    2ᵉ façon de dire ce que `match:`/`mcp:` disent déjà (deux vérités = dérive).
const INJECT = ['never'];

// ⚠️ DÉCLENCHEURS DU CORPUS FICHIER — SÉMANTIQUES DISJOINTES, NE JAMAIS FUSIONNER.
//    `match:` → substring sur le CHEMIN (`chemin.includes(pattern)`).
//    `rules:` → idem mais PAR ENTRÉE (scopes divergents).
//    `tool:`  → nom EXACT d'un OUTIL natif (===), jamais un substring.
//
//    ⚠️ Le canal MCP N'A PAS de clé ici : une doc MCP se déclenche par son
//    CHEMIN (`docs/mcp/{serveur}.md`) et se valide par `validateMcp`. `mcp:` a
//    été RETIRÉ des déclencheurs le 31/07/2026 (§A) — il était accepté et
//    inerte, donc il certifiait des docs muettes.
//    ⚠️ Une clé de matching UNIQUE serait AMBIGUË : `match: stripe` = le fichier
//    `stripe-config.js` OU le serveur MCP `stripe` ? Les deux → la doc MCP
//    partirait en éditant un fichier. Fusionner les MOTEURS ≠ fusionner les
//    SÉMANTIQUES. Chaque source lit SA clé. Cf REFACTOR-PLAN.md, décision 7.
// ⚠️ `rules:` = 3ᵉ déclencheur, source FICHIER comme `match:`, mais PAR-ENTRÉE :
//    liste JSON inline d'objets {pattern, scope?, exclude?}. Existe parce que
//    MESURÉ (16/07/2026) : 31 docs sur 103 multi-règles ont des scopes/excludes
//    DIVERGENTS entre leurs règles — irreprésentables avec UN scope par doc.
//    `rules` + (`match`/`scope`/`exclude`) = CONTRADICTION (deux vérités = dérive).
// ⚠️ `tool:` = 4ᵉ déclencheur (19/07/2026) : nom EXACT d'un OUTIL NATIF du
//    harnais (WebFetch, WebSearch…) — l'angle mort mesuré des outils sans
//    chemin ni préfixe mcp__. Sémantique DISJOINTE (=== sur tool_name, jamais
//    substring) : cf sources/tool.js. Chaîne ou liste, même shape que `match`.
// ⚠️ `mcp` N'EST PAS UN DÉCLENCHEUR — retiré le 31/07/2026 (REFACTOR-PLAN §A).
//    Il y figurait par héritage d'une époque où l'on imaginait déclencher le
//    canal MCP par frontmatter. Ce n'est PAS ce qui a été construit : une doc
//    MCP se déclenche par son CHEMIN (`docs/mcp/{serveur}.md`) et se valide par
//    `validateMcp` (qui n'admet que mode/threshold/driftUnit).
//    ⚠️ CONSÉQUENCE MESURÉE avant retrait : `validate()` répondait 0 ERREUR sur
//    une doc du corpus FICHIER portant `mcp:` — clé CONNUE, donc acceptée, et
//    pourtant consommée par AUCUNE source ⇒ doc MUETTE, validateur content.
//    C'est PIRE qu'une typo (`mach:` = rejeté) : un validateur qui approuve du
//    mort n'est pas neutre, il oriente activement vers la mauvaise cause (le
//    31/07 il a fait accuser le MOTEUR de ne pas lire les commandes).
//    ⚠️ Vérifié avant retrait : 0 doc du parc (344) portait `mcp:` — aucun
//    comportement existant changé. Scellé par `triggers-gate.test.js` : tout
//    déclencheur de cette liste DOIT être prouvé consommé par une source réelle.
const DECLENCHEURS = ['match', 'rules', 'tool'];

// ⚠️ `*` = JOKER de l'axe OUTIL (31/07/2026, §B/§B0). VALEUR spéciale, PAS un
//    opérateur : la base booléenne reste FERMÉE (aucun mot ajouté).
//    SOURCE UNIQUE du symbole (comme MODES/DRIFT_UNITS) — `sources/tool.js`
//    l'importe d'ICI. Deux littéraux '*' = deux vérités qui divergent.
const WILDCARD = '*';

// ⚠️ LECTURE de la déclaration `tool:` (chaîne OU liste) — c'est du PARSING,
//    donc sa place est ICI, pas dans la source qui matche. `sources/tool.js`
//    l'importe : deux lectures de la même clé finiraient par diverger (un jour
//    l'une accepterait un cas que l'autre refuse, en silence).
function toolList(data) {
  if (typeof data.tool === 'string') return [data.tool];
  return Array.isArray(data.tool) ? data.tool : [];
}

// ⚠️ `match` accepte une CHAÎNE **ou** UNE LISTE — pas un caprice de souplesse :
//    mesuré le 15/07/2026, 98 des 288 docs réelles sont visées par PLUSIEURS patterns
//    (une même doc, plusieurs fichiers). N'accepter qu'une chaîne rejetterait un
//    tiers du parc. Vérifié sur les vraies règles, jamais supposé.
function isMatchDecl(v) {
  if (typeof v === 'string') return v.trim() !== '';
  return Array.isArray(v) && v.length > 0 && v.every((p) => typeof p === 'string' && p.trim() !== '');
}

// ⚠️ `Stryker disable StringLiteral` sur TOUT le corps : les libellés d'erreur sont
//    de la COMMUNICATION, pas du comportement — `validate` rend une liste non vide
//    quel que soit le texte. Les muter produit des mutants ÉQUIVALENTS que seul un
//    test couplé au libellé exact tuerait (fragile : casse au moindre reformulage).
//    ⚠️ NE JAMAIS étendre ce disable au-delà des StringLiteral : la LOGIQUE de
//    validation, elle, DOIT rester mutée (c'est le gate qui décide si une doc vit).
// Stryker disable StringLiteral
// ⚠️ Une entrée `rules` = {pattern, scope?, exclude?} et RIEN d'autre — clé inconnue
//    dans une entrée = ROUGE (un `patern:` silencieux = règle morte, le bug qu'on tue).
// ⚠️ `rank` PAR ENTRÉE : nécessaire aux docs ENTRELACÉES (mesuré 16/07/2026 : 23 docs
//    dont les règles sont dispersées dans le JSON entre celles d'AUTRES docs — un rank
//    de groupe inverserait l'ordre d'évaluation, 1 divergence réelle attrapée par le
//    différentiel loader). Chaque règle garde son index JSON exact.
const RULE_KEYS = ['pattern', 'scope', 'exclude', 'rank'];
function isRulesDecl(rules) {
  const errs = [];
  if (!Array.isArray(rules) || rules.length === 0) {
    // ⚠️ Message AUTO-RÉPARANT (paved-road) : rend le format CANONIQUE prêt à coller —
    //    le piège n°1 est d'écrire `rules:` en YAML-bloc (`- pattern:`) au lieu du JSON
    //    inline. Descriptif ne suffit pas : donner l'exemple exact à copier (vécu 19/07).
    errs.push('`rules` doit être une liste JSON INLINE non vide. Copie ce format : rules: [{"pattern":"foo.js"},{"pattern":"bar.js","scope":["projet"]}]  (PAS de YAML-bloc `- pattern:`)');
    return errs;
  }
  rules.forEach((r, i) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      errs.push(`\`rules[${i}]\` doit être un objet {pattern, scope?, exclude?}`);
      return;
    }
    if (typeof r.pattern !== 'string' || r.pattern.trim() === '') {
      errs.push(`\`rules[${i}].pattern\` manquant ou vide — la règle ne matcherait JAMAIS`);
    }
    for (const k of ['scope', 'exclude']) {
      if (k in r && !(Array.isArray(r[k]) && r[k].every((s) => typeof s === 'string' && s.trim() !== ''))) {
        errs.push(`\`rules[${i}].${k}\` doit être une liste de chaînes non vides`);
      }
    }
    if ('rank' in r && typeof r.rank !== 'number') {
      errs.push(`\`rules[${i}].rank\` doit être un nombre`);
    }
    for (const k of Object.keys(r)) {
      if (!RULE_KEYS.includes(k)) errs.push(`\`rules[${i}]\` : clé inconnue \`${k}\` (connues: ${RULE_KEYS.join(', ')})`);
    }
  });
  return errs;
}

function validate(data) {
  const errs = [];

  // ⚠️ « AU MOINS UN déclencheur », JAMAIS « `match` obligatoire » : une doc MCP
  //    (docs/mcp/stripe.md) n'a AUCUN fichier à matcher — exiger `match` la
  //    rejetterait. Symétriquement une doc fichier n'a pas de `mcp`.
  //    ⚠️ MAIS zéro déclencheur DOIT rester ROUGE : c'est LA raison d'être du
  //    refactor (une doc sans déclencheur = doc morte en silence, le bug qu'on tue).
  const declares = DECLENCHEURS.filter((k) => k in data);
  const silenceDeclare = data.inject === 'never';
  // ⚠️ `mcp:` dans une doc du corpus FICHIER = DÉCLENCHEUR INERTE (§A) : message
  //    DÉDIÉ qui dit OÙ la doc aurait dû aller, jamais un « clé inconnue » sec.
  //    Un validateur qui refuse doit rendre l'auteur autonome (paved road) —
  //    sinon il déplace le temps perdu au lieu de le supprimer.
  const mcpInerte = 'mcp' in data;
  if (mcpInerte) {
    errs.push('`mcp:` ne déclenche RIEN ici : une doc MCP se déclenche par son CHEMIN (`docs/mcp/{serveur}.md`), jamais par une clé de frontmatter. Déplace le fichier, et garde dedans uniquement mode/threshold/driftUnit.');
  }
  // ⚠️ `!mcpInerte` : le message dédié ci-dessus suffit — empiler « aucun
  //    déclencheur » par-dessus noierait la seule ligne utile.
  if (declares.length === 0 && !silenceDeclare && !mcpInerte) {
    // ⚠️ Ce message ne DOIT PLUS conseiller `mcp` (corrigé 31/07/2026) : la clé
    //    est désormais REJETÉE (§A). Conseiller une clé interdite envoie l'auteur
    //    droit dans le mur suivant — un validateur doit rendre autonome, sinon il
    //    déplace le temps perdu au lieu de le supprimer. Scellé par un test.
    errs.push('aucun déclencheur : il faut `match` (chemin), `rules` (chemins par-entrée) et/ou `tool` (nom exact d\'un outil) — sans lui la doc ne sera JAMAIS injectée. Une doc MCP, elle, se déclenche par son CHEMIN (`docs/mcp/{serveur}.md`), pas par une clé. Si le silence est VOULU (doc de référence), déclare-le : `inject: never`.');
  }
  for (const k of declares) {
    if (k === 'rules') continue; // validé par isRulesDecl ci-dessous (structure par-entrée)
    if (!isMatchDecl(data[k])) {
      errs.push(`\`${k}\` vide ou mal typé (chaîne ou liste non vide) — sans lui la doc ne sera JAMAIS injectée`);
    }
  }
  // ⚠️ JOKER NU = REFUSÉ (31/07/2026, §B). `tool: ["*"]` SANS `scope` ni
  //    `exclude` injecterait la doc à CHAQUE appel d'outil de CHAQUE agent —
  //    du bruit permanent, et un système qui injecte à tort finit ignoré.
  //    Le joker existe pour dire « quel que soit l'outil, QUAND ceci » : le
  //    filtre n'est pas un confort, c'est la moitié de l'expression.
  //    ⚠️ Une doc à injecter vraiment partout a déjà son canal : `docs/session/`.
  if ('tool' in data && toolList(data).includes(WILDCARD)) {
    const aScope = Array.isArray(data.scope) && data.scope.length > 0;
    const aExclude = Array.isArray(data.exclude) && data.exclude.length > 0;
    if (!aScope && !aExclude) {
      errs.push('`tool: ["*"]` sans `scope` ni `exclude` : la doc serait injectée à CHAQUE appel d\'outil. Ajoute `scope` (ce que fait la commande) ou `exclude` (les outils à écarter). Pour une doc vraiment universelle, utilise `docs/session/`.');
    }
  }
  // ⚠️ `rules` : validation STRUCTURELLE par-entrée. Une entrée bancale (pattern
  //    absent, clé inconnue, scope non-liste) = doc morte ou sur-match en silence —
  //    même classe de bug que `mach:`. ROUGE, jamais toléré.
  if ('rules' in data) {
    for (const e of isRulesDecl(data.rules)) errs.push(e);
    for (const k of ['match', 'scope', 'exclude']) {
      if (k in data) {
        errs.push(`\`rules\` contredit \`${k}\` — les règles par-entrée portent DÉJÀ pattern/scope/exclude, deux vérités = dérive`);
      }
    }
  }
  // ⚠️ `inject: never` + un déclencheur = CONTRADICTION, pas une précédence à
  //    inventer. Deviner qui gagne serait remettre de l'implicite là où cette
  //    clé existe pour l'enlever. L'auteur tranche, la machine refuse.
  if (silenceDeclare && declares.length > 0) {
    errs.push('`inject: never` contredit `' + declares.join('`/`') + '` — une doc est déclenchée OU volontairement muette, jamais les deux');
  }
  if ('inject' in data && !INJECT.includes(data.inject)) {
    errs.push(`\`inject\` invalide: ${data.inject} (seule valeur admise: ${INJECT.join('|')})`);
  }
  for (const k of ['scope', 'exclude']) {
    if (k in data && !Array.isArray(data[k])) errs.push(`\`${k}\` doit être une liste [a, b]`);
  }
  for (const e of cadenceErrors(data)) errs.push(e);
  for (const e of noteErrors(data)) errs.push(e);
  if ('confirm' in data && typeof data.confirm !== 'boolean') {
    errs.push('`confirm` doit être true ou false');
  }
  if ('rank' in data && typeof data.rank !== 'number') errs.push('`rank` doit être un nombre');
  // ⚠️ Clé inconnue = ERREUR, jamais ignorée en silence : `mach:` au lieu de `match:`
  //    passerait sinon inaperçu et la doc serait morte sans que personne ne le sache.
  for (const k of Object.keys(data)) {
    if (!KNOWN.includes(k)) errs.push(`clé inconnue: \`${k}\` (connues: ${KNOWN.join(', ')})`);
  }
  return errs;
}
// Stryker restore StringLiteral

// ⚠️ SEULE autorité sur « frontmatter de doc MCP sain ? » (docs/mcp/*.md) —
//    partagée par config-gate.test.js (gate repo) ET doc-write-guard.js
//    (feedback temps réel). Deux copies de ce jugement = divergence garantie.
//    Une doc MCP est déclenchée par son CHEMIN : seules mode/threshold ont un sens.
// Stryker disable StringLiteral: libellés = communication (cf validate).
function validateMcp(data) {
  // ⚠️ Const LOCALE (pas module-level) : un tableau au niveau module = mutant
  //    STATIQUE hors du mapping perTest → survivant garanti. Ici, couvert.
  const MCP_KEYS = ['mode', 'threshold', 'driftUnit', 'note', 'enforce'];
  const errs = [];
  for (const k of Object.keys(data)) {
    if (!MCP_KEYS.includes(k)) errs.push(`clé inconnue pour une doc MCP: \`${k}\` (admises: ${MCP_KEYS.join(', ')})`);
  }
  for (const e of cadenceErrors(data)) errs.push(e);
  for (const e of noteErrors(data)) errs.push(e);
  return errs;
}
// Stryker restore StringLiteral

// ⚠️ SOURCE UNIQUE du jugement de CADENCE (mode/threshold/driftUnit) — partagée
//    par validate (docs fichier) ET validateMcp (docs MCP). Extraite le
//    18/07/2026 sur signal jscpd : deux copies de ce jugement = divergence
//    garantie (la classe de bug que ce repo tue).
// Stryker disable StringLiteral: libellés = communication (cf validate).
// ⚠️ `note` = commentaire d'AUTEUR, jamais du contrôle. Validé sur la FORME
//    seulement (texte, ou liste de textes pour plusieurs remarques) : en valider
//    le CONTENU reviendrait à lui donner un sens, donc à en faire de la config.
// ⚠️ PIÈGE CONNU, NON SCELLÉ — BLOCS YAML MULTI-LIGNES (`|`, `>`).
//    `note: |` suivi de lignes indentées donne `note === "|"` et PERD ces lignes
//    en silence (le parser ignore toute ligne non conforme — c'est sa totalité).
//    Trouvé le 04/08/2026 par simulation adversariale.
//
// 🛑 UNE GARDE A ÉTÉ TENTÉE ICI PUIS RETIRÉE LE MÊME JOUR — ne pas la refaire
//    telle quelle. Elle rejetait toute valeur égale à `|`, et la CI (property-test
//    `migrate.property`, ROUND-TRIP) l'a mise en ROUGE en quelques minutes :
//    `match: "|"` est un pattern LÉGITIME. À CETTE COUCHE, `cle: |` (bloc) et
//    `cle: "|"` (pipe littéral) sont RIGOUREUSEMENT indistinguables — les deux
//    valent la chaîne `"|"`. Une garde qui ne peut pas distinguer interdit du sain.
//
// ⚠️ LE FIX CORRECT vit dans `parse()`, seul endroit qui voit le TEXTE : un bloc
//    réel = valeur `|`/`>` ET ligne suivante indentée. Tant qu'il n'est pas fait,
//    la forme sûre reste la LISTE INLINE : `note: [ligne un, ligne deux]`.
//    ⚠️ NE JAMAIS « régler » ça en supportant le multi-ligne : ce parser est un
//    sous-ensemble de YAML délibéré (cf en-tête). Rendre le piège BRUYANT, oui ;
//    étendre le langage, jamais. Chantier inscrit au REFACTOR-PLAN.
function noteErrors(data) {
  if (!('note' in data)) return [];
  const v = data.note;
  if (typeof v === 'string') return [];
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return [];
  return ['`note` doit etre un texte, ou une liste de textes'];
}

function cadenceErrors(data) {
  const errs = [];
  if ('mode' in data && !MODES.includes(data.mode)) {
    errs.push(`\`mode\` invalide: ${data.mode} (attendu: ${MODES.join('|')})`);
  }
  if ('threshold' in data && !(Number.isInteger(data.threshold) && data.threshold >= 1)) {
    errs.push(`\`threshold\` doit être un entier >= 1 (recu: ${JSON.stringify(data.threshold)})`);
  }
  if ('driftUnit' in data && !DRIFT_UNITS.includes(data.driftUnit)) {
    errs.push(`\`driftUnit\` invalide: ${data.driftUnit} (attendu: ${DRIFT_UNITS.join('|')})`);
  }
  // ── `enforce` (05/08/2026) : la doc REFUSE l'outil au lieu de l'informer ──
  // ⚠️ BOOLÉEN à TROIS effets, et `false` n'est PAS du bruit : absent = HÉRITE
  //    de l'étage supérieur (defaults.{source}), `false` = ANNULE cet héritage.
  //    Sans valeur explicite, une catégorie passée en `enforce` serait
  //    INDÉSINSCRIPTIBLE — l'impasse classique de tout système à cascade.
  if ('enforce' in data && typeof data.enforce !== 'boolean') {
    errs.push('`enforce` doit être true ou false');
  }
  // ⚠️ `enforce` SUIT LA CADENCE — il n'a PAS de rythme à lui (décision
  //    mainteneur 05/08/2026, et il avait raison contre ma première version).
  //    Le blocage se produit exactement QUAND la doc s'injecte, parce que c'est
  //    la même condition. Et il n'y a PAS de boucle : injecter marque la doc vue
  //    ET remet son compteur à zéro, donc l'appel que l'agent refait juste après
  //    n'a plus rien à livrer et PASSE.
  //      `once`  → bloque une fois par session, puis plus jamais.
  //      `smart` → bloque, repasse aussitôt, puis rebloque une fois après N
  //                appels d'autres outils. Parfaitement cohérent, PAS un piège.
  //
  //      `dumb`  → blocage / passage / blocage / passage… en alternance.
  // ⚠️ AUCUNE combinaison n'est interdite, et ce n'est PAS un oubli : la
  //    garantie anti-boucle vit dans `gate.js` sous forme d'ALTERNANCE (un
  //    blocage n'est jamais suivi d'un blocage), pas sous forme d'interdit.
  //    Une règle d'écriture qui rejetterait `dumb` amputerait le langage sans
  //    rien protéger de plus. NE PAS en réintroduire une.
  return errs;
}
// Stryker restore StringLiteral

module.exports = { parse, validate, validateMcp, isMatchDecl, isRulesDecl, toolList, MODES, DRIFT_UNITS, KNOWN, DECLENCHEURS, INJECT, RULE_KEYS, WILDCARD };
