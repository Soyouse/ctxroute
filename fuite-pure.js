// ═══════════════════════════════════════════════════════════════════════
// FUITE-PURE — décide si un texte contient une donnée PERSONNELLE.
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ RAISON D'ÊTRE : ce dépôt est PUBLIC. Une donnée personnelle poussée
//    ne se retire plus — elle reste dans l'historique, lisible par
//    `git log -p`, même après correction de l'arbre. C'est ARRIVÉ ici
//    (prénom du mainteneur dans 2 commits déjà publiés le 04/08/2026).
//
// ⚠️ CE FICHIER NE CONTIENT AUCUNE DONNÉE PERSONNELLE, PAR CONSTRUCTION.
//    Un gate qui listerait en dur le prénom/l'email à interdire SERAIT
//    LUI-MÊME LA FUITE. Les valeurs viennent donc de l'EXTÉRIEUR :
//    l'environnement (nom d'utilisateur, dossier personnel) et une liste
//    locale GITIGNORÉE. NE JAMAIS écrire ici une chaîne à protéger.
//
// ⚠️ PUR : zéro I/O (gate dependency-cruiser `fuite-pure-must-stay-pure`).
//    La lecture des fichiers vit dans la suite qui l'appelle.
// ═══════════════════════════════════════════════════════════════════════

'use strict';

// Échappe un littéral destiné à une regex. ⚠️ OBLIGATOIRE : un dossier
// personnel contient des `\` et des `.` — non échappés, ils feraient de la
// valeur un JOKER qui matche presque tout (gate hurlant à tort, donc gate
// qu'on finit par débrancher).
function echapper(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Du dossier personnel, on ne garde QUE le dernier segment (le nom du
// dossier utilisateur). ⚠️ NE JAMAIS prendre tous les segments : `C:/Users/x`
// donnerait « Users », mot générique présent dans TOUS les chemins d'exemple
// du dépôt (`C:/Users/dev/...`, la convention documentée) — le gate serait
// rouge en permanence, donc débranché. Mesuré le 04/08/2026 : 6 faux positifs.
function dernierSegment(chemin) {
  const parts = String(chemin).split(/[\\/]+/).filter(Boolean);
  return parts.length === 0 ? '' : parts[parts.length - 1];
}

// ⚠️ Plages de DOCUMENTATION (RFC 5737) + boucle locale : LÉGITIMES dans un
//    dépôt public, ce sont précisément celles que la doctrine impose d'écrire.
const IP_AUTORISEES = /^(203\.0\.113\.|192\.0\.2\.|198\.51\.100\.|127\.|0\.0\.0\.0)/;

// ⚠️ Bloc CGNAT 100.64/10 (plage de Tailscale) : une IP de ce bloc est une
//    MACHINE RÉELLE du parc. Jamais dans un dépôt public.
const IP_CGNAT = /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/;

// ⚠️ `example.` / `test.` sont les domaines RÉSERVÉS à la documentation
//    (RFC 2606) — les seuls emails admis.
const EMAIL_REEL = /[a-z0-9._%+-]+@(?!example\.|test\.)[a-z0-9.-]+\.[a-z]{2,}/i;

// ⚠️ COMPTES SYSTÈME / CI — JAMAIS une identité, TOUJOURS un mot générique.
//    Sur GitHub Actions le compte s'appelle `runner` : dérivé tel quel, il
//    matchait « test runner », « tap-runner », « commandRunner »… → 13 faux
//    positifs et CI ROUGE (mesuré le 04/08/2026, au premier push du gate).
//    Un gate rouge sur du sain finit débranché : ces noms sont donc ÉCARTÉS.
//    Le risque inverse est nul — personne ne s'appelle « root » ou « runner ».
const COMPTES_GENERIQUES = new Set([
  'runner', 'root', 'user', 'users', 'admin', 'administrator', 'build',
  'builder', 'ubuntu', 'vagrant', 'docker', 'jenkins', 'github', 'home',
]);

/**
 * Construit les motifs interdits À PARTIR DE L'EXTÉRIEUR.
 * @param {string} utilisateur - nom de compte OS (jamais écrit en dur)
 * @param {string} dossierPerso - dossier personnel de l'utilisateur
 * @param {string[]} [supplementaires] - termes d'une liste LOCALE gitignorée
 */
function motifsInterdits(utilisateur, dossierPerso, supplementaires) {
  const motifs = [
    { nom: 'email réel', re: EMAIL_REEL },
    { nom: 'IP de machine réelle (CGNAT/Tailscale)', re: IP_CGNAT },
  ];
  const litteraux = [];
  if (typeof utilisateur === 'string' && utilisateur.length >= 3) litteraux.push(utilisateur);
  if (typeof dossierPerso === 'string') {
    const d = dernierSegment(dossierPerso);
    if (d.length >= 3) litteraux.push(d);
  }
  if (Array.isArray(supplementaires)) {
    for (const t of supplementaires) {
      if (typeof t === 'string' && t.length >= 3) litteraux.push(t);
    }
  }
  // Dédup : le compte OS est en général AUSSI le nom du dossier personnel.
  // ⚠️ Le filtre des comptes génériques s'applique aux littéraux DÉRIVÉS DE
  //    L'ENVIRONNEMENT **ET** aux termes déclarés : quelle que soit sa
  //    provenance, « runner » reste un mot, pas une identité.
  for (const l of [...new Set(litteraux)].filter((x) => !COMPTES_GENERIQUES.has(x.toLowerCase()))) {
    // ⚠️ FRONTIÈRES DE MOT, JAMAIS un sous-chaîne : un prénom court est un
    //    sous-mot de mots courants (un prénom court ⊂ un mot courant, mesuré le
    //    04/08/2026 sur 2 fichiers). Un gate qui crie sur du sain cesse
    //    d'être lu — et le jour où il a raison, personne ne le croit.
    //    `\b` s'appuie sur [A-Za-z0-9_] : un accent compte comme séparateur,
    //    ce qui est exactement le comportement voulu ici.
    motifs.push({ nom: 'donnée personnelle : ' + l, re: new RegExp('\\b' + echapper(l) + '\\b', 'i') });
  }
  return motifs;
}

/**
 * Cherche les motifs dans un texte. TOTAL : n'échoue jamais.
 * @returns {{nom:string, extrait:string}[]}
 */
function scanner(texte, motifs) {
  if (typeof texte !== 'string') return [];
  if (!Array.isArray(motifs)) return [];
  const trouves = [];
  for (const m of motifs) {
    const found = texte.match(m.re);
    // ⚠️ Une IP de documentation contient « 203.0.113. » : on ne la signale
    //    PAS. Sans cette porte, la doctrine (« utilise 203.0.113.x ») serait
    //    interdite par son propre gate.
    if (found && !IP_AUTORISEES.test(found[0])) {
      trouves.push({ nom: m.nom, extrait: found[0] });
    }
  }
  return trouves;
}

module.exports = { motifsInterdits, scanner, echapper, dernierSegment, COMPTES_GENERIQUES };
