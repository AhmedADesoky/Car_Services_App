import type { Metadata } from 'next';
import { Inter, Noto_Kufi_Arabic, Space_Grotesk } from 'next/font/google';
import { notFound } from 'next/navigation';
import { isLocale, LOCALES } from '@/config/Brand_Config';
import { DICTIONARIES } from '@/i18n/Dictionary';
import '../globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const spaceGrotesk = Space_Grotesk({ variable: '--font-space-grotesk', subsets: ['latin'] });
const kufi = Noto_Kufi_Arabic({ variable: '--font-kufi', subsets: ['arabic'], weight: ['400', '500', '700', '800'] });

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = DICTIONARIES[isLocale(locale) ? locale : 'ar'];
  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: { languages: { ar: '/ar', en: '/en' } },
    openGraph: { title: t.meta.title, description: t.meta.description, type: 'website' },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={DICTIONARIES[locale].dir}>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${kufi.variable} min-h-screen`}>{children}</body>
    </html>
  );
}
