import { isLocale } from '@/config/Brand_Config';
import { DICTIONARIES } from '@/i18n/Dictionary';
import { Feature_Grid, Flow_Story, Hero, Plans, Security_Vault } from '@/components/Home_Sections';
import { Ai_Assistant } from '@/components/Ai_Assistant';
import { Request_Form } from '@/components/Request_Form';
import { Site_Footer, Site_Header } from '@/components/Site_Chrome';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : 'ar';
  const t = DICTIONARIES[locale];
  return (
    <>
      <Site_Header t={t} locale={locale} />
      <main>
        <Hero t={t} />
        <Flow_Story t={t} />
        <Feature_Grid t={t} />
        <Security_Vault t={t} />
        <Plans t={t} />
        <Request_Form t={t} locale={locale} />
      </main>
      <Ai_Assistant t={t} locale={locale} />
      <Site_Footer t={t} locale={locale} />
    </>
  );
}
