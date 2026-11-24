import type { Locale } from '@/config/Brand_Config';

const en = {
  dir: 'ltr' as 'ltr' | 'rtl',
  meta: { title: 'GarageOS — run every bay like clockwork', description: 'One app for vehicle service stations: plate scanning, orders, WhatsApp receipts, face check-in and a private, isolated system for every station. Android and iOS, Arabic and English.' },
  nav: { how: 'How it works', features: 'Features', security: 'Privacy', plans: 'Plans', faq: 'Ask AI', cta: 'Request your station', lang: 'العربية' },
  hero: {
    eyebrow: 'For vehicle service stations in Egypt',
    title1: 'Run every bay', title2: 'like clockwork.',
    text: 'Scan a plate and the order opens. Finish the work and the receipt reaches the customer on WhatsApp. Workers check in with their face at the station. Your data stays yours.',
    primary: 'Request your station', secondary: 'See how a car moves',
    chips: ['Android & iOS', 'Arabic & English', 'Your own private system'],
    scanLabel: 'Plate recognised', orderLabel: 'Order opened', timer: 'Timer started',
  },
  flow: {
    eyebrow: 'How a car moves through your station', title: 'From the gate to the receipt in four taps',
    steps: [
      { title: 'Scan the plate', text: 'The camera reads Egyptian plates — Arabic letters and Arabic-Indic digits — in about a second. A returning car shows its owner and full history.' },
      { title: 'Open the order', text: 'Pick the repairs from your price list, assign workers, and the timer starts. Prices and tax are locked at that moment.' },
      { title: 'Finish and check out', text: 'Each worker marks their job done with what they fixed. The receipt is calculated with tax, numbered without gaps.' },
      { title: 'Get paid, send on WhatsApp', text: 'Cash, card or both. The receipt goes to the customer’s WhatsApp from your own business number.' },
    ],
  },
  features: {
    eyebrow: 'Everything a station needs', title: 'One system for every bay, every worker and every pound.',
    items: [
      { title: 'Plate AI', text: 'On-phone recognition built for Egyptian plates, with a station-trained model that gets better with every correction.' },
      { title: 'Face + location check-in', text: 'Workers check in only when they are at the branch, with a live-face check so a photo or video cannot cheat.' },
      { title: '2D car service map', text: 'Tap any part of the customer’s car to see what was repaired, replaced or needs attention.' },
      { title: 'WhatsApp receipts', text: 'Arabic or English receipts with your logo, sent from your own WhatsApp Business number.' },
      { title: 'Workers & roles', text: 'Add workers, set shifts and branches, decide exactly who can see and do what.' },
      { title: 'Dashboards & accounting', text: 'Revenue, tax, payments, staff performance and daily cash close — ready for your accountant.' },
      { title: 'Works offline', text: 'Orders keep working when the network drops and sync without duplicates when it returns.' },
      { title: 'Excel in and out', text: 'Bring your customers and price list from Excel; export anything, any time.' },
    ],
  },
  security: {
    eyebrow: 'Privacy by design', title: 'Your station is a vault. Not even we can look inside.',
    text: 'Every station runs in its own isolated space. Your customers, cars, money and workers’ faces are separated from every other station by seven independent walls — and our own staff cannot open them unless you grant time-limited access from your app.',
    walls: ['Your login carries your station', 'Every request is checked', 'The database refuses other stations', 'Your own encryption key', 'Private files and cache', 'Your own AI model', 'Audited staff access'],
  },
  plans: {
    eyebrow: 'Plans', title: 'Start small. Grow to every branch.', note: 'Prices are confirmed with you after the request — they depend on branches and workers.', cta: 'Request this plan', popular: 'Most chosen',
    items: [
      { code: 'basic', name: 'Basic', who: 'One workshop', points: ['1 branch', 'Up to 10 workers', '3,000 plate scans / month', 'Excel export', 'Platform AI model'] },
      { code: 'pro', name: 'Pro', who: 'Growing stations', points: ['Up to 5 branches', 'Up to 50 workers', '15,000 plate scans / month', 'Custom roles', 'Your own fine-tuned plate model (quarterly)'] },
      { code: 'enterprise', name: 'Enterprise', who: 'Chains', points: ['Unlimited branches and workers', 'Custom plate-scan volume', 'Monthly AI fine-tuning', 'Optional dedicated database', 'Custom data retention'] },
    ],
  },
  form: {
    eyebrow: 'Request your station', title: 'Tell us about your station', text: 'Our team reviews every request and contacts you. When it is approved, the owner receives a private activation link.',
    steps: ['Your business', 'Size & plan', 'Contact'],
    stepHints: ['Name and city', 'Branches, workers and plan', 'Who should we call?'],
    ticket: 'Your request', ticketEmpty: 'Start typing, your request builds itself here.', perks: ['No payment now', 'Reviewed by a person', 'Private activation link'],
    businessName: 'Business name (English)', businessNameAr: 'Business name (Arabic)', city: 'City', branches: 'Branches', workers: 'Workers', plan: 'Plan',
    contactName: 'Your name', phone: 'Mobile number', email: 'Email (optional)', message: 'Anything else? (optional)',
    next: 'Next', back: 'Back', submit: 'Send request', sending: 'Sending…',
    successTitle: 'Request received', successText: 'Thank you. Our team will call you soon. Nothing is created until we review it together.',
    errorGeneric: 'Could not send. Check your connection and try again.', errorRate: 'Too many requests from this network. Try again in a few minutes.',
  },
  faq: {
    title: 'Questions owners ask',
    items: [
      { q: 'Do I need special hardware?', a: 'No. Workers use their Android or iPhone. Card payments use your existing POS terminal.' },
      { q: 'Can my workers fake their attendance?', a: 'Check-in needs the worker’s live face and a real location inside your branch. Photos, videos and fake-GPS apps are refused.' },
      { q: 'Who can see my customers and revenue?', a: 'Only the people you allow inside your station. Our company sees usage totals only, never your business data.' },
      { q: 'Does it work in Arabic?', a: 'Yes. Arabic and English are switched in one tap and the whole app mirrors right-to-left.' },
      { q: 'What happens if the internet drops?', a: 'Orders and jobs keep working offline and sync automatically. Check-in and payments wait for the connection for safety.' },
    ],
  },
  assistant: {
    eyebrow: 'Ask anything', title: 'Your questions, answered in seconds.', text: 'Our AI assistant knows GarageOS inside out — plans, plate scanning, check-in, privacy, how to start. Ask in Arabic or English.',
    name: 'GarageOS assistant', status: 'Online · replies instantly', offline: 'Quick answers', placeholder: 'Ask about plans, check-in, privacy…', send: 'Send', clear: 'New chat',
    hello: 'Hi! I can explain how GarageOS works for your station. What would you like to know?',
    suggestions: ['Which plan fits 3 branches?', 'Can workers fake attendance?', 'Who can see my revenue?', 'How do I get started?'],
    disclaimer: 'AI answers can be imperfect. Prices are always confirmed by our team.', error: 'I couldn’t reach the assistant. Here is the closest answer I know:', busy: 'Too many questions from this network. Wait a few minutes.',
    fallback: 'I don’t have that answer offline. Send a station request and our team will call you.',
  },
  footer: {
    rights: 'All rights reserved.', privacy: 'Privacy', terms: 'Terms', staff: 'Built for owners, workers and accountants.',
    ctaTitle: 'Ready to run every bay like clockwork?', ctaText: 'Tell us about your station. Our team calls you within one working day.',
    product: 'Product', company: 'Company', legal: 'Legal', contact: 'Contact', ask: 'Ask our AI', made: 'Designed and built in Cairo',
    status: 'All systems normal',
  },
  activate: {
    title: 'Activate your owner account', checking: 'Checking your link…', invalid: 'This link is invalid, already used or expired. Ask us to send a new one.',
    station: 'Station', username: 'Your username', password: 'Choose a password', confirm: 'Confirm password', submit: 'Activate my account',
    rules: ['At least 10 characters', 'Mix of letters, numbers and symbols', 'Not your username'], mismatch: 'Passwords do not match',
    doneTitle: 'Your station is ready', doneText: 'Open the app on your phone, enter the station code and sign in with your username and new password. You will set up 2-step verification there.',
    code: 'Station code',
  },
};

export type Dictionary = typeof en;

const ar: Dictionary = {
  dir: 'rtl',
  meta: { title: 'جراج أو إس — أدِر كل ورشة بدقة الساعة', description: 'تطبيق واحد لمحطات خدمة السيارات: قراءة اللوحات، الطلبات، إيصالات واتساب، الحضور بالوجه، ونظام خاص ومعزول لكل محطة. أندرويد وآيفون، عربي وإنجليزي.' },
  nav: { how: 'كيف يعمل', features: 'المميزات', security: 'الخصوصية', plans: 'الباقات', faq: 'اسأل المساعد', cta: 'اطلب محطتك', lang: 'English' },
  hero: {
    eyebrow: 'لمحطات خدمة السيارات في مصر',
    title1: 'أدِر كل ورشة', title2: 'بدقة الساعة.',
    text: 'امسح اللوحة فيُفتح الطلب. أنهِ العمل فيصل الإيصال للعميل على واتساب. العمال يسجلون حضورهم بالوجه داخل المحطة. وبياناتك تبقى ملكك.',
    primary: 'اطلب محطتك', secondary: 'شاهد رحلة السيارة',
    chips: ['أندرويد وآيفون', 'عربي وإنجليزي', 'نظام خاص بمحطتك'],
    scanLabel: 'تم التعرف على اللوحة', orderLabel: 'تم فتح الطلب', timer: 'بدأ المؤقت',
  },
  flow: {
    eyebrow: 'رحلة السيارة داخل محطتك', title: 'من البوابة حتى الإيصال في أربع لمسات',
    steps: [
      { title: 'امسح اللوحة', text: 'الكاميرا تقرأ اللوحات المصرية — الحروف العربية والأرقام — في حوالي ثانية. السيارة العائدة تظهر بصاحبها وتاريخها كاملاً.' },
      { title: 'افتح الطلب', text: 'اختر الإصلاحات من قائمة أسعارك، وعيّن العمال، فيبدأ المؤقت. السعر والضريبة يُثبتان في تلك اللحظة.' },
      { title: 'أنهِ العمل واحسب الفاتورة', text: 'كل عامل يُنهي مهمته ويكتب ما أصلحه. الإيصال يُحسب بالضريبة وبترقيم متسلسل بلا فجوات.' },
      { title: 'استلم المبلغ وأرسل على واتساب', text: 'نقدي أو بطاقة أو الاثنان. الإيصال يصل لواتساب العميل من رقم نشاطك التجاري.' },
    ],
  },
  features: {
    eyebrow: 'كل ما تحتاجه المحطة', title: 'نظام واحد. لكل ورشة وكل عامل وكل جنيه.',
    items: [
      { title: 'ذكاء قراءة اللوحات', text: 'قراءة على الهاتف مصممة للوحات المصرية، ونموذج خاص بمحطتك يتحسن مع كل تصحيح.' },
      { title: 'حضور بالوجه والموقع', text: 'العامل يسجل حضوره فقط داخل الفرع، مع فحص الوجه الحي فلا تنفع صورة أو فيديو.' },
      { title: 'خريطة صيانة ثنائية الأبعاد', text: 'المس أي جزء من سيارة العميل لترى ما تم إصلاحه أو تغييره أو ما يحتاج متابعة.' },
      { title: 'إيصالات واتساب', text: 'إيصالات بالعربي أو الإنجليزي بشعارك، تُرسل من رقم واتساب الأعمال الخاص بك.' },
      { title: 'العمال والصلاحيات', text: 'أضف العمال وحدد الورديات والفروع، وقرر بدقة من يرى ماذا ومن يفعل ماذا.' },
      { title: 'لوحات تحكم ومحاسبة', text: 'الإيرادات والضرائب والمدفوعات وأداء العمال وإقفال الخزينة اليومي — جاهزة لمحاسبك.' },
      { title: 'يعمل بدون إنترنت', text: 'الطلبات تستمر عند انقطاع الشبكة وتتزامن دون تكرار عند عودتها.' },
      { title: 'إكسل دخولاً وخروجاً', text: 'استورد عملاءك وقائمة أسعارك من إكسل، وصدّر أي شيء في أي وقت.' },
    ],
  },
  security: {
    eyebrow: 'الخصوصية من الأساس', title: 'محطتك خزنة. حتى نحن لا نرى ما بداخلها.',
    text: 'كل محطة تعمل في مساحة معزولة خاصة بها. عملاؤك وسياراتك وأموالك ووجوه عمالك مفصولة عن أي محطة أخرى بسبعة جدران مستقلة — وموظفونا لا يستطيعون الدخول إلا إذا منحتهم إذناً مؤقتاً من تطبيقك.',
    walls: ['دخولك يحمل محطتك', 'كل طلب يُفحص', 'قاعدة البيانات ترفض المحطات الأخرى', 'مفتاح تشفير خاص بك', 'ملفات وذاكرة خاصة', 'نموذج ذكاء خاص بك', 'وصول موظفين مُراقَب'],
  },
  plans: {
    eyebrow: 'الباقات', title: 'ابدأ صغيراً. وتوسع لكل الفروع.', note: 'الأسعار تُحدد معك بعد الطلب — حسب عدد الفروع والعمال.', cta: 'اطلب هذه الباقة', popular: 'الأكثر اختياراً',
    items: [
      { code: 'basic', name: 'أساسية', who: 'ورشة واحدة', points: ['فرع واحد', 'حتى 10 عمال', '3,000 قراءة لوحة شهرياً', 'تصدير إكسل', 'نموذج الذكاء العام'] },
      { code: 'pro', name: 'احترافية', who: 'محطات تنمو', points: ['حتى 5 فروع', 'حتى 50 عاملاً', '15,000 قراءة لوحة شهرياً', 'أدوار مخصصة', 'نموذج لوحات مدرب لمحطتك (كل ربع سنة)'] },
      { code: 'enterprise', name: 'مؤسسات', who: 'سلاسل المحطات', points: ['فروع وعمال بلا حدود', 'حجم قراءات حسب الاتفاق', 'تدريب شهري للذكاء', 'قاعدة بيانات مخصصة اختيارية', 'مدة احتفاظ بالبيانات حسب الطلب'] },
    ],
  },
  form: {
    eyebrow: 'اطلب محطتك', title: 'أخبرنا عن محطتك', text: 'فريقنا يراجع كل طلب ويتواصل معك. عند الموافقة يصل للمالك رابط تفعيل خاص.',
    steps: ['نشاطك', 'الحجم والباقة', 'التواصل'],
    stepHints: ['الاسم والمدينة', 'الفروع والعمال والباقة', 'من نتصل به؟'],
    ticket: 'طلبك', ticketEmpty: 'ابدأ الكتابة، وسيتكوّن طلبك هنا.', perks: ['بدون دفع الآن', 'مراجعة بشرية', 'رابط تفعيل خاص'],
    businessName: 'اسم النشاط (إنجليزي)', businessNameAr: 'اسم النشاط (عربي)', city: 'المدينة', branches: 'الفروع', workers: 'العمال', plan: 'الباقة',
    contactName: 'اسمك', phone: 'رقم الموبايل', email: 'البريد الإلكتروني (اختياري)', message: 'أي تفاصيل أخرى؟ (اختياري)',
    next: 'التالي', back: 'رجوع', submit: 'إرسال الطلب', sending: 'جارٍ الإرسال…',
    successTitle: 'تم استلام طلبك', successText: 'شكراً لك. سيتواصل معك فريقنا قريباً. لا يتم إنشاء أي شيء قبل مراجعته معك.',
    errorGeneric: 'تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.', errorRate: 'طلبات كثيرة من هذه الشبكة. حاول بعد دقائق.',
  },
  faq: {
    title: 'أسئلة يطرحها أصحاب المحطات',
    items: [
      { q: 'هل أحتاج أجهزة خاصة؟', a: 'لا. العمال يستخدمون هواتف أندرويد أو آيفون. الدفع بالبطاقة عبر ماكينة الدفع الموجودة لديك.' },
      { q: 'هل يستطيع العمال تزوير الحضور؟', a: 'تسجيل الحضور يحتاج وجه العامل الحي وموقعاً حقيقياً داخل الفرع. الصور والفيديو وتطبيقات الموقع المزيف مرفوضة.' },
      { q: 'من يستطيع رؤية عملائي وإيراداتي؟', a: 'فقط من تسمح لهم داخل محطتك. شركتنا ترى إجماليات الاستخدام فقط، ولا ترى بيانات نشاطك أبداً.' },
      { q: 'هل يعمل بالعربي؟', a: 'نعم. العربي والإنجليزي بلمسة واحدة، والتطبيق كله ينعكس من اليمين لليسار.' },
      { q: 'ماذا يحدث عند انقطاع الإنترنت؟', a: 'الطلبات والمهام تعمل بدون إنترنت وتتزامن تلقائياً. الحضور والدفع ينتظران الاتصال من أجل الأمان.' },
    ],
  },
  assistant: {
    eyebrow: 'اسأل أي شيء', title: 'أسئلتك، بإجابة في ثوانٍ.', text: 'مساعدنا الذكي يعرف GarageOS بالتفصيل — الباقات، قراءة اللوحات، الحضور، الخصوصية، وكيف تبدأ. اسأل بالعربي أو الإنجليزي.',
    name: 'مساعد GarageOS', status: 'متصل · يرد فوراً', offline: 'إجابات سريعة', placeholder: 'اسأل عن الباقات، الحضور، الخصوصية…', send: 'إرسال', clear: 'محادثة جديدة',
    hello: 'أهلاً! أقدر أشرح لك إزاي GarageOS بيشتغل في محطتك. حابب تعرف إيه؟',
    suggestions: ['أي باقة تناسب ٣ فروع؟', 'هل يقدر العامل يزوّر الحضور؟', 'مين يقدر يشوف إيراداتي؟', 'أبدأ إزاي؟'],
    disclaimer: 'إجابات الذكاء الاصطناعي قد لا تكون دقيقة دائماً. الأسعار يؤكدها فريقنا.', error: 'تعذّر الوصول للمساعد. هذه أقرب إجابة أعرفها:', busy: 'أسئلة كثيرة من هذه الشبكة. انتظر بضع دقائق.',
    fallback: 'لا أملك هذه الإجابة بدون اتصال. أرسل طلب محطتك وسيتصل بك فريقنا.',
  },
  footer: {
    rights: 'جميع الحقوق محفوظة.', privacy: 'الخصوصية', terms: 'الشروط', staff: 'مصمم لأصحاب المحطات والعمال والمحاسبين.',
    ctaTitle: 'جاهز تدير كل مكان في محطتك بدقة الساعة؟', ctaText: 'أخبرنا عن محطتك. فريقنا يتصل بك خلال يوم عمل واحد.',
    product: 'المنتج', company: 'الشركة', legal: 'قانوني', contact: 'تواصل', ask: 'اسأل المساعد الذكي', made: 'صُمم وطُوّر في القاهرة',
    status: 'كل الأنظمة تعمل',
  },
  activate: {
    title: 'فعّل حساب المالك', checking: 'جارٍ التحقق من الرابط…', invalid: 'هذا الرابط غير صالح أو مستخدم أو منتهي. اطلب منا رابطاً جديداً.',
    station: 'المحطة', username: 'اسم المستخدم', password: 'اختر كلمة مرور', confirm: 'أكد كلمة المرور', submit: 'فعّل حسابي',
    rules: ['10 أحرف على الأقل', 'مزيج من حروف وأرقام ورموز', 'لا تحتوي على اسم المستخدم'], mismatch: 'كلمتا المرور غير متطابقتين',
    doneTitle: 'محطتك جاهزة', doneText: 'افتح التطبيق على هاتفك، أدخل كود المحطة وسجّل الدخول باسم المستخدم وكلمة المرور الجديدة. ستفعّل التحقق بخطوتين هناك.',
    code: 'كود المحطة',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };
