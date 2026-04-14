import type { UserConfig } from './types/openclaw';

export type SupportedLocale = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'ru';

type MessageKey =
  | 'unknownSubcommand'
  | 'subcommandStatus'
  | 'subcommandEval'
  | 'subcommandReport'
  | 'subcommandDismiss'
  | 'subcommandSnooze'
  | 'statusSummary'
  | 'andMore'
  | 'handleButton'
  | 'viewAll'
  | 'usageEval'
  | 'skillNotFound'
  | 'cannotScan'
  | 'scanFailed'
  | 'securityIssuesDetected'
  | 'qualityIssuesDetected'
  | 'qualityConcernsFound'
  | 'clean'
  | 'fullEval'
  | 'skip'
  | 'quickScanUnavailable'
  | 'skillPortfolio'
  | 'skillsLine'
  | 'totalUses'
  | 'neverEvaluated'
  | 'pendingSuggestions'
  | 'usageDismiss'
  | 'suggestionNotFound'
  | 'dismissedSuggestion'
  | 'dismissFailed'
  | 'usageSnooze'
  | 'snoozedSuggestion'
  | 'snoozeFailed'
  | 'weeklyDigest'
  | 'dismissAll'
  | 'unknown'
  | 'updateAvailable'
  | 'changelog'
  | 'updateRescan'
  | 'viewChangelog'
  | 'securityRisk'
  | 'viewDetails'
  | 'dismiss'
  | 'typeStandalone'
  | 'typePackage'
  | 'typeCollection'
  | 'reasonNeverUsed'
  | 'reasonIdle'
  | 'reasonDeclining'
  | 'reasonUndo2x'
  | 'reasonHeavyNoEval'
  | 'reasonStaleEval'
  | 'reasonDuplicateLoser'
  | 'reasonOneAndDone'
  | 'reasonCheckUpdate'
  | 'reasonClawhubUpdate';

type MessageCatalog = Record<MessageKey, string>;

export interface EvidenceEntry {
  field?: string;
  value?: unknown;
}

export interface SuggestionLike {
  rule_id?: string;
  reason?: string;
  evidence?: EvidenceEntry[] | null;
}

const SUPPORTED_LOCALE_SET = new Set<SupportedLocale>([
  'en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'ru'
]);

const JAPANESE_RE = /[\u3040-\u30ff]/;
const JAPANESE_KANJI_HINT_RE = /(?:評価|詳細|報告|品質|却下|無視|概要)/;
const HANGUL_RE = /[\uac00-\ud7af]/;
const CYRILLIC_RE = /[\u0400-\u04ff]/;
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

const LATIN_DETECTION: Array<{ locale: SupportedLocale; patterns: RegExp[] }> = [
  {
    locale: 'es',
    patterns: [
      /\b(por favor|evalua|evaluar|analiza|analizar|informe|informes|sugerencia|sugerencias|descartar|omitir)\b/g,
      /\b(ver|mostrar|ayuda|riesgo|seguridad|actualizar)\b/g
    ]
  },
  {
    locale: 'fr',
    patterns: [
      /\b(s il vous plait|merci|evaluer|evalue|analyse|analyser|rapport|suggestion|suggestions|ignorer)\b/g,
      /\b(voir|aide|risque|securite|mettre a jour)\b/g
    ]
  },
  {
    locale: 'de',
    patterns: [
      /\b(bitte|bewerten|bewerte|analysieren|analysiere|bericht|vorschlag|vorschlage|uberspringen)\b/g,
      /\b(anzeigen|hilfe|risiko|sicherheit|aktualisieren)\b/g
    ]
  }
];

const MESSAGES = {} as Record<SupportedLocale, MessageCatalog>;

MESSAGES.en = {
  unknownSubcommand: 'Unknown subcommand. Available:',
  subcommandStatus: '  /sc status   — Overview and pending suggestions',
  subcommandEval: '  /sc eval <skill> — Evaluate a skill',
  subcommandReport: '  /sc report   — Skill portfolio report',
  subcommandDismiss: '  /sc dismiss <id> — Dismiss a suggestion',
  subcommandSnooze: '  /sc snooze <id>  — Snooze a suggestion',
  statusSummary: '🧭 {count} skills tracked. {pending} suggestion{plural_s} pending.',
  andMore: '  ... and {count} more',
  handleButton: 'Handle #{index}',
  viewAll: 'View All',
  usageEval: 'Usage: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'Skill "{skill}" not found.',
  cannotScan: 'Cannot scan "{skill}": {error}',
  scanFailed: 'scan failed',
  securityIssuesDetected: '⚠ Security issues detected',
  qualityIssuesDetected: '⚠ Quality issues detected (not security)',
  qualityConcernsFound: '⚠ Quality concerns found',
  clean: '✓ Clean',
  fullEval: 'Full eval (D4-D6)',
  skip: 'Skip',
  quickScanUnavailable: 'Quick scan unavailable. Run a full evaluation manually.',
  skillPortfolio: '🧭 Skill Portfolio',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: 'Total uses (all time): {count}',
  neverEvaluated: 'Never evaluated: {count}',
  pendingSuggestions: 'Pending suggestions: {count}',
  usageDismiss: 'Usage: /sc dismiss <suggestion-id>',
  suggestionNotFound: 'Suggestion "{id}" not found.',
  dismissedSuggestion: 'Dismissed suggestion {id} ({days}-day cooldown).',
  dismissFailed: 'Failed to dismiss "{id}".',
  usageSnooze: 'Usage: /sc snooze <suggestion-id>',
  snoozedSuggestion: 'Snoozed suggestion {id} for {days} days.',
  snoozeFailed: 'Failed to snooze "{id}".',
  weeklyDigest: '🧭 SkillCompass Weekly — {count} new suggestion{plural_s}',
  dismissAll: 'Dismiss All',
  unknown: 'unknown',
  updateAvailable: '🧭 Update available',
  changelog: 'Changelog: "{text}"',
  updateRescan: 'Update + re-scan',
  viewChangelog: 'View changelog',
  securityRisk: '⚠ Security risk in {skill}: {details}',
  viewDetails: 'View Details',
  dismiss: 'Dismiss',
  typeStandalone: 'standalone',
  typePackage: 'package',
  typeCollection: 'collection',
  reasonNeverUsed: 'Installed {days} days ago, never invoked',
  reasonIdle: 'Last used {days} days ago, no invocations in 14 days',
  reasonDeclining: 'Used {count} times in the prior 14 days, 0 times in the last 7 days',
  reasonUndo2x: 'Rolled back {count} times in 7 days, output quality may be unstable',
  reasonHeavyNoEval: 'Used {count} times in 14 days but never evaluated',
  reasonStaleEval: 'Used {uses} times in 14 days, last evaluated {days} days ago',
  reasonDuplicateLoser: 'Overlaps with {other} ({otherUses} uses) while this skill has only {selfUses}',
  reasonOneAndDone: 'Used only once ({date}), never invoked again',
  reasonCheckUpdate: '{days} days since last update check, new version may be available',
  reasonClawhubUpdate: 'New version {latest} available (current: {current})'
};

MESSAGES.zh = {
  unknownSubcommand: '\u672a\u77e5\u5b50\u547d\u4ee4\u3002\u53ef\u7528\u547d\u4ee4\uff1a',
  subcommandStatus: '  /sc status   \u2014 \u6982\u89c8\u548c\u5f85\u5904\u7406\u5efa\u8bae',
  subcommandEval: '  /sc eval <skill> \u2014 \u8bc4\u6d4b\u4e00\u4e2a skill',
  subcommandReport: '  /sc report   \u2014 Skill \u7ec4\u5408\u62a5\u544a',
  subcommandDismiss: '  /sc dismiss <id> \u2014 \u5ffd\u7565\u4e00\u6761\u5efa\u8bae',
  subcommandSnooze: '  /sc snooze <id>  \u2014 \u6682\u7f13\u4e00\u6761\u5efa\u8bae',
  statusSummary: '\ud83e\udded \u5df2\u8ddf\u8e2a {count} \u4e2a skill\uff0c\u5f53\u524d\u6709 {pending} \u6761\u5f85\u5904\u7406\u5efa\u8bae\u3002',
  andMore: '  ... \u4ee5\u53ca\u53e6\u5916 {count} \u6761',
  handleButton: '\u5904\u7406 #{index}',
  viewAll: '\u67e5\u770b\u5168\u90e8',
  usageEval: '\u7528\u6cd5\uff1a/sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: '\u672a\u627e\u5230 skill "{skill}"\u3002',
  cannotScan: '\u65e0\u6cd5\u626b\u63cf "{skill}"\uff1a{error}',
  scanFailed: '\u626b\u63cf\u5931\u8d25',
  securityIssuesDetected: '\u26a0 \u53d1\u73b0\u5b89\u5168\u95ee\u9898',
  qualityIssuesDetected: '\u26a0 \u53d1\u73b0\u8d28\u91cf\u95ee\u9898\uff08\u975e\u5b89\u5168\uff09',
  qualityConcernsFound: '\u26a0 \u53d1\u73b0\u8d28\u91cf\u9690\u60a3',
  clean: '\u2713 \u901a\u8fc7\u5feb\u68c0',
  fullEval: '\u5b8c\u6574\u8bc4\u6d4b\uff08D4-D6\uff09',
  skip: '\u8df3\u8fc7',
  quickScanUnavailable: '\u5feb\u68c0\u6682\u4e0d\u53ef\u7528\u3002\u8bf7\u624b\u52a8\u8fd0\u884c\u5b8c\u6574\u8bc4\u6d4b\u3002',
  skillPortfolio: '\ud83e\udded Skill \u7ec4\u5408\u6982\u89c8',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: '\u7d2f\u8ba1\u4f7f\u7528\u6b21\u6570\uff1a{count}',
  neverEvaluated: '\u4ece\u672a\u8bc4\u6d4b\uff1a{count}',
  pendingSuggestions: '\u5f85\u5904\u7406\u5efa\u8bae\uff1a{count}',
  usageDismiss: '\u7528\u6cd5\uff1a/sc dismiss <suggestion-id>',
  suggestionNotFound: '\u672a\u627e\u5230\u5efa\u8bae "{id}"\u3002',
  dismissedSuggestion: '\u5df2\u5ffd\u7565\u5efa\u8bae {id}\uff08{days} \u5929\u51b7\u5374\uff09\u3002',
  dismissFailed: '\u5ffd\u7565 "{id}" \u5931\u8d25\u3002',
  usageSnooze: '\u7528\u6cd5\uff1a/sc snooze <suggestion-id>',
  snoozedSuggestion: '\u5df2\u5c06\u5efa\u8bae {id} \u6682\u7f13 {days} \u5929\u3002',
  snoozeFailed: '\u6682\u7f13 "{id}" \u5931\u8d25\u3002',
  weeklyDigest: '\ud83e\udded SkillCompass \u5468\u62a5 \u2014 \u65b0\u589e {count} \u6761\u5efa\u8bae',
  dismissAll: '\u5168\u90e8\u5ffd\u7565',
  unknown: '\u672a\u77e5',
  updateAvailable: '\ud83e\udded \u6709\u53ef\u7528\u66f4\u65b0',
  changelog: '\u66f4\u65b0\u8bf4\u660e: "{text}"',
  updateRescan: '\u66f4\u65b0\u5e76\u91cd\u65b0\u626b\u63cf',
  viewChangelog: '\u67e5\u770b\u66f4\u65b0\u8bf4\u660e',
  securityRisk: '\u26a0 {skill} \u5b58\u5728\u5b89\u5168\u98ce\u9669\uff1a{details}',
  viewDetails: '\u67e5\u770b\u8be6\u60c5',
  dismiss: '\u5ffd\u7565',
  typeStandalone: '\u5355\u4f53',
  typePackage: '\u5305',
  typeCollection: '\u96c6\u5408',
  reasonNeverUsed: '\u5b89\u88c5\u5df2 {days} \u5929\uff0c\u4ece\u672a\u8c03\u7528',
  reasonIdle: '\u6700\u540e\u4e00\u6b21\u4f7f\u7528\u662f {days} \u5929\u524d\uff0c14 \u5929\u5185\u8c03\u7528\u4e3a 0',
  reasonDeclining: '\u524d 14 \u5929\u4f7f\u7528\u4e86 {count} \u6b21\uff0c\u4f46\u6700\u8fd1 7 \u5929\u4e3a 0 \u6b21',
  reasonUndo2x: '7 \u5929\u5185\u5df2\u56de\u6eda {count} \u6b21\uff0c\u8f93\u51fa\u8d28\u91cf\u53ef\u80fd\u4e0d\u7a33\u5b9a',
  reasonHeavyNoEval: '14 \u5929\u5185\u4f7f\u7528\u4e86 {count} \u6b21\uff0c\u4f46\u4ece\u672a\u8bc4\u6d4b',
  reasonStaleEval: '14 \u5929\u5185\u4f7f\u7528\u4e86 {uses} \u6b21\uff0c\u6700\u540e\u4e00\u6b21\u8bc4\u6d4b\u662f {days} \u5929\u524d',
  reasonDuplicateLoser: '\u4e0e {other} \u91cd\u53e0\uff08{otherUses} \u6b21\u4f7f\u7528\uff09\uff0c\u800c\u6b64 skill \u53ea\u6709 {selfUses} \u6b21\u4f7f\u7528',
  reasonOneAndDone: '\u53ea\u4f7f\u7528\u8fc7\u4e00\u6b21\uff08{date}\uff09\uff0c\u4e4b\u540e\u672a\u518d\u8c03\u7528',
  reasonCheckUpdate: '\u8ddd\u79bb\u4e0a\u6b21\u68c0\u67e5\u66f4\u65b0\u5df2\u8fc7 {days} \u5929\uff0c\u53ef\u80fd\u6709\u65b0\u7248\u672c',
  reasonClawhubUpdate: '\u53d1\u73b0\u65b0\u7248\u672c {latest}\uff08\u5f53\u524d\uff1a{current}\uff09'
};

MESSAGES.es = {
  unknownSubcommand: 'Subcomando desconocido. Disponibles:',
  subcommandStatus: '  /sc status   — Resumen y sugerencias pendientes',
  subcommandEval: '  /sc eval <skill> — Evaluar una skill',
  subcommandReport: '  /sc report   — Informe del portafolio de skills',
  subcommandDismiss: '  /sc dismiss <id> — Descartar una sugerencia',
  subcommandSnooze: '  /sc snooze <id>  — Posponer una sugerencia',
  statusSummary: '🧭 {count} skills rastreadas. {pending} sugerencia{plural_s} pendiente{plural_s}.',
  andMore: '  ... y {count} mas',
  handleButton: 'Atender #{index}',
  viewAll: 'Ver todo',
  usageEval: 'Uso: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'No se encontro la skill "{skill}".',
  cannotScan: 'No se puede escanear "{skill}": {error}',
  scanFailed: 'el escaneo fallo',
  securityIssuesDetected: '⚠ Se detectaron problemas de seguridad',
  qualityIssuesDetected: '⚠ Se detectaron problemas de calidad (no de seguridad)',
  qualityConcernsFound: '⚠ Se encontraron riesgos de calidad',
  clean: '✓ Limpio',
  fullEval: 'Evaluacion completa (D4-D6)',
  skip: 'Omitir',
  quickScanUnavailable: 'El escaneo rapido no esta disponible. Ejecuta una evaluacion completa manualmente.',
  skillPortfolio: '🧭 Portafolio de Skills',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: 'Usos totales: {count}',
  neverEvaluated: 'Nunca evaluadas: {count}',
  pendingSuggestions: 'Sugerencias pendientes: {count}',
  usageDismiss: 'Uso: /sc dismiss <suggestion-id>',
  suggestionNotFound: 'No se encontro la sugerencia "{id}".',
  dismissedSuggestion: 'Sugerencia {id} descartada ({days} dias de espera).',
  dismissFailed: 'No se pudo descartar "{id}".',
  usageSnooze: 'Uso: /sc snooze <suggestion-id>',
  snoozedSuggestion: 'Sugerencia {id} pospuesta por {days} dias.',
  snoozeFailed: 'No se pudo posponer "{id}".',
  weeklyDigest: '🧭 Resumen semanal de SkillCompass — {count} sugerencia{plural_s} nueva{plural_s}',
  dismissAll: 'Descartar todo',
  unknown: 'desconocida',
  updateAvailable: '🧭 Actualizacion disponible',
  changelog: 'Registro de cambios: "{text}"',
  updateRescan: 'Actualizar y volver a escanear',
  viewChangelog: 'Ver cambios',
  securityRisk: '⚠ Riesgo de seguridad en {skill}: {details}',
  viewDetails: 'Ver detalles',
  dismiss: 'Descartar',
  typeStandalone: 'individual',
  typePackage: 'paquete',
  typeCollection: 'coleccion',
  reasonNeverUsed: 'Instalada hace {days} dias, nunca invocada',
  reasonIdle: 'Ultimo uso hace {days} dias, sin invocaciones en 14 dias',
  reasonDeclining: 'Se uso {count} veces en los 14 dias anteriores y 0 veces en los ultimos 7 dias',
  reasonUndo2x: 'Se revirtio {count} veces en 7 dias; la calidad de salida puede ser inestable',
  reasonHeavyNoEval: 'Se uso {count} veces en 14 dias pero nunca se evaluo',
  reasonStaleEval: 'Se uso {uses} veces en 14 dias; la ultima evaluacion fue hace {days} dias',
  reasonDuplicateLoser: 'Se solapa con {other} ({otherUses} usos) mientras esta skill solo tiene {selfUses}',
  reasonOneAndDone: 'Se uso solo una vez ({date}) y no se volvio a invocar',
  reasonCheckUpdate: 'Han pasado {days} dias desde la ultima revision de actualizaciones; puede haber una nueva version',
  reasonClawhubUpdate: 'Hay una nueva version {latest} disponible (actual: {current})'
};

MESSAGES.fr = {
  unknownSubcommand: 'Sous-commande inconnue. Disponibles :',
  subcommandStatus: '  /sc status   — Apercu et suggestions en attente',
  subcommandEval: '  /sc eval <skill> — Evaluer une skill',
  subcommandReport: '  /sc report   — Rapport du portefeuille de skills',
  subcommandDismiss: '  /sc dismiss <id> — Ignorer une suggestion',
  subcommandSnooze: '  /sc snooze <id>  — Reporter une suggestion',
  statusSummary: '🧭 {count} skills suivies. {pending} suggestion{plural_s} en attente.',
  andMore: '  ... et {count} de plus',
  handleButton: 'Traiter #{index}',
  viewAll: 'Tout voir',
  usageEval: 'Utilisation : /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'Skill "{skill}" introuvable.',
  cannotScan: 'Impossible de scanner "{skill}" : {error}',
  scanFailed: 'echec du scan',
  securityIssuesDetected: '⚠ Problemes de securite detectes',
  qualityIssuesDetected: '⚠ Problemes de qualite detectes (hors securite)',
  qualityConcernsFound: '⚠ Risques de qualite detectes',
  clean: '✓ Propre',
  fullEval: 'Evaluation complete (D4-D6)',
  skip: 'Ignorer',
  quickScanUnavailable: 'Le scan rapide est indisponible. Lancez une evaluation complete manuellement.',
  skillPortfolio: '🧭 Portefeuille de Skills',
  skillsLine: 'Skills : {count} ({types})',
  totalUses: 'Usages totaux : {count}',
  neverEvaluated: 'Jamais evaluees : {count}',
  pendingSuggestions: 'Suggestions en attente : {count}',
  usageDismiss: 'Utilisation : /sc dismiss <suggestion-id>',
  suggestionNotFound: 'Suggestion "{id}" introuvable.',
  dismissedSuggestion: 'Suggestion {id} ignoree ({days} jours de pause).',
  dismissFailed: 'Impossible d ignorer "{id}".',
  usageSnooze: 'Utilisation : /sc snooze <suggestion-id>',
  snoozedSuggestion: 'Suggestion {id} reportee pour {days} jours.',
  snoozeFailed: 'Impossible de reporter "{id}".',
  weeklyDigest: '🧭 Resume hebdomadaire SkillCompass — {count} nouvelle{plural_s} suggestion{plural_s}',
  dismissAll: 'Tout ignorer',
  unknown: 'inconnue',
  updateAvailable: '🧭 Mise a jour disponible',
  changelog: 'Journal des changements : "{text}"',
  updateRescan: 'Mettre a jour et rescanner',
  viewChangelog: 'Voir les changements',
  securityRisk: '⚠ Risque de securite dans {skill} : {details}',
  viewDetails: 'Voir les details',
  dismiss: 'Ignorer',
  typeStandalone: 'autonome',
  typePackage: 'paquet',
  typeCollection: 'collection',
  reasonNeverUsed: 'Installee il y a {days} jours, jamais invoquee',
  reasonIdle: 'Derniere utilisation il y a {days} jours, aucune invocation en 14 jours',
  reasonDeclining: 'Utilisee {count} fois sur les 14 jours precedents, 0 fois sur les 7 derniers jours',
  reasonUndo2x: 'Annulee {count} fois en 7 jours ; la qualite de sortie peut etre instable',
  reasonHeavyNoEval: 'Utilisee {count} fois en 14 jours mais jamais evaluee',
  reasonStaleEval: 'Utilisee {uses} fois en 14 jours ; derniere evaluation il y a {days} jours',
  reasonDuplicateLoser: 'Chevauche {other} ({otherUses} usages) alors que cette skill n a que {selfUses} usages',
  reasonOneAndDone: 'Utilisee une seule fois ({date}), puis plus jamais invoquee',
  reasonCheckUpdate: '{days} jours depuis la derniere verification de mise a jour ; une nouvelle version peut etre disponible',
  reasonClawhubUpdate: 'Nouvelle version {latest} disponible (actuelle : {current})'
};

MESSAGES.de = {
  unknownSubcommand: 'Unbekannter Unterbefehl. Verfugbar:',
  subcommandStatus: '  /sc status   — Ubersicht und ausstehende Vorschlage',
  subcommandEval: '  /sc eval <skill> — Eine Skill bewerten',
  subcommandReport: '  /sc report   — Bericht zum Skill-Portfolio',
  subcommandDismiss: '  /sc dismiss <id> — Einen Vorschlag verwerfen',
  subcommandSnooze: '  /sc snooze <id>  — Einen Vorschlag verschieben',
  statusSummary: '🧭 {count} Skills werden verfolgt. {pending} ausstehende Vorschlag{plural_s}.',
  andMore: '  ... und {count} weitere',
  handleButton: 'Bearbeiten #{index}',
  viewAll: 'Alle anzeigen',
  usageEval: 'Verwendung: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'Skill "{skill}" wurde nicht gefunden.',
  cannotScan: '"{skill}" kann nicht gescannt werden: {error}',
  scanFailed: 'Scan fehlgeschlagen',
  securityIssuesDetected: '⚠ Sicherheitsprobleme erkannt',
  qualityIssuesDetected: '⚠ Qualitatsprobleme erkannt (keine Sicherheitsprobleme)',
  qualityConcernsFound: '⚠ Qualitatsrisiken gefunden',
  clean: '✓ Sauber',
  fullEval: 'Vollstandige Bewertung (D4-D6)',
  skip: 'Uberspringen',
  quickScanUnavailable: 'Der Schnellscan ist nicht verfugbar. Fuhren Sie eine vollstandige Bewertung manuell aus.',
  skillPortfolio: '🧭 Skill-Portfolio',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: 'Gesamtnutzungen: {count}',
  neverEvaluated: 'Nie bewertet: {count}',
  pendingSuggestions: 'Ausstehende Vorschlage: {count}',
  usageDismiss: 'Verwendung: /sc dismiss <suggestion-id>',
  suggestionNotFound: 'Vorschlag "{id}" wurde nicht gefunden.',
  dismissedSuggestion: 'Vorschlag {id} verworfen ({days} Tage Cooldown).',
  dismissFailed: '"{id}" konnte nicht verworfen werden.',
  usageSnooze: 'Verwendung: /sc snooze <suggestion-id>',
  snoozedSuggestion: 'Vorschlag {id} fur {days} Tage verschoben.',
  snoozeFailed: '"{id}" konnte nicht verschoben werden.',
  weeklyDigest: '🧭 SkillCompass Wochenuberblick — {count} neue Vorschlag{plural_s}',
  dismissAll: 'Alle verwerfen',
  unknown: 'unbekannt',
  updateAvailable: '🧭 Update verfugbar',
  changelog: 'Anderungen: "{text}"',
  updateRescan: 'Aktualisieren und neu scannen',
  viewChangelog: 'Anderungen anzeigen',
  securityRisk: '⚠ Sicherheitsrisiko in {skill}: {details}',
  viewDetails: 'Details anzeigen',
  dismiss: 'Verwerfen',
  typeStandalone: 'einzeln',
  typePackage: 'paket',
  typeCollection: 'sammlung',
  reasonNeverUsed: 'Vor {days} Tagen installiert, nie aufgerufen',
  reasonIdle: 'Zuletzt vor {days} Tagen verwendet, keine Aufrufe in 14 Tagen',
  reasonDeclining: 'In den vorherigen 14 Tagen {count} Mal verwendet, in den letzten 7 Tagen 0 Mal',
  reasonUndo2x: 'In 7 Tagen {count} Mal zuruckgesetzt; die Ausgabequalitat kann instabil sein',
  reasonHeavyNoEval: 'In 14 Tagen {count} Mal verwendet, aber nie bewertet',
  reasonStaleEval: 'In 14 Tagen {uses} Mal verwendet; letzte Bewertung vor {days} Tagen',
  reasonDuplicateLoser: 'Uberschneidet sich mit {other} ({otherUses} Nutzungen), wahrend diese Skill nur {selfUses} hat',
  reasonOneAndDone: 'Nur einmal verwendet ({date}) und danach nie wieder aufgerufen',
  reasonCheckUpdate: '{days} Tage seit der letzten Update-Prufung; eine neue Version konnte verfugbar sein',
  reasonClawhubUpdate: 'Neue Version {latest} verfugbar (aktuell: {current})'
};

MESSAGES.ja = {
  unknownSubcommand: '\u4e0d\u660e\u306a\u30b5\u30d6\u30b3\u30de\u30f3\u30c9\u3067\u3059\u3002\u4f7f\u3048\u308b\u30b3\u30de\u30f3\u30c9:',
  subcommandStatus: '  /sc status   \u2014 \u6982\u8981\u3068\u4fdd\u7559\u4e2d\u306e\u63d0\u6848',
  subcommandEval: '  /sc eval <skill> \u2014 skill \u3092\u8a55\u4fa1',
  subcommandReport: '  /sc report   \u2014 skill \u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa \u30ec\u30dd\u30fc\u30c8',
  subcommandDismiss: '  /sc dismiss <id> \u2014 \u63d0\u6848\u3092\u5374\u4e0b',
  subcommandSnooze: '  /sc snooze <id>  \u2014 \u63d0\u6848\u3092\u5f8c\u3067\u518d\u8868\u793a',
  statusSummary: '\ud83e\udded {count} \u500b\u306e skill \u3092\u8ffd\u8de1\u4e2d\u3002{pending} \u4ef6\u306e\u63d0\u6848\u304c\u4fdd\u7559\u4e2d\u3067\u3059\u3002',
  andMore: '  ... \u307b\u304b {count} \u4ef6',
  handleButton: '\u5bfe\u5fdc #{index}',
  viewAll: '\u3059\u3079\u3066\u8868\u793a',
  usageEval: '\u4f7f\u3044\u65b9: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'skill "{skill}" \u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002',
  cannotScan: '"{skill}" \u3092\u30b9\u30ad\u30e3\u30f3\u3067\u304d\u307e\u305b\u3093: {error}',
  scanFailed: '\u30b9\u30ad\u30e3\u30f3\u306b\u5931\u6557\u3057\u307e\u3057\u305f',
  securityIssuesDetected: '\u26a0 \u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u554f\u984c\u304c\u898b\u3064\u304b\u308a\u307e\u3057\u305f',
  qualityIssuesDetected: '\u26a0 \u54c1\u8cea\u4e0a\u306e\u554f\u984c\u304c\u898b\u3064\u304b\u308a\u307e\u3057\u305f\uff08\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u3067\u306f\u3042\u308a\u307e\u305b\u3093\uff09',
  qualityConcernsFound: '\u26a0 \u54c1\u8cea\u4e0a\u306e\u61f8\u5ff5\u304c\u898b\u3064\u304b\u308a\u307e\u3057\u305f',
  clean: '\u2713 \u554f\u984c\u306a\u3057',
  fullEval: '\u5b8c\u5168\u8a55\u4fa1 (D4-D6)',
  skip: '\u30b9\u30ad\u30c3\u30d7',
  quickScanUnavailable: '\u30af\u30a4\u30c3\u30af\u30b9\u30ad\u30e3\u30f3\u306f\u5229\u7528\u3067\u304d\u307e\u305b\u3093\u3002\u5b8c\u5168\u8a55\u4fa1\u3092\u624b\u52d5\u3067\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
  skillPortfolio: '\ud83e\udded Skill \u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: '\u7dcf\u4f7f\u7528\u56de\u6570: {count}',
  neverEvaluated: '\u672a\u8a55\u4fa1: {count}',
  pendingSuggestions: '\u4fdd\u7559\u4e2d\u306e\u63d0\u6848: {count}',
  usageDismiss: '\u4f7f\u3044\u65b9: /sc dismiss <suggestion-id>',
  suggestionNotFound: '\u63d0\u6848 "{id}" \u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002',
  dismissedSuggestion: '\u63d0\u6848 {id} \u3092\u5374\u4e0b\u3057\u307e\u3057\u305f\uff08{days} \u65e5\u9593\u30af\u30fc\u30eb\u30c0\u30a6\u30f3\uff09\u3002',
  dismissFailed: '"{id}" \u3092\u5374\u4e0b\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002',
  usageSnooze: '\u4f7f\u3044\u65b9: /sc snooze <suggestion-id>',
  snoozedSuggestion: '\u63d0\u6848 {id} \u3092 {days} \u65e5\u9593\u30b9\u30cc\u30fc\u30ba\u3057\u307e\u3057\u305f\u3002',
  snoozeFailed: '"{id}" \u3092\u30b9\u30cc\u30fc\u30ba\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002',
  weeklyDigest: '\ud83e\udded SkillCompass \u9031\u9593\u307e\u3068\u3081 \u2014 \u65b0\u3057\u3044\u63d0\u6848 {count} \u4ef6',
  dismissAll: '\u3059\u3079\u3066\u5374\u4e0b',
  unknown: '\u4e0d\u660e',
  updateAvailable: '\ud83e\udded \u66f4\u65b0\u304c\u3042\u308a\u307e\u3059',
  changelog: '\u5909\u66f4\u5c65\u6b74: "{text}"',
  updateRescan: '\u66f4\u65b0\u3057\u3066\u518d\u30b9\u30ad\u30e3\u30f3',
  viewChangelog: '\u5909\u66f4\u5c65\u6b74\u3092\u8868\u793a',
  securityRisk: '\u26a0 {skill} \u306b\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u30ea\u30b9\u30af: {details}',
  viewDetails: '\u8a73\u7d30\u3092\u8868\u793a',
  dismiss: '\u5374\u4e0b',
  typeStandalone: '\u5358\u4f53',
  typePackage: '\u30d1\u30c3\u30b1\u30fc\u30b8',
  typeCollection: '\u30b3\u30ec\u30af\u30b7\u30e7\u30f3',
  reasonNeverUsed: '\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u304b\u3089 {days} \u65e5\u3001\u307e\u3060\u4e00\u5ea6\u3082\u547c\u3073\u51fa\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
  reasonIdle: '\u6700\u5f8c\u306e\u5229\u7528\u306f {days} \u65e5\u524d\u300114 \u65e5\u9593\u306e\u547c\u3073\u51fa\u3057\u306f 0 \u56de\u3067\u3059',
  reasonDeclining: '\u76f4\u524d\u306e 14 \u65e5\u9593\u3067 {count} \u56de\u4f7f\u308f\u308c\u307e\u3057\u305f\u304c\u3001\u76f4\u8fd1 7 \u65e5\u306f 0 \u56de\u3067\u3059',
  reasonUndo2x: '7 \u65e5\u9593\u3067 {count} \u56de\u30ed\u30fc\u30eb\u30d0\u30c3\u30af\u3055\u308c\u3066\u304a\u308a\u3001\u51fa\u529b\u54c1\u8cea\u304c\u4e0d\u5b89\u5b9a\u304b\u3082\u3057\u308c\u307e\u305b\u3093',
  reasonHeavyNoEval: '14 \u65e5\u9593\u3067 {count} \u56de\u4f7f\u308f\u308c\u307e\u3057\u305f\u304c\u3001\u307e\u3060\u8a55\u4fa1\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
  reasonStaleEval: '14 \u65e5\u9593\u3067 {uses} \u56de\u4f7f\u308f\u308c\u3001\u6700\u5f8c\u306e\u8a55\u4fa1\u306f {days} \u65e5\u524d\u3067\u3059',
  reasonDuplicateLoser: '{other} \u3068\u91cd\u8907\u3057\u3066\u304a\u308a\uff08{otherUses} \u56de\u4f7f\u7528\uff09\u3001\u3053\u306e skill \u306f {selfUses} \u56de\u3057\u304b\u4f7f\u308f\u308c\u3066\u3044\u307e\u305b\u3093',
  reasonOneAndDone: '{date} \u306b 1 \u56de\u3060\u3051\u4f7f\u308f\u308c\u3001\u305d\u306e\u5f8c\u306f\u547c\u3073\u51fa\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
  reasonCheckUpdate: '\u6700\u5f8c\u306e\u66f4\u65b0\u78ba\u8a8d\u304b\u3089 {days} \u65e5\u7d4c\u904e\u3057\u307e\u3057\u305f\u3002\u65b0\u3057\u3044\u30d0\u30fc\u30b8\u30e7\u30f3\u304c\u3042\u308b\u304b\u3082\u3057\u308c\u307e\u305b\u3093',
  reasonClawhubUpdate: '\u65b0\u3057\u3044\u30d0\u30fc\u30b8\u30e7\u30f3 {latest} \u304c\u5229\u7528\u53ef\u80fd\u3067\u3059\uff08\u73fe\u5728: {current}\uff09'
};

MESSAGES.ko = {
  unknownSubcommand: '\uc54c \uc218 \uc5c6\ub294 \ud558\uc704 \uba85\ub839\uc785\ub2c8\ub2e4. \uc0ac\uc6a9 \uac00\ub2a5:',
  subcommandStatus: '  /sc status   \u2014 \uac1c\uc694\uc640 \ub300\uae30 \uc911\uc778 \uc81c\uc548',
  subcommandEval: '  /sc eval <skill> \u2014 skill \ud3c9\uac00',
  subcommandReport: '  /sc report   \u2014 skill \ud3ec\ud2b8\ud3f4\ub9ac\uc624 \ubcf4\uace0\uc11c',
  subcommandDismiss: '  /sc dismiss <id> \u2014 \uc81c\uc548 \ubb34\uc2dc',
  subcommandSnooze: '  /sc snooze <id>  \u2014 \uc81c\uc548 \ubbf8\ub8e8\uae30',
  statusSummary: '\ud83e\udded {count}\uac1c\uc758 skill\uc744 \ucd94\uc801 \uc911\uc785\ub2c8\ub2e4. \ud604\uc7ac {pending}\uac1c\uc758 \uc81c\uc548\uc774 \ub300\uae30 \uc911\uc785\ub2c8\ub2e4.',
  andMore: '  ... \ucd94\uac00 {count}\uac1c',
  handleButton: '\ucc98\ub9ac #{index}',
  viewAll: '\uc804\uccb4 \ubcf4\uae30',
  usageEval: '\uc0ac\uc6a9\ubc95: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'skill "{skill}"\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.',
  cannotScan: '"{skill}"\uc744 \uc2a4\uce94\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4: {error}',
  scanFailed: '\uc2a4\uce94 \uc2e4\ud328',
  securityIssuesDetected: '\u26a0 \ubcf4\uc548 \ubb38\uc81c\uac00 \ubc1c\uacac\ub418\uc5c8\uc2b5\ub2c8\ub2e4',
  qualityIssuesDetected: '\u26a0 \ud488\uc9c8 \ubb38\uc81c\uac00 \ubc1c\uacac\ub418\uc5c8\uc2b5\ub2c8\ub2e4 (\ubcf4\uc548 \ubb38\uc81c\ub294 \uc544\ub2d9\ub2c8\ub2e4)',
  qualityConcernsFound: '\u26a0 \ud488\uc9c8 \uc6b0\ub824\uc0ac\ud56d\uc774 \ubc1c\uacac\ub418\uc5c8\uc2b5\ub2c8\ub2e4',
  clean: '\u2713 \ubb38\uc81c \uc5c6\uc74c',
  fullEval: '\uc804\uccb4 \ud3c9\uac00 (D4-D6)',
  skip: '\uac74\ub108\ub6f0\uae30',
  quickScanUnavailable: '\ube60\ub978 \uc2a4\uce94\uc744 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \uc804\uccb4 \ud3c9\uac00\ub97c \uc218\ub3d9\uc73c\ub85c \uc2e4\ud589\ud558\uc138\uc694.',
  skillPortfolio: '\ud83e\udded Skill \ud3ec\ud2b8\ud3f4\ub9ac\uc624',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: '\ucd1d \uc0ac\uc6a9 \ud69f\uc218: {count}',
  neverEvaluated: '\ud3c9\uac00\ub41c \uc801 \uc5c6\uc74c: {count}',
  pendingSuggestions: '\ub300\uae30 \uc911\uc778 \uc81c\uc548: {count}',
  usageDismiss: '\uc0ac\uc6a9\ubc95: /sc dismiss <suggestion-id>',
  suggestionNotFound: '\uc81c\uc548 "{id}"\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.',
  dismissedSuggestion: '\uc81c\uc548 {id}\ub97c \ubb34\uc2dc\ud588\uc2b5\ub2c8\ub2e4 ({days}\uc77c \ucfe8\ub2e4\uc6b4).',
  dismissFailed: '"{id}"\uc744 \ubb34\uc2dc\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.',
  usageSnooze: '\uc0ac\uc6a9\ubc95: /sc snooze <suggestion-id>',
  snoozedSuggestion: '\uc81c\uc548 {id}\ub97c {days}\uc77c \ub3d9\uc548 \ubbf8\ub8e8\uc5c8\uc2b5\ub2c8\ub2e4.',
  snoozeFailed: '"{id}"\uc744 \ubbf8\ub8f0 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.',
  weeklyDigest: '\ud83e\udded SkillCompass \uc8fc\uac04 \uc694\uc57d \u2014 \uc0c8 \uc81c\uc548 {count}\uac1c',
  dismissAll: '\uc804\ubd80 \ubb34\uc2dc',
  unknown: '\uc54c \uc218 \uc5c6\uc74c',
  updateAvailable: '\ud83e\udded \uc5c5\ub370\uc774\ud2b8 \uac00\ub2a5',
  changelog: '\ubcc0\uacbd \ub0b4\uc5ed: "{text}"',
  updateRescan: '\uc5c5\ub370\uc774\ud2b8 \ud6c4 \ub2e4\uc2dc \uc2a4\uce94',
  viewChangelog: '\ubcc0\uacbd \ub0b4\uc5ed \ubcf4\uae30',
  securityRisk: '\u26a0 {skill}\uc5d0 \ubcf4\uc548 \uc704\ud5d8: {details}',
  viewDetails: '\uc790\uc138\ud788 \ubcf4\uae30',
  dismiss: '\ubb34\uc2dc',
  typeStandalone: '\ub2e8\uc77c',
  typePackage: '\ud328\ud0a4\uc9c0',
  typeCollection: '\uceec\ub809\uc158',
  reasonNeverUsed: '\uc124\uce58 \ud6c4 {days}\uc77c\uc774 \uc9c0\ub0ac\uc9c0\ub9cc \ud55c \ubc88\ub3c4 \ud638\ucd9c\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4',
  reasonIdle: '\ub9c8\uc9c0\ub9c9 \uc0ac\uc6a9\uc740 {days}\uc77c \uc804\uc774\uba70, 14\uc77c \ub3d9\uc548 \ud638\ucd9c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4',
  reasonDeclining: '\uc774\uc804 14\uc77c \ub3d9\uc548 {count}\ud68c \uc0ac\uc6a9\ub418\uc5c8\uc9c0\ub9cc \ucd5c\uadfc 7\uc77c\uc740 0\ud68c\uc785\ub2c8\ub2e4',
  reasonUndo2x: '7\uc77c \ub3d9\uc548 {count}\ud68c \ub864\ubc31\ub418\uc5b4 \ucd9c\ub825 \ud488\uc9c8\uc774 \ubd88\uc548\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4',
  reasonHeavyNoEval: '14\uc77c \ub3d9\uc548 {count}\ud68c \uc0ac\uc6a9\ub418\uc5c8\uc9c0\ub9cc \uc544\uc9c1 \ud3c9\uac00\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4',
  reasonStaleEval: '14\uc77c \ub3d9\uc548 {uses}\ud68c \uc0ac\uc6a9\ub418\uc5c8\uace0 \ub9c8\uc9c0\ub9c9 \ud3c9\uac00\ub294 {days}\uc77c \uc804\uc785\ub2c8\ub2e4',
  reasonDuplicateLoser: '{other}\uc640 \uc911\ubcf5\ub418\uba70 ({otherUses}\ud68c \uc0ac\uc6a9), \uc774 skill\uc740 {selfUses}\ud68c\ub9cc \uc0ac\uc6a9\ub418\uc5c8\uc2b5\ub2c8\ub2e4',
  reasonOneAndDone: '{date}\uc5d0 \ud55c \ubc88\ub9cc \uc0ac\uc6a9\ub418\uace0 \uadf8 \ud6c4 \ub2e4\uc2dc \ud638\ucd9c\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4',
  reasonCheckUpdate: '\ub9c8\uc9c0\ub9c9 \uc5c5\ub370\uc774\ud2b8 \ud655\uc778 \ud6c4 {days}\uc77c\uc774 \uc9c0\ub0ac\uc2b5\ub2c8\ub2e4. \uc0c8 \ubc84\uc804\uc774 \uc788\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4',
  reasonClawhubUpdate: '\uc0c8 \ubc84\uc804 {latest}\uc744 \uc0ac\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4 (\ud604\uc7ac: {current})'
};

MESSAGES.ru = {
  unknownSubcommand: '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043f\u043e\u0434\u043a\u043e\u043c\u0430\u043d\u0434\u0430. \u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e:',
  subcommandStatus: '  /sc status   \u2014 \u041e\u0431\u0437\u043e\u0440 \u0438 \u043e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  subcommandEval: '  /sc eval <skill> \u2014 \u041e\u0446\u0435\u043d\u0438\u0442\u044c skill',
  subcommandReport: '  /sc report   \u2014 \u041e\u0442\u0447\u0435\u0442 \u043f\u043e \u043f\u043e\u0440\u0442\u0444\u0435\u043b\u044e skills',
  subcommandDismiss: '  /sc dismiss <id> \u2014 \u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435',
  subcommandSnooze: '  /sc snooze <id>  \u2014 \u041e\u0442\u043b\u043e\u0436\u0438\u0442\u044c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435',
  statusSummary: '\ud83e\udded \u041e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f {count} skills. \u0412 \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u0438 {pending} \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439.',
  andMore: '  ... \u0438 \u0435\u0449\u0435 {count}',
  handleButton: '\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c #{index}',
  viewAll: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435',
  usageEval: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435: /sc eval <skill-name | path/to/SKILL.md>',
  skillNotFound: 'Skill "{skill}" \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.',
  cannotScan: '\u041d\u0435\u043b\u044c\u0437\u044f \u043f\u0440\u043e\u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c "{skill}": {error}',
  scanFailed: '\u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c',
  securityIssuesDetected: '\u26a0 \u041e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u044b \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438',
  qualityIssuesDetected: '\u26a0 \u041d\u0430\u0439\u0434\u0435\u043d\u044b \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430 (\u043d\u0435 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438)',
  qualityConcernsFound: '\u26a0 \u041d\u0430\u0439\u0434\u0435\u043d\u044b \u0440\u0438\u0441\u043a\u0438 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430',
  clean: '\u2713 \u0427\u0438\u0441\u0442\u043e',
  fullEval: '\u041f\u043e\u043b\u043d\u0430\u044f \u043e\u0446\u0435\u043d\u043a\u0430 (D4-D6)',
  skip: '\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
  quickScanUnavailable: '\u0411\u044b\u0441\u0442\u0440\u043e\u0435 \u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e. \u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0435 \u043f\u043e\u043b\u043d\u0443\u044e \u043e\u0446\u0435\u043d\u043a\u0443 \u0432\u0440\u0443\u0447\u043d\u0443\u044e.',
  skillPortfolio: '\ud83e\udded \u041f\u043e\u0440\u0442\u0444\u0435\u043b\u044c Skills',
  skillsLine: 'Skills: {count} ({types})',
  totalUses: '\u0412\u0441\u0435\u0433\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0439: {count}',
  neverEvaluated: '\u041d\u0438\u043a\u043e\u0433\u0434\u0430 \u043d\u0435 \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u043b\u0438\u0441\u044c: {count}',
  pendingSuggestions: '\u041e\u0436\u0438\u0434\u0430\u044e\u0449\u0438\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f: {count}',
  usageDismiss: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435: /sc dismiss <suggestion-id>',
  suggestionNotFound: '\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 "{id}" \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.',
  dismissedSuggestion: '\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 {id} \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e ({days} \u0434\u043d. \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u0435).',
  dismissFailed: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c "{id}".',
  usageSnooze: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435: /sc snooze <suggestion-id>',
  snoozedSuggestion: '\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 {id} \u043e\u0442\u043b\u043e\u0436\u0435\u043d\u043e \u043d\u0430 {days} \u0434\u043d.',
  snoozeFailed: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043b\u043e\u0436\u0438\u0442\u044c "{id}".',
  weeklyDigest: '\ud83e\udded \u0415\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0432\u043e\u0434\u043a\u0430 SkillCompass \u2014 \u043d\u043e\u0432\u044b\u0445 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439: {count}',
  dismissAll: '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0432\u0441\u0435',
  unknown: '\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e',
  updateAvailable: '\ud83e\udded \u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435',
  changelog: '\u0421\u043f\u0438\u0441\u043e\u043a \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439: "{text}"',
  updateRescan: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0438 \u043f\u0435\u0440\u0435\u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  viewChangelog: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f',
  securityRisk: '\u26a0 \u0420\u0438\u0441\u043a \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438 \u0432 {skill}: {details}',
  viewDetails: '\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u043e',
  dismiss: '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c',
  typeStandalone: '\u043e\u0442\u0434\u0435\u043b\u044c\u043d\u0430\u044f',
  typePackage: '\u043f\u0430\u043a\u0435\u0442',
  typeCollection: '\u043a\u043e\u043b\u043b\u0435\u043a\u0446\u0438\u044f',
  reasonNeverUsed: '\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430 {days} \u0434\u043d. \u043d\u0430\u0437\u0430\u0434, \u043d\u0438 \u0440\u0430\u0437\u0443 \u043d\u0435 \u0432\u044b\u0437\u044b\u0432\u0430\u043b\u0430\u0441\u044c',
  reasonIdle: '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435 {days} \u0434\u043d. \u043d\u0430\u0437\u0430\u0434, \u0437\u0430 14 \u0434\u043d. \u0432\u044b\u0437\u043e\u0432\u043e\u0432 \u043d\u0435 \u0431\u044b\u043b\u043e',
  reasonDeclining: '\u0417\u0430 \u043f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0435 14 \u0434\u043d. \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0430\u0441\u044c {count} \u0440\u0430\u0437, \u0437\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 7 \u0434\u043d. \u2014 0',
  reasonUndo2x: '\u0417\u0430 7 \u0434\u043d. \u0431\u044b\u043b\u043e {count} \u043e\u0442\u043a\u0430\u0442\u043e\u0432; \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0432\u044b\u0432\u043e\u0434\u0430 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043d\u0435\u0441\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u044b\u043c',
  reasonHeavyNoEval: '\u0417\u0430 14 \u0434\u043d. \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0430\u0441\u044c {count} \u0440\u0430\u0437, \u043d\u043e \u043d\u0438 \u0440\u0430\u0437\u0443 \u043d\u0435 \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u043b\u0430\u0441\u044c',
  reasonStaleEval: '\u0417\u0430 14 \u0434\u043d. \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0430\u0441\u044c {uses} \u0440\u0430\u0437, \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043e\u0446\u0435\u043d\u043a\u0430 \u0431\u044b\u043b\u0430 {days} \u0434\u043d. \u043d\u0430\u0437\u0430\u0434',
  reasonDuplicateLoser: '\u041f\u0435\u0440\u0435\u0441\u0435\u043a\u0430\u0435\u0442\u0441\u044f \u0441 {other} ({otherUses} \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0439), \u0432 \u0442\u043e \u0432\u0440\u0435\u043c\u044f \u043a\u0430\u043a \u044d\u0442\u0430 skill \u0438\u043c\u0435\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e {selfUses}',
  reasonOneAndDone: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043b\u0430\u0441\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0434\u0438\u043d \u0440\u0430\u0437 ({date}) \u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u0432\u044b\u0437\u044b\u0432\u0430\u043b\u0430\u0441\u044c',
  reasonCheckUpdate: '\u0421 \u043c\u043e\u043c\u0435\u043d\u0442\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0439 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0439 \u043f\u0440\u043e\u0448\u043b\u043e {days} \u0434\u043d.; \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043d\u043e\u0432\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f',
  reasonClawhubUpdate: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043d\u043e\u0432\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f {latest} (\u0442\u0435\u043a\u0443\u0449\u0430\u044f: {current})'
};

function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(vars[key] ?? ''));
}

function toEvidenceMap(evidence?: EvidenceEntry[] | null): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const entry of evidence || []) {
    if (!entry?.field) continue;
    map[entry.field] = entry.value;
  }
  return map;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function daysSince(value: unknown): string {
  if (typeof value !== 'string' || !value) return '?';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '?';
  return String(Math.max(0, Math.floor((Date.now() - time) / 86400000)));
}

function isoDate(value: unknown): string {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '?';
}

function normalizeTextForDetection(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase();
}

function detectScriptLocale(text: string): SupportedLocale | null {
  if (JAPANESE_RE.test(text)) return 'ja';
  if (JAPANESE_KANJI_HINT_RE.test(text)) return 'ja';
  if (HANGUL_RE.test(text)) return 'ko';
  if (CYRILLIC_RE.test(text)) return 'ru';
  if (CJK_RE.test(text)) return 'zh';
  return null;
}

function detectLatinLocale(text: string, minScore = 1): SupportedLocale | null {
  const normalized = normalizeTextForDetection(text);
  let bestLocale: SupportedLocale | null = null;
  let bestScore = 0;

  for (const candidate of LATIN_DETECTION) {
    let score = 0;
    for (const pattern of candidate.patterns) {
      score += normalized.match(pattern)?.length || 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLocale = candidate.locale;
    }
  }

  return bestScore >= minScore ? bestLocale : null;
}

export function normalizeLocale(locale?: string | null): SupportedLocale | null {
  if (!locale) return null;
  const trimmed = locale.trim().toLowerCase();
  if (!trimmed) return null;
  const base = trimmed.split(/[-_]/, 1)[0] as SupportedLocale;
  return SUPPORTED_LOCALE_SET.has(base) ? base : null;
}

export function detectLocaleFromText(text?: string | null): SupportedLocale | null {
  if (!text) return null;
  const scriptLocale = detectScriptLocale(text);
  if (scriptLocale) return scriptLocale;
  return detectLatinLocale(text);
}

export function resolveLocale(
  config?: UserConfig,
  ...textCandidates: Array<string | null | undefined>
): SupportedLocale {
  const configured = normalizeLocale(config?.locale ?? config?.userLocale);
  const latinMinScore = configured ? 2 : 1;

  for (const text of textCandidates) {
    if (!text) continue;

    const scriptLocale = detectScriptLocale(text);
    if (scriptLocale) return scriptLocale;

    const latinLocale = detectLatinLocale(text, latinMinScore);
    if (latinLocale) return latinLocale;
  }

  if (configured) return configured;

  return 'en';
}

export function msg(
  locale: SupportedLocale,
  key: MessageKey,
  vars: Record<string, unknown> = {}
): string {
  const catalog = MESSAGES[locale] || MESSAGES.en;
  const template = catalog[key] || MESSAGES.en[key];
  return fillTemplate(template, vars);
}

export function localizeSkillType(locale: SupportedLocale, type?: string | null): string {
  switch (type) {
    case 'standalone':
      return msg(locale, 'typeStandalone');
    case 'package':
      return msg(locale, 'typePackage');
    case 'collection':
      return msg(locale, 'typeCollection');
    default:
      return type || msg(locale, 'unknown');
  }
}

export function localizeSuggestionReason(
  locale: SupportedLocale,
  suggestion: SuggestionLike
): string {
  const evidence = toEvidenceMap(suggestion.evidence);
  const count = toFiniteNumber(evidence.use_count_14d);
  const rollbackCount = toFiniteNumber(evidence.rollback_count_7d);
  const otherCount = toFiniteNumber(evidence.duplicate_use_count_14d);
  const fetchDays = toFiniteNumber(evidence.last_fetch_days);

  switch (suggestion.rule_id) {
    case 'never-used':
      return msg(locale, 'reasonNeverUsed', { days: daysSince(evidence.first_seen_at) });
    case 'idle':
      return msg(locale, 'reasonIdle', { days: daysSince(evidence.last_used_at) });
    case 'declining':
      return msg(locale, 'reasonDeclining', { count: count ?? '?' });
    case 'undo-2x':
      return msg(locale, 'reasonUndo2x', { count: rollbackCount ?? '?' });
    case 'heavy-no-eval':
      return msg(locale, 'reasonHeavyNoEval', { count: count ?? '?' });
    case 'stale-eval':
      return msg(locale, 'reasonStaleEval', {
        uses: count ?? '?',
        days: daysSince(evidence.last_eval_at)
      });
    case 'duplicate-loser':
      return msg(locale, 'reasonDuplicateLoser', {
        other: String(evidence.duplicate_of ?? '?'),
        otherUses: otherCount ?? '?',
        selfUses: count ?? '?'
      });
    case 'one-and-done':
      return msg(locale, 'reasonOneAndDone', { date: isoDate(evidence.first_used_at) });
    case 'check-update':
      return msg(locale, 'reasonCheckUpdate', { days: fetchDays ?? '?' });
    case 'clawhub-update':
      return msg(locale, 'reasonClawhubUpdate', {
        latest: String(evidence.clawhub_latest_version ?? '?'),
        current: String(evidence.clawhub_current_version || msg(locale, 'unknown'))
      });
    default:
      return suggestion.reason || '';
  }
}
