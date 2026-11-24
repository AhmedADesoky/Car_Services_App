/** Rename the product in ONE place (placeholder brand until the company name is final). */
export const BRAND = {
  name: 'GarageOS',
  nameAr: 'جراج أو إس',
  domain: 'garageos.example',
  contactEmail: 'hello@garageos.example',
} as const;

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
