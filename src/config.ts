
export const availableLanguages = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  // Add other languages as needed
];
export type LanguageCode = typeof availableLanguages[number]['code'];