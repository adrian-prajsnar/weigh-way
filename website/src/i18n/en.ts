export type SiteLocale = 'en' | 'pl';

export type SiteMessages = {
  meta: {
    title: string;
    description: string;
    releasesTitle: string;
    releasesDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    termsTitle: string;
    termsDescription: string;
    geeksTitle: string;
    geeksDescription: string;
  };
  brand: string;
  nav: {
    home: string;
    releases: string;
    menu: string;
    close: string;
  };
  language: {
    label: string;
    system: string;
    english: string;
    polish: string;
  };
  theme: {
    label: string;
    system: string;
    light: string;
    dark: string;
  };
  home: {
    eyebrow: string;
    headline: string;
    subhead: string;
    downloadAndroid: string;
    downloadIos: string;
    downloadUnavailableAndroid: string;
    downloadUnavailableIos: string;
    openDemo: string;
    versionLabel: string;
    freeBadge: string;
    platformsBadge: string;
    privateBadge: string;
    heroSliderNext: string;
    heroSliderPrev: string;
    preview: {
      latest: string;
      latestValue: string;
      bmi: string;
      bmiValue: string;
      thisWeek: string;
      thisWeekValue: string;
      days30: string;
      days30Value: string;
    };
    highlightsTitle: string;
    highlights: { title: string; body: string }[];
    featuresTitle: string;
    featuresSubtitle: string;
    features: { title: string; body: string }[];
    audienceTitle: string;
    audienceSubtitle: string;
    audience: { title: string; body: string }[];
    screensTitle: string;
    screensSubtitle: string;
    screens: { id: string; title: string; body: string }[];
    howTitle: string;
    howSubtitle: string;
    steps: { title: string; body: string }[];
    faqTitle: string;
    faqSubtitle: string;
    faq: { question: string; answer: string }[];
    ctaTitle: string;
    ctaTitlePlayLetter?: string;
    ctaBody: string;
  };
  releases: {
    title: string;
    subtitle: string;
    latest: string;
    downloadAndroid: string;
    downloadIos: string;
    empty: string;
    noAndroidBuild: string;
    noIosBuild: string;
    pendingTitle: string;
    pendingBody: string;
    pendingContact: string;
  };
  privacy: {
    title: string;
    updatedLabel: string;
    updatedDate: string;
    lead: string;
    sections: { title: string; body: string }[];
  };
  terms: {
    title: string;
    updatedLabel: string;
    updatedDate: string;
    lead: string;
    sections: { title: string; body: string }[];
  };
  legal: {
    tocLabel: string;
    minRead: string;
    alsoRead: string;
  };
  footer: {
    tagline: string;
    legalNav: string;
    privacyPolicy: string;
    termsOfService: string;
    questions: string;
    copyrightName: string;
    geeks: string;
  };
  demoModal: {
    title: string;
    close: string;
    loading: string;
  };
  geeks: {
    eyebrow: string;
    title: string;
    lead: string;
    demoLink: string;
    architectureTitle: string;
    architectureLead: string;
    nodes: { title: string; body: string }[];
    tablesTitle: string;
    tables: { name: string; body: string }[];
    rls: string;
    decisionsTitle: string;
    decisionsLead: string;
    tradeoffLabel: string;
    decisions: { title: string; body: string; tradeoff: string }[];
    shippingTitle: string;
    shippingLead: string;
    shipping: { title: string; body: string }[];
    limitsTitle: string;
    limitsLead: string;
    limits: { title: string; body: string }[];
    repoTitle: string;
    repoBody: string;
    repoLink: string;
  };
};

const en: SiteMessages = {
  meta: {
    title: 'WeighWay',
    description:
      'Your weight, your progress. A free mobile app — daily weigh-ins, BMI from your height history, and clear comparisons over time, with cloud sync in English and Polish.',
    releasesTitle: 'Releases — WeighWay',
    releasesDescription:
      'Latest versions, user-facing release notes, and mobile app downloads.',
    privacyTitle: 'Privacy Policy — WeighWay',
    privacyDescription:
      'How WeighWay collects, uses, stores, and deletes your account, weight, and height data.',
    termsTitle: 'Terms of Service — WeighWay',
    termsDescription:
      'Terms and conditions for using the WeighWay mobile app and this website.',
    geeksTitle: 'For Geeks — WeighWay',
    geeksDescription:
      'How WeighWay is built: the data model, BMI rules, row-level security, and the release pipeline.',
  },
  brand: 'WeighWay',
  nav: {
    home: 'Home',
    releases: 'Releases',
    menu: 'Open menu',
    close: 'Close menu',
  },
  language: {
    label: 'Language',
    system: 'System',
    english: 'English',
    polish: 'Polski',
  },
  theme: {
    label: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  home: {
    eyebrow: 'Your weight, your progress.',
    headline: 'Log your weight.\nSee the trend.\nStay consistent.',
    subhead:
      'A simple mobile app for daily weigh-ins, BMI tracking based on your height history, and clear comparisons across weeks, months, and years. Free for everyone — no ads, no feed, no noise.',
    downloadAndroid: 'Download for Android',
    downloadIos: 'Download for iOS',
    downloadUnavailableAndroid: 'Android build coming with the next release',
    downloadUnavailableIos: 'iOS build coming with the next release',
    openDemo: 'Try WeighWay',
    versionLabel: 'Latest',
    freeBadge: 'Free',
    platformsBadge: 'Android & iOS',
    privateBadge: 'Private by design',
    heroSliderNext: 'Show app preview',
    heroSliderPrev: 'Back to intro',
    preview: {
      latest: 'Latest weight',
      latestValue: '78.25 kg',
      bmi: 'BMI',
      bmiValue: '23.6',
      thisWeek: 'This week',
      thisWeekValue: '+0.35 kg',
      days30: '30 days',
      days30Value: '−1.2 kg',
    },
    highlightsTitle: 'The essentials',
    highlights: [
      {
        title: 'One weigh-in a day',
        body: 'Save today’s number in the selected unit. Logging the same date updates that entry — no duplicate rows.',
      },
      {
        title: 'BMI that follows height',
        body: 'Height can change over time. Each weigh-in uses the height that applied on that date, or is not displayed if none exists yet.',
      },
      {
        title: 'Your data in the cloud',
        body: 'All your data stays in sync. Install the app on another phone and pick up where you left off.',
      },
    ],
    featuresTitle: 'What you get',
    featuresSubtitle: 'Built for the habit of stepping on the scale — not for a dashboard full of noise.',
    features: [
      {
        title: 'Averages and highlights',
        body: 'See this week, last week, this month, and more — plus your heaviest and lightest points.',
      },
      {
        title: 'Compare periods',
        body: 'Stack weeks, months, years, or custom ranges next to each other and see how the average moved.',
      },
      {
        title: 'Your data, your account',
        body: 'Sign-in is required. Each person only sees their own entries. You can delete the account from Profile at any time.',
      },
      {
        title: 'Two languages, two themes',
        body: 'Use your system settings by default, or choose your preferred language and theme in Profile. The app is available in English and Polish, with both light and dark themes.',
      },
    ],
    audienceTitle: 'A habit without the pressure',
    audienceSubtitle: 'No social features, no streaks, no pressure — just the numbers you logged.',
    audience: [
      {
        title: 'Personal, not social',
        body: 'This is a private journal. There is no sharing, no leaderboard, and no one else in your weigh-ins.',
      },
      {
        title: 'Look at the bigger picture',
        body: 'Trends, averages, and period comparisons help you see movement without turning every day into a verdict.',
      },
      {
        title: 'You’re in control',
        body: 'Edit or remove a single day, manage height history, or delete the whole account. You decide how long your data stays in the app.',
      },
    ],
    screensTitle: 'Inside the app',
    screensSubtitle:
      'Four tabs, one calm flow — from today’s weigh-in to history, comparisons, and your profile.',
    screens: [
      {
        id: 'home',
        title: 'Home',
        body: 'Log a weigh-in, see the latest number, trend, and quick stats.',
      },
      {
        id: 'history',
        title: 'History',
        body: 'Scroll through past days, filter by date, and edit entries.',
      },
      {
        id: 'compare',
        title: 'Compare',
        body: 'Stack days, weeks, months, or years and see how the average moved.',
      },
      {
        id: 'profile',
        title: 'Profile',
        body: 'Height history, units, theme, language, and account settings.',
      },
    ],
    howTitle: 'How it works',
    howSubtitle: 'Three steps. Then your progress starts to take shape as you keep logging.',
    steps: [
      {
        title: 'Create an account',
        body: 'Sign up with email, confirm the link, and you are in. It’s your personal journal — your data is private to you.',
      },
      {
        title: 'Log a weigh-in',
        body: 'Pick the date, enter the weight, save. Optional height history unlocks BMI for that date.',
      },
      {
        title: 'See your progress take shape',
        body: 'Your data stays in sync across all screens. Install the app on any device and pick up where you left off.',
      },
    ],
    faqTitle: 'Common questions',
    faqSubtitle: 'Short answers before you install.',
    faq: [
      {
        question: 'Is the app free?',
        answer:
          'Yes. WeighWay is free to use. There are no ads and no paid plan on this site.',
      },
      {
        question: 'Do I need an account?',
        answer:
          'Yes. Sign-in keeps weigh-ins private to you and lets them sync across various devices. Other people cannot access your entries.',
      },
      {
        question: 'Can I use pounds?',
        answer:
          'Yes. Choose metric or imperial in Profile. Weight and height units follow that preference.',
      },
      {
        question: 'How is BMI calculated?',
        answer:
          'BMI uses the height that applied on that weigh-in date. If no height covers the date, BMI is not displayed. You can turn BMI off in Profile.',
      },
      {
        question: 'Can I delete my data?',
        answer:
          'Yes. Edit or delete individual weigh-ins and height records. Deleting the account from Profile removes your app data permanently.',
      },
      {
        question: 'Where do I download it?',
        answer:
          'Android: download the APK from this website. iOS: download the IPA from this website and install it with SideStore (free Apple ID; refresh about every 7 days). Install only from the official download links on this site.',
      },
    ],
    ctaTitle: 'Ready for the first weigh-in?',
    ctaBody: 'Download the free app for your platform, create an account, and log your first weigh-in.',
  },
  releases: {
    title: 'Releases',
    subtitle:
      'What changed in each version. The latest mobile app build is attached when a production release is available.',
    latest: 'Latest',
    downloadAndroid: 'Download for Android',
    downloadIos: 'Download for iOS',
    empty: 'No releases published yet.',
    noAndroidBuild: 'Android build not published for this version',
    noIosBuild: 'iOS build not published for this version',
    pendingTitle: 'Release notes coming soon',
    pendingBody:
      'We are preparing the detailed notes for this version and will publish them here shortly. You can download the app above in the meantime.',
    pendingContact: 'If they are still missing after a couple of days, let us know.',
  },
  privacy: {
    title: 'Privacy Policy',
    updatedLabel: 'Last update',
    updatedDate: 'September 28, 2026',
    lead:
      'This Privacy Policy explains how personal data is processed in connection with the WeighWay mobile app and this website (together, the “Service”).',
    sections: [
      {
        title: '1. Who we are',
        body:
          'The data controller responsible for your personal data is Adrian Prajsnar DEV (“we”, “us” or “the Controller”).\n\nFor privacy and data protection questions, you can contact us at:\n\nadrian.prajsnar.dev@outlook.com\n\nController’s address:\n\nOsiedle Tysiąclecia 1/114, 31-603 Kraków',
      },
      {
        title: '2. What data we process',
        body:
          'Depending on how you use the Service, we may process the following categories of data.\n\n### Account data\n\nThis may include:\n\n• your email address;\n• your user ID;\n• information required to authenticate and manage your account.\n\nPasswords are handled by our authentication provider. We do not store passwords in plain text.\n\n### Data you enter into the app\n\nYou may voluntarily enter:\n\n• weight measurements;\n• height history;\n• date of birth;\n• sex;\n• other information included in your profile, where the app allows you to provide it.\n\nWeight and height information, as well as information derived from it, such as BMI, may constitute data concerning health under applicable data protection laws depending on the context in which they are processed. We treat such data with appropriate safeguards.\n\n### Device and website preferences\n\nPreferences such as language, units and theme may be stored locally on your device.\n\nThis website may store similar display preferences, such as language and theme, in your browser. These preferences are used solely to provide the requested functionality and remember your settings.',
      },
      {
        title: '3. How we use your data',
        body:
          'We process your data for the following purposes:\n\n• creating and managing your account;\n• authenticating you;\n• synchronizing your data between devices;\n• storing and displaying your weight measurements and height history;\n• calculating and displaying BMI when the required information is available;\n• allowing you to edit and delete your data;\n• allowing you to delete your account;\n• maintaining the security and proper operation of the Service;\n• responding to support requests and communications;\n• complying with applicable legal obligations.\n\nWe do not use your weight, height, BMI or profile data for advertising, advertising profiling, selling personal data, or sharing data with data brokers.',
      },
      {
        title: '4. Legal bases for processing',
        body:
          '### Account data and provision of the Service\n\nWhere necessary to provide the Service you have requested, we process account data on the basis that the processing is necessary for the performance of our contract with you.\n\nWhere applicable, we may also process certain data where necessary to comply with a legal obligation or for our legitimate interests, provided that such processing is permitted by applicable law.\n\n### Health-related data\n\nWhere data processed through WeighWay constitutes data concerning health or other special category data under applicable data protection law, we rely on an appropriate legal basis under Article 6 and an applicable additional condition under Article 9.\n\nWhere explicit consent is the applicable condition, we will obtain your explicit consent before processing the relevant data for the specified purpose.\n\nYou may withdraw your consent at any time. Withdrawal of consent does not affect the lawfulness of processing carried out before withdrawal.\n\nIf you withdraw consent, some features of the Service that require the relevant data may no longer be available.\n\nFor users in the UK, special category data requires both a lawful basis under Article 6 of the UK GDPR and an additional condition under Article 9. Explicit consent is one possible Article 9 condition.\n\n### Optional profile information\n\nInformation such as date of birth or sex is optional unless explicitly stated otherwise in the app.\n\nWhere such information is not necessary for the core functionality of the Service, you may choose whether to provide it. Depending on the specific information and how it is used, we process it on the applicable legal basis under data protection law, including consent where required.',
      },
      {
        title: '5. Where your data is stored',
        body:
          'Account data and data entered into the application are stored using cloud infrastructure provided by Supabase, including its database and authentication services.\n\nUser data is associated with the relevant account identifier. We use access controls designed to ensure that users can access only data associated with their own accounts.\n\nSupabase allows customers to select the region in which their project is hosted. The WeighWay project is hosted in the region selected for the Service.\n\nSupabase provides data protection documentation and a Data Processing Agreement for customers.',
      },
      {
        title: '6. Service providers and recipients',
        body:
          'We use third-party service providers to operate and maintain WeighWay.\n\nIn particular:\n\nSupabase — provides cloud infrastructure, database and authentication services.\n\nThese providers may process personal data on our behalf only to the extent necessary to provide their services.\n\nWe do not sell personal data and do not share it with advertisers or data brokers.\n\nWe may disclose personal data where required by applicable law, a legally binding request from a competent authority, or where necessary to protect our legal rights, users or the security of the Service.',
      },
      {
        title: '7. International transfers',
        body:
          'Depending on the infrastructure and services used, your personal data may be processed in countries outside the European Economic Area (EEA) or the United Kingdom.\n\nWhere personal data is transferred internationally, we use an appropriate transfer mechanism and safeguards required by applicable data protection law, such as an adequacy decision or appropriate contractual safeguards where applicable.',
      },
      {
        title: '8. How long we keep your data',
        body:
          'We retain your personal data for as long as necessary to provide the Service and maintain your active account, unless a longer retention period is required by law.\n\nYou can:\n\n• edit your data;\n• delete individual weight measurements;\n• delete height records;\n• delete your account.\n\nWhen you delete your account, your application data is deleted from our active systems, subject to limited retention in backups or disaster-recovery systems.\n\nBackup copies may remain for a limited period until they are overwritten or securely deleted in accordance with the applicable backup retention cycle.',
      },
      {
        title: '9. Your rights',
        body:
          'Depending on your location and the applicable data protection law, you may have the right to:\n\n• access your personal data;\n• obtain a copy of your personal data;\n• correct inaccurate or incomplete data;\n• request deletion of your personal data;\n• request restriction of processing;\n• receive your personal data in a portable format;\n• object to certain processing;\n• withdraw consent where processing is based on consent.\n\nWithdrawal of consent does not affect the lawfulness of processing carried out before withdrawal.\n\nYou may also have the right to lodge a complaint with the relevant data protection supervisory authority.\n\nFor users in Poland, the relevant supervisory authority is the President of the Personal Data Protection Office (UODO).\n\nFor users in the UK, the relevant supervisory authority is the Information Commissioner’s Office (ICO).\n\nTo exercise your rights, contact us at:\n\nadrian.prajsnar.dev@outlook.com\n\nWe may request information reasonably necessary to verify your identity before fulfilling a request.\n\nWe will respond to valid requests within the time period required by applicable law.',
      },
      {
        title: '10. Security',
        body:
          'We use appropriate technical and organizational measures designed to protect personal data against unauthorized access, loss, destruction, alteration or disclosure.\n\nThese measures include, where applicable:\n\n• encrypted HTTPS/TLS connections;\n• user authentication;\n• access controls;\n• database Row Level Security (RLS);\n• restricting access to data according to the principle of least privilege.\n\nNo method of transmitting or storing data can be guaranteed to be completely secure.\n\nYou should also use a strong and unique password for your account and keep your login credentials confidential.',
      },
      {
        title: '11. Children',
        body:
          'WeighWay is intended for users aged 16 or older.\n\nIf you are under 16, you may use the Service only with the consent or authorization of a parent or legal guardian where required by applicable law.\n\nFor users in the EEA, the GDPR generally sets the age of consent for information society services at 16, although individual EU Member States may provide for a lower age, but not below 13.\n\nIf we learn that we have processed personal data from a child without the required consent or authorization, we will take appropriate steps to delete the data.',
      },
      {
        title: '12. Automated decision-making and profiling',
        body:
          'We do not use personal data to make decisions based solely on automated processing that produce legal effects or similarly significant effects on you.\n\nWe do not use your data for advertising profiling.',
      },
      {
        title: '13. Cookies and browser storage',
        body:
          'This website may use browser local storage or similar technologies to remember user preferences such as language or theme.\n\nWe do not use these mechanisms for advertising tracking or advertising profiling.\n\nIf we introduce additional cookies or tracking technologies that require consent under applicable law, this Privacy Policy and the relevant consent mechanisms will be updated before those technologies are used.',
      },
      {
        title: '14. Changes to this Privacy Policy',
        body:
          'We may update this Privacy Policy from time to time, for example when the Service, our data processing practices or applicable laws change.\n\nThe “Last updated” date at the bottom of this page will be updated whenever this Privacy Policy changes.\n\nIf we make material changes, we may notify you through the application, this website, or another appropriate method where required by applicable law.',
      },
      {
        title: '15. App distribution',
        body:
          'The mobile application is distributed through this website:\n\n• Android — as an APK file;\n• iOS — as an IPA file (install with SideStore or a similar tool).\n\nFor security reasons, we recommend installing WeighWay only from the official download links provided on this website.',
      },
      {
        title: '16. Contact',
        body:
          'If you have any questions about this Privacy Policy or how we process personal data, please contact:\n\nAdrian Prajsnar DEV\nadrian.prajsnar.dev@outlook.com',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updatedLabel: 'Last update',
    updatedDate: 'September 28, 2026',
    lead: 'By using WeighWay, you agree to these Terms of Service.',
    sections: [
      {
        title: '1. General',
        body:
          'These Terms of Service (“Terms”) govern your use of the WeighWay mobile app and this website (together, the “Service”), operated by Adrian Prajsnar DEV.\n\nIf you do not agree to these Terms, please do not use the Service.',
      },
      {
        title: '2. The Service',
        body:
          'WeighWay is a personal weight-tracking application. It allows you to record weight measurements, view history, trends and comparisons, and manage optional height history and profile settings.\n\nThe Service is provided free of charge and does not contain advertisements.',
      },
      {
        title: '3. Eligibility and accounts',
        body:
          'You must be at least 16 years old to use the Service. If you are under 16, you may use the Service only with the consent or authorization of a parent or legal guardian where required by applicable law.\n\nAn account is required to use the application.\n\nYou are responsible for keeping your login credentials confidential and for activity carried out through your account.',
      },
      {
        title: '4. Acceptable use',
        body:
          'You agree to use the Service lawfully and in a manner that does not infringe the rights of others or interfere with the operation of the Service.\n\nIn particular, you must not:\n\n• access or attempt to access another user’s account, data or systems without authorization;\n• reverse engineer, decompile or otherwise attempt to obtain the source code of the application, except where expressly permitted by applicable law;\n• interfere with or disrupt the Service or the infrastructure on which it operates;\n• upload malware, viruses or other harmful code or content;\n• use the Service for unlawful purposes.\n\nWe may suspend or terminate access to an account if you materially breach these Terms or applicable law, to the extent permitted by law.',
      },
      {
        title: '5. Health and medical disclaimer',
        body:
          'WeighWay is provided for personal informational purposes only and is not a substitute for professional medical advice.\n\nThe Service is not a medical device and does not provide medical diagnosis, treatment or individualized medical recommendations.\n\nBMI, trends and other information presented by the Service are estimates or informational calculations and should not be treated as medical advice or as a basis for making decisions about your health or treatment.\n\nAlways consult a doctor or other appropriately qualified healthcare professional regarding medical or health-related decisions.',
      },
      {
        title: '6. Your data',
        body:
          'You retain your rights to the data you enter into the Service, including your weight, height and profile data.\n\nYou grant us the limited right to store and process this data only to the extent necessary to provide and operate the Service for you, in accordance with these Terms and our Privacy Policy.\n\nInformation about how we process personal data, including the purposes and legal bases for processing, retention periods and your privacy rights, is described in our Privacy Policy.',
      },
      {
        title: '7. Intellectual property',
        body:
          'The WeighWay name, logo and branding, application, software, and website content, excluding data provided by users, are owned by Adrian Prajsnar DEV or its licensors.\n\nExcept as permitted by applicable law or expressly authorized by us, you may not copy, modify, distribute, reproduce or redistribute the application or its components outside the official distribution channels provided by us.',
      },
      {
        title: '8. Availability and operation of the Service',
        body:
          'We make reasonable efforts to keep the Service operational and available, but we do not guarantee uninterrupted availability.\n\nThe Service may occasionally be unavailable due to maintenance, updates, technical issues, failures, or issues affecting third-party services or infrastructure.\n\nWe do not guarantee that stored data will never be lost. If you have data that is important to you, we recommend keeping your own copy or record where appropriate.\n\nNothing in these Terms limits any mandatory consumer rights you may have under applicable law, including rights relating to the conformity of digital services.',
      },
      {
        title: '9. Digital service conformity and consumer rights',
        body:
          'If you are a consumer, you may have mandatory rights under applicable consumer protection laws concerning the conformity of digital services with the contract.\n\nThese Terms do not exclude or limit any consumer rights that cannot lawfully be excluded or limited.\n\nIf the Service does not conform to the contract, you may be entitled to the remedies provided by applicable law.\n\nWhere applicable, these rights may apply even though the Service is provided free of charge and you provide personal data instead of paying a monetary price.',
      },
      {
        title: '10. Liability',
        body:
          'To the fullest extent permitted by applicable law, we are not liable for indirect, incidental, special or consequential damages, or for loss of data, profits or other economic loss arising from your use of, or inability to use, the Service.\n\nWe are not responsible for interruptions or failures caused by circumstances outside our reasonable control, including failures of third-party services, infrastructure or networks.\n\nNothing in these Terms excludes or limits liability where such exclusion or limitation is prohibited by applicable law, including mandatory consumer protection rights.',
      },
      {
        title: '11. Termination',
        body:
          'You may stop using the Service at any time and delete your account using the account deletion feature available in the Profile section of the application.\n\nWe may suspend or terminate your access to the Service if you breach these Terms or applicable law, to the extent permitted by law.\n\nWe may also discontinue the Service or make significant changes to it, taking into account any rights you may have under applicable law.\n\nProvisions that by their nature should survive termination, including provisions concerning intellectual property, liability and the health and medical disclaimer, will survive termination.',
      },
      {
        title: '12. Changes to these Terms',
        body:
          'We may update these Terms from time to time, for example when the Service, our practices or applicable laws change.\n\nThe “Last updated” date at the bottom of this page will be updated whenever these Terms are changed.\n\nFor material changes, we may notify you through the Service, on this website, or by another appropriate means where required by applicable law.\n\nIf a change materially affects your rights or use of the Service, we will provide notice in advance where required by applicable law.\n\nYour continued use of the Service after the changes take effect constitutes acceptance of the updated Terms, subject to any rights you may have under applicable law.',
      },
      {
        title: '13. Governing law',
        body:
          'These Terms are governed by the laws of Poland.\n\nIf you are a consumer, nothing in these Terms deprives you of the protection provided by mandatory consumer protection laws of the country in which you reside.',
      },
      {
        title: '14. Contact',
        body:
          'If you have any questions about these Terms, please contact:\n\nAdrian Prajsnar DEV\nadrian.prajsnar.dev@outlook.com',
      },
    ],
  },
  legal: {
    tocLabel: 'On this page',
    minRead: 'min read',
    alsoRead: 'Also read',
  },
  footer: {
    tagline: 'Your weight, your progress.',
    legalNav: 'Legal',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    questions: 'Questions?',
    copyrightName: 'Adrian Prajsnar DEV',
    geeks: 'For Geeks',
  },
  demoModal: {
    title: 'Sample journal',
    close: 'Close sample journal',
    loading: 'Loading sample journal',
  },
  geeks: {
    eyebrow: 'For Geeks',
    title: 'For Geeks',
    lead:
      'A small product with accounts, a database, and a release pipeline. This page is the short version of the decisions behind it.',
    demoLink: 'Try WeighWay',
    architectureTitle: 'Where the data lives',
    architectureLead:
      'The phone talks to Supabase. The database, not the screen, decides which rows a signed-in person can see.',
    nodes: [
      {
        title: 'App',
        body: 'Expo and React Native, in TypeScript. English and Polish. Metric or imperial. Light, dark, or the device theme.',
      },
      {
        title: 'Sign-in',
        body: 'Email and password through Supabase Auth. The journal stays closed until there is a session. Password reset returns through the app’s own link.',
      },
      {
        title: 'Database',
        body: 'Postgres on Supabase. The app uses the public anon key. Row-level security is what keeps one account from reading another.',
      },
    ],
    tablesTitle: 'Three tables',
    tables: [
      {
        name: 'weight_entries',
        body: 'One row per person per calendar day. Weight is stored in kilograms. The primary key is the user and the date, so saving the same day updates that row.',
      },
      {
        name: 'height_entries',
        body: 'One height per effective date. A weigh-in uses the latest height on or before that day. If none covers the date, BMI is not shown.',
      },
      {
        name: 'user_profiles',
        body: 'Optional birth date and sex. They change how BMI is classified. A weight can be logged without them.',
      },
    ],
    rls: 'Select, insert, update, and delete on each table require the signed-in user to match the row. Deleting the account runs a database function that removes the auth user. Weight, height, and profile rows go with it. Anonymous visitors cannot run that function.',
    decisionsTitle: 'Decisions',
    decisionsLead: 'Each one is a constraint. The product stays small because these stayed in place.',
    tradeoffLabel: 'Tradeoff',
    decisions: [
      {
        title: 'One weigh-in a day',
        body: 'The day is the record. Editing Tuesday overwrites Tuesday.',
        tradeoff:
          'A log of every time someone steps on the scale would need a different key, and every average would have to decide which reading counts.',
      },
      {
        title: 'Height belongs to a date',
        body: 'BMI is computed in the app from the height that applied on the weigh-in date.',
        tradeoff:
          'Storing only the current height would change last year’s BMI whenever the profile changes.',
      },
      {
        title: 'Adult categories start at 20',
        body: 'From the 2nd birthday until the 20th, when sex is set, BMI is a CDC BMI-for-age percentile: an LMS lookup by sex and age in months, a z-score, then a percentile. From the 20th birthday it uses adult categories. Under 2, or before 20 without sex, the result stays unclassified.',
        tradeoff:
          'Adult cutoffs on a child’s weigh-in would show a category the reference data does not support.',
      },
      {
        title: 'The server holds the journal',
        body: 'There is no local database of weigh-ins. The device stores the session and a few preferences: language, theme, units, and whether BMI is shown. Without a connection, the app shows an offline screen.',
        tradeoff:
          'Logging without a network would need a queue of pending writes, and a rule for two phones editing the same day. That queue is not in the app.',
      },
    ],
    shippingTitle: 'How a version ships',
    shippingLead: 'A push to main is the release, when the commits call for one.',
    shipping: [
      {
        title: 'Version',
        body: 'Conventional commits. semantic-release chooses the next version and bumps the app version and the native build numbers.',
      },
      {
        title: 'Android',
        body: 'A production APK is built with EAS and attached to the GitHub Release.',
      },
      {
        title: 'iOS',
        body: 'An unsigned IPA is built on a GitHub-hosted Mac and attached to the same release. It installs with SideStore.',
      },
      {
        title: 'Notes',
        body: 'Customer-facing notes are written in English and Polish. Internal commits stay out. A note file that was already edited is not overwritten.',
      },
      {
        title: 'Site',
        body: 'This website is Astro, deployed to GitHub Pages on the same pipeline, in English and Polish.',
      },
    ],
    limitsTitle: 'Limits, on purpose',
    limitsLead: 'A few things are true today, and worth saying before they turn up in the repository.',
    limits: [
      {
        title: 'One database',
        body: 'Development and the published app share one Supabase project on the free tier. Row-level security isolates accounts. Schema changes are dated SQL files that add columns and tables. The full bootstrap script is for an empty project only.',
      },
      {
        title: 'No measurement analytics',
        body: 'There is no product analytics. Weight, height, and BMI are not sent to an analytics tool.',
      },
      {
        title: 'A scroll view is enough',
        body: 'History is a scroll view. That fits one person’s log. A virtualized list is the change if a long history gets slow to scroll.',
      },
    ],
    repoTitle: 'Source',
    repoBody: 'The app, the migrations, and this site are in one public repository.',
    repoLink: 'View on GitHub',
  },
};

export default en;
