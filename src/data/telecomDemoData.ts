export type OfferCategory = 'all' | 'internet' | 'calls' | 'wallet';

export interface TelecomDemoProfile {
  brandName: string;
  subscriberName: string;
  mobileNumber: string;
  planName: string;
  lineStatus: string;
  lineBalance: number;
  billAmount: number;
  currencyLabel: string;
  internet: {
    usedGb: number;
    totalGb: number;
    remainingMb: number;
    totalMb: number;
    remainingGb: number;
    renewalDate: string;
    daysLeft: number;
  };
  flexUnits: {
    remaining: number;
    total: number;
  };
  appVersion: string;
  defaultAddress: string;
}

export interface DemoOfferItem {
  id: string;
  category: Exclude<OfferCategory, 'all'>;
  categoryLabel: string;
  title: string;
  subtitle: string;
  badgeText: string;
  accentColor: string;
  bannerBg: string;
}

export interface DemoNotification {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  unread: boolean;
}

export interface ServiceItem {
  id: string;
  title: string;
  subtitle: string;
  actionType: 'navigate' | 'recharge' | 'bill' | 'notice';
  target?: 'offers' | 'internet' | 'wallet' | 'wallet-history' | 'more';
  noticeMessage?: string;
}

export interface ServiceGroup {
  id: string;
  heading: string;
  items: ServiceItem[];
}

export const TELECOM_DEMO_PROFILE: TelecomDemoProfile = {
  brandName: 'أنا فودافون',
  subscriberName: 'Mohamed Elfar',
  mobileNumber: '01020227288',
  planName: 'RED Essential',
  lineStatus: 'خط مفعّل',
  lineBalance: 0.13,
  billAmount: 85.0,
  currencyLabel: 'جنيه',
  internet: {
    usedGb: 16.5,
    totalGb: 32,
    remainingMb: 15477,
    totalMb: 31964,
    remainingGb: 15.5,
    renewalDate: '16 ديسمبر 2026',
    daysLeft: 25,
  },
  flexUnits: {
    remaining: 1420,
    total: 2000,
  },
  appVersion: '2026.11.3',
  defaultAddress: 'القاهرة الجديدة، التجمع الخامس',
};

export const INITIAL_DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: 'notif-1',
    title: 'استهلاك باقة الإنترنت',
    body: 'متبقي لديك 15477 ميجا من باقة الإنترنت حتى موعد التجديد بعد 25 يوم.',
    timeLabel: 'منذ ساعتين',
    unread: true,
  },
  {
    id: 'notif-2',
    title: 'حركة محفظة فودافون كاش',
    body: 'تم استلام مبلغ 3,500.00 ج.م بنجاح في محفظتك.',
    timeLabel: 'اليوم · 08:42 ص',
    unread: true,
  },
  {
    id: 'notif-3',
    title: 'عرض كاش باك الأقساط',
    body: 'احصل على كاش باك لحد 100 جنيه لما تدفع أقساطك بفودافون كاش.',
    timeLabel: 'أمس',
    unread: false,
  },
];

export const OFFER_CATEGORIES: { id: OfferCategory; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'internet', label: 'إنترنت' },
  { id: 'calls', label: 'مكالمات' },
  { id: 'wallet', label: 'فودافون كاش' },
];

export const DEMO_OFFERS: DemoOfferItem[] = [
  {
    id: 'offer-1',
    category: 'internet',
    categoryLabel: 'عروض RED',
    title: 'خصومات إضافية حتى 20%',
    subtitle: 'لما تقسط ببطاقات ائتمان CIB · 0% مصاريف إدارية · 0% مقدم · حتى 24 شهر',
    badgeText: 'RED',
    accentColor: '#E60000',
    bannerBg: '#FEF2F2',
  },
  {
    id: 'offer-2',
    category: 'wallet',
    categoryLabel: 'فودافون كاش',
    title: 'كاش باك لحد 100 جنيه',
    subtitle: 'لما تدفع أقساطك وفواتيرك بمحفظة فودافون كاش بسهولة وأمان.',
    badgeText: 'كاش باك',
    accentColor: '#0F766E',
    bannerBg: '#F0FDFA',
  },
  {
    id: 'offer-3',
    category: 'calls',
    categoryLabel: 'عروض المكالمات',
    title: '500 دقيقة إضافية لكل الشبكات',
    subtitle: 'استمتع بدقائق إضافية صالحة لمدة 7 أيام عند التجديد في الموعد.',
    badgeText: 'هدية',
    accentColor: '#1D4ED8',
    bannerBg: '#EFF6FF',
  },
  {
    id: 'offer-4',
    category: 'internet',
    categoryLabel: 'عروض الإنترنت',
    title: 'ضعف باقة الإنترنت الشهرية',
    subtitle: 'ضاعف ميجابايت باقتك الشهرية لفترة محدودة.',
    badgeText: 'ضعف الباقة',
    accentColor: '#B45309',
    bannerBg: '#FFFBEB',
  },
];

export const ORGANIZED_SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: 'grp-line',
    heading: 'خدمات الخط والرصيد',
    items: [
      {
        id: 'srv-recharge',
        title: 'شحن الرصيد',
        subtitle: 'شحن فوري للخط',
        actionType: 'recharge',
      },
      {
        id: 'srv-bills',
        title: 'دفع الفواتير',
        subtitle: 'سداد فاتورة الموبايل',
        actionType: 'bill',
      },
      {
        id: 'srv-salefny',
        title: 'سلفني شكرًا',
        subtitle: 'رصيد طوارئ فوري',
        actionType: 'notice',
        noticeMessage: 'تم التحقق: خطك مؤهل لخدمة سلفني شكرًا حتى 32 جنيه.',
      },
      {
        id: 'srv-transfer-credit',
        title: 'تحويل رصيد',
        subtitle: 'لأرقام فودافون',
        actionType: 'notice',
        noticeMessage: 'يمكنك تحويل الأموال فوراً عبر محفظة فودافون كاش.',
      },
    ],
  },
  {
    id: 'grp-digital',
    heading: 'الإنترنت والمحفظة',
    items: [
      {
        id: 'srv-internet',
        title: 'باقات الإنترنت',
        subtitle: 'إدارة الباقة والاستهلاك',
        actionType: 'navigate',
        target: 'internet',
      },
      {
        id: 'srv-wallet',
        title: 'فودافون كاش',
        subtitle: 'تحويل، إيداع، سحب ATM',
        actionType: 'navigate',
        target: 'wallet',
      },
      {
        id: 'srv-history',
        title: 'سجل المعاملات',
        subtitle: 'كشف حساب المحفظة',
        actionType: 'navigate',
        target: 'wallet-history',
      },
      {
        id: 'srv-roaming',
        title: 'خدمات التجوال',
        subtitle: 'باقات السفر الدولي',
        actionType: 'navigate',
        target: 'offers',
      },
    ],
  },
];
