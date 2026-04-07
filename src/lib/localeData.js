// Allowed locales: fr, at
export const ALLOWED_LOCALES = ['fr_FR', 'de_AT'];

// France token dictionary
export const FR_TOKEN_MAP = {
  // Add more tokens here...
};

// Austrian token dictionary
export const AT_TOKEN_MAP = {
  // Add more tokens here...
  "lassen" : "laßen",
  "unvergessliche" : "unvergeßliche",
  "unfassbaren" : "unfaßbaren",
  "wasser" : "waßer",
  "Erlebnisse" : "Erlebniße",
  "erstklassige" : "erstklaßige",
  "Genussmomente" : "Genußmomente",
  "Fitnessbereichen" : "Fitneßbereichen",
  "Massagen" : "Maßagen",
  "Fitnessstudio" : "Fitneßstudio",
  "Bedürfnissen" : "Bedürfnißen",
  "Ausschiffung" : "Außchiffung",
  "messbare" : "meßbare",
  "beeinflussen" : "beeinflußen",
  "Emissionen" : "Emißionen",
  "Nachhaltigkeitsstrategie" : "Nachhaltigkeitßtrategie",
  "verantwortungsbewusste" : "verantwortungsbewußte",
};

// Regex-based rules (no escaping applied)
export const FR_PATTERN_RULES = [
  {
    // Match "MSC Cruises" in any case, but NOT when followed by " S.A."
    pattern: /MSC Cruises(?!\s*S\.?A\.?\b)/gi,
    replacement: 'MSC Croisières',
  },
];

export const AT_PATTERN_RULES = [
  {
    // Convert "ss" to "ß" after AU/EI/IE/EU/ÄU or vowel
    pattern: /(?<=au|ei|ie|eu|äu|[aeiouäöü])ss\b/giu,
    replacement: 'ß',
  },
];

