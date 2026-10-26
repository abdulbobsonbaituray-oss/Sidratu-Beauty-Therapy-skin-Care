import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  HelpCircle,
  LogIn,
  ShieldCheck,
  CalendarPlus,
  History,
  Sparkles,
  MessageCircleHeart,
  CheckCircle2,
  Clock,
  PlusCircle,
  Bot,
  Search,
  UserPlus,
  CalendarCheck,
  FileSpreadsheet,
  Save,
  Printer,
  MessageSquare,
  X,
  LogOut,
  BookOpenCheck,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Send,
  RefreshCw,
  AlertTriangle,
  Trash2,
  BarChart3,
  Camera,
  StickyNote,
  LayoutDashboard,
  Download,
  Smartphone,
  Cake,
  Lock,
  TrendingUp,
  Award,
  PenTool
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import GeminiAssistantHub from './components/GeminiAssistantHub';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
  OperationType,
  handleFirestoreError,
  isFirebaseBootstrappedAdmin,
  syncClientProfileToFirestore,
  saveAppointmentToFirestore,
  respondToAppointmentInFirestore,
  deleteAppointmentFromFirestore,
  saveHistoryToFirestore,
  respondToHistoryInFirestore,
  deleteHistoryFromFirestore,
  deleteClientFromFirestore,
  User
} from './firebase';

interface Appointment {
  id: string;
  treatment: string;
  date: string;
  time: string;
  notes: string;
  consentSignedBy: string;
  createdAt: string;
  status?: 'Confirmed' | 'Responded' | 'Completed';
  adminResponse?: string;
  adminRespondedBy?: string;
  adminRespondedAt?: string;
  frequency?: 'None' | 'Weekly' | 'Monthly';
}

interface HistoryEntry {
  id: string;
  dayDateTime: string;
  treatment: string;
  ratingOrPayment: string;
  specialist: string;
  notes: string;
  photoBase64?: string;
  specialistNotes?: string;
  adminResponse?: string;
  adminRespondedBy?: string;
  adminRespondedAt?: string;
}

interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  allergies: string;
  dob?: string;
  avatarBase64?: string;
  newAppointments: Appointment[];
  pastHistory: HistoryEntry[];
  quickNotes?: string;
}

interface AdminConfig {
  owners: string[];
  secretaries: string[];
  security: string[];
}

type Role = 'Owner' | 'Secretary' | 'Security' | 'Customer';

const PRIMARY_ADMIN_EMAIL = 'Sidratu82sesay@gmail.com';
const SIDRATU_ADMIN_EMAIL = 'Sidratu82sesay@gmail.com';
const SECONDARY_ADMIN_EMAIL = 'abdulbobsonbaituray@gmail.com';
const SIDRATU_ADMIN_PHONES = ['+232 77 533830', '+23277533830', '033545691', '076553254'];
const ADMIN_ACCESS_PASSWORD = '@sidratu82';

const REQUIRED_OWNER_IDENTIFIERS = [
  PRIMARY_ADMIN_EMAIL,
  SECONDARY_ADMIN_EMAIL,
  ...SIDRATU_ADMIN_PHONES,
  'abdul@sidratubeauty.com',
  'abdulbobsonturay@gmail.com',
  '+23277000001'
];

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  owners: REQUIRED_OWNER_IDENTIFIERS,
  secretaries: [
    'secretary@sidratubeauty.com',
    '+23277000002'
  ],
  security: [
    'security@sidratubeauty.com',
    '+23277000003'
  ]
};

interface AdminSignatureConfig {
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signatureStyle: 'script' | 'formal' | 'stamp';
  verificationNote: string;
  customAccessCode: string;
}

const DEFAULT_ADMIN_SIGNATURE: AdminSignatureConfig = {
  signerName: 'Sidratu Sesay',
  signerTitle: 'Founder & Lead Aesthetician',
  signerEmail: PRIMARY_ADMIN_EMAIL,
  signatureStyle: 'script',
  verificationNote: 'Official Clinic Authorization · 101 Jomo Kenyatta Road, Freetown',
  customAccessCode: ADMIN_ACCESS_PASSWORD
};

const ADMIN_SIGNATURE_PRESETS: Array<Omit<AdminSignatureConfig, 'customAccessCode'>> = [
  {
    signerName: 'Sidratu Sesay',
    signerTitle: 'Founder & Lead Aesthetician',
    signerEmail: PRIMARY_ADMIN_EMAIL,
    signatureStyle: 'script',
    verificationNote: 'Official Clinic Authorization · 101 Jomo Kenyatta Road, Freetown'
  },
  {
    signerName: 'Abdul Bobson Baituray',
    signerTitle: 'Managing Director & Clinic Admin',
    signerEmail: SECONDARY_ADMIN_EMAIL,
    signatureStyle: 'formal',
    verificationNote: 'Executive Administration · Sidratu Beauty Therapy Skin Care'
  },
  {
    signerName: 'Sidratu Clinic Secretary',
    signerTitle: 'Front Desk & Clinical Records Officer',
    signerEmail: PRIMARY_ADMIN_EMAIL,
    signatureStyle: 'stamp',
    verificationNote: 'Verified Front Desk Ledger · 101 Jomo Kenyatta Road, Freetown'
  }
];

const CLINIC_SERVICE_TARIFFS_SLE: Record<string, { tariffSLE: number; category: string }> = {
  'HydraFacial Luxury Glow': { tariffSLE: 1450, category: 'Facial & Skin Therapy' },
  'Chemical Peel & Pigmentation Care': { tariffSLE: 1200, category: 'Facial & Skin Therapy' },
  'Microneedling & Acne Scar Repair': { tariffSLE: 1650, category: 'Facial & Skin Therapy' },
  'PRP (Platelet-Rich Plasma) Rejuvenation': { tariffSLE: 2400, category: 'Facial & Skin Therapy' },
  'Skin Tag & Mole Removal': { tariffSLE: 950, category: 'Facial & Skin Therapy' },
  'Laser Teeth Whitening': { tariffSLE: 1800, category: 'Dental & Smile Aesthetics' },
  'Dental Braces Consultation & Fitting': { tariffSLE: 3500, category: 'Dental & Smile Aesthetics' },
  'Teeth Filling & Dental Restoration': { tariffSLE: 1100, category: 'Dental & Smile Aesthetics' },
  'Tooth Scaling & Polishing': { tariffSLE: 850, category: 'Dental & Smile Aesthetics' },
  'Non-Surgical Nose Lift': { tariffSLE: 2800, category: 'Body & Specialty Aesthetics' },
  'Full Body Detox Scrub & Polish': { tariffSLE: 1350, category: 'Body & Specialty Aesthetics' },
  'IV Glutathione & Vitamin Glow Drip': { tariffSLE: 1900, category: 'Body & Specialty Aesthetics' }
};

function getServiceTariffAndCategory(treatmentName: string): { tariffSLE: number; category: string } {
  const clean = (treatmentName || '').trim();
  if (CLINIC_SERVICE_TARIFFS_SLE[clean]) {
    return CLINIC_SERVICE_TARIFFS_SLE[clean];
  }
  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(CLINIC_SERVICE_TARIFFS_SLE)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return val;
    }
  }
  if (lower.includes('prp') || lower.includes('plasma')) {
    return { tariffSLE: 2400, category: 'Facial & Skin Therapy' };
  }
  if (lower.includes('brace') || lower.includes('orthodont')) {
    return { tariffSLE: 3500, category: 'Dental & Smile Aesthetics' };
  }
  if (lower.includes('whiten') || lower.includes('dental') || lower.includes('tooth') || lower.includes('teeth')) {
    return { tariffSLE: 1250, category: 'Dental & Smile Aesthetics' };
  }
  if (lower.includes('glutathione') || lower.includes('iv ') || lower.includes('drip') || lower.includes('body')) {
    return { tariffSLE: 1800, category: 'Body & Specialty Aesthetics' };
  }
  return { tariffSLE: 1300, category: 'Facial & Skin Therapy' };
}

function extractSessionRevenueSLE(treatmentName: string, ratingOrPayment?: string): number {
  const raw = (ratingOrPayment || '').trim();
  if (raw) {
    const currencyMatch = raw.match(/(?:SLE|Le|NLe|\$)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)/i);
    if (currencyMatch && currencyMatch[1]) {
      const parsed = parseFloat(currencyMatch[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }
    const withoutReceiptOrRating = raw
      .replace(/#\s*[0-9]+/g, '')
      .replace(/[0-9]\s*\/\s*[0-9]/g, '');
    const standaloneMatch = withoutReceiptOrRating.match(/\b([1-9][0-9]{2,5})\b/);
    if (standaloneMatch && standaloneMatch[1]) {
      const parsed = parseInt(standaloneMatch[1], 10);
      if (!isNaN(parsed) && parsed >= 100) {
        return parsed;
      }
    }
  }
  return getServiceTariffAndCategory(treatmentName).tariffSLE;
}

function normalizeIdentifier(val: string): string {
  const trimmed = val.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  return trimmed.replace(/[\s\-()]/g, '');
}

function getClientInitials(name: string): string {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'CL'
  );
}

interface PatientAgeInfo {
  years: number;
  months: number;
  label: string;
  detailedLabel: string;
  category: string;
  clinicalGuidance: string;
  skinProtocol: string;
  dentalProtocol: string;
  consentRequirement: string;
  isMinor: boolean;
  isBirthdayMonth: boolean;
}

function calculatePatientAge(dobStr?: string): PatientAgeInfo | null {
  if (!dobStr || !dobStr.trim()) return null;
  const parts = dobStr.trim().split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const dob = new Date(year, month, day);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  if (today.getDate() < dob.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0 || years > 125) return null;

  const isMinor = years < 18;
  const isBirthdayMonth = today.getMonth() === dob.getMonth();
  let category = 'Adult Clinical Profile';
  let clinicalGuidance = 'Standard adult aesthetic & dental protocols apply';
  let skinProtocol = 'Balanced barrier maintenance, antioxidants & targeted brightening';
  let dentalProtocol = 'Routine ultrasonic scaling, polishing & enamel-safe whitening';
  let consentRequirement = 'Standard Adult Patient Consent';

  if (years < 18) {
    category = 'Pediatric / Minor (<18 yrs)';
    clinicalGuidance = 'Guardian consent required · Use gentle, non-ablative formulations only';
    skinProtocol = 'Gentle soothing cleansers & barrier repair; avoid high-strength chemical peels or ablative lasers';
    dentalProtocol = 'Preventative prophylaxis, fluoride protection & orthodontic alignment assessment; defer high-peroxide bleaching';
    consentRequirement = 'Parent / Legal Guardian Co-Signature Mandatory (<18)';
  } else if (years < 30) {
    category = 'Young Adult (18–29 yrs)';
    clinicalGuidance = 'Focus on barrier protection, acne control & preventative aesthetics';
    skinProtocol = 'HydraFacial clarifying, sebum regulation, post-inflammatory dark spot prevention & broad-spectrum SPF';
    dentalProtocol = 'Ultrasonic scaling, stain polishing, orthodontic braces consultation & sensitivity-safe whitening';
    consentRequirement = 'Standard Adult Consent Eligible (18+)';
  } else if (years < 50) {
    category = 'Adult Clinical (30–49 yrs)';
    clinicalGuidance = 'Eligible for full cellular renewal, PRP microneedling & brightening protocols';
    skinProtocol = 'Collagen induction (PRP), anti-melasma brightening, targeted resurfacing & deep antioxidant infusion';
    dentalProtocol = 'Laser teeth whitening (up to 16% peroxide with desensitizer), periodontal maintenance & aesthetic alignment';
    consentRequirement = 'Standard Adult Consent Eligible (18+)';
  } else {
    category = 'Mature / Senior Care (50+ yrs)';
    clinicalGuidance = 'Delicate barrier & vascular care · Prioritize lipid replenishment & gentle hydration';
    skinProtocol = 'Lipid-rich barrier restoration, gentle radiofrequency/lifting & low-irritation renewal; monitor skin elasticity';
    dentalProtocol = 'Gentle root/gingival scaling, low-sensitivity enamel care & restorative comfort check';
    consentRequirement = 'Standard Adult Consent · Review Systemic Medications';
  }

  const label =
    years === 0
      ? `${months} ${months === 1 ? 'month' : 'months'} old`
      : `${years} ${years === 1 ? 'yr' : 'yrs'} old`;
  const detailedLabel =
    years === 0
      ? `${months} ${months === 1 ? 'month' : 'months'} old`
      : months > 0
      ? `${years} ${years === 1 ? 'yr' : 'yrs'}, ${months} ${months === 1 ? 'mo' : 'mos'} old`
      : `${years} ${years === 1 ? 'yr' : 'yrs'} old`;

  return {
    years,
    months,
    label,
    detailedLabel,
    category,
    clinicalGuidance,
    skinProtocol,
    dentalProtocol,
    consentRequirement,
    isMinor,
    isBirthdayMonth
  };
}

const INITIAL_CLIENTS: ClientRecord[] = [
  {
    id: 'client_1',
    name: 'Mariatu Sesay',
    phone: '+23276554433',
    email: 'mariatu@example.com',
    address: '18 Wilkinson Road, Freetown',
    allergies: 'Sensitive skin, mild benzoyl peroxide sensitivity',
    dob: '1995-04-12',
    quickNotes: 'VIP Loyalty Client · Needs Birthday Discount in April · Prefers morning appointments.',
    newAppointments: [
      {
        id: 'appt_today_1',
        treatment: 'HydraFacial Luxury Glow',
        date: new Date().toISOString().split('T')[0],
        time: '11:30',
        frequency: 'Monthly',
        notes: 'Focus on forehead hyperpigmentation',
        consentSignedBy: 'Mariatu Sesay',
        createdAt: 'Monday, Oct 19, 2026 — 10:15 AM',
        status: 'Responded',
        adminResponse: 'Confirmed for 11:30 AM. Please avoid exfoliating acids 48h prior to your visit.',
        adminRespondedBy: PRIMARY_ADMIN_EMAIL,
        adminRespondedAt: 'Monday, Oct 19, 2026 — 10:30 AM'
      }
    ],
    pastHistory: [
      {
        id: 'hist_1',
        dayDateTime: 'Saturday, Oct 3, 2026 — 2:15 PM',
        treatment: 'Laser Teeth Whitening',
        ratingOrPayment: 'Paid SLE 1,800 Cash (Receipt #089) · Glowing & Smooth (5/5)',
        specialist: 'Senior Dental Aesthetician',
        notes: 'Shade improved by 4 levels. Advised 48hr stain-free diet.',
        specialistNotes: 'Used 16% hydrogen peroxide gel with desensitizing potassium nitrate serum. Zero gingival irritation.',
        adminResponse: 'Wonderful progress! Continue using sensitivity toothpaste for 1 week.',
        adminRespondedBy: PRIMARY_ADMIN_EMAIL,
        adminRespondedAt: 'Sunday, Oct 4, 2026 — 9:15 AM'
      },
      {
        id: 'hist_1b',
        dayDateTime: 'Saturday, Aug 22, 2026 — 11:00 AM',
        treatment: 'HydraFacial Luxury Glow',
        ratingOrPayment: 'Paid SLE 1,450 Cash (Receipt #041) · Glowing & Smooth (5/5)',
        specialist: 'Sidratu Sesay',
        notes: 'Deep vortex extraction and antioxidant peptide infusion completed.',
        specialistNotes: 'Client responded well to hyaluronic booster.'
      }
    ]
  },
  {
    id: 'client_2',
    name: 'Ibrahim Koroma',
    phone: '+23277889900',
    email: 'ibrahim@example.com',
    address: '42 Spur Road, Freetown',
    allergies: 'None',
    dob: '1989-11-23',
    quickNotes: 'Upcoming orthodontic braces follow-up package.',
    newAppointments: [
      {
        id: 'appt_2',
        treatment: 'Dental Braces Consultation & Fitting',
        date: '2026-10-20',
        time: '14:00',
        frequency: 'Monthly',
        notes: 'Upper arch alignment consultation',
        consentSignedBy: 'Ibrahim Koroma',
        createdAt: 'Monday, Oct 19, 2026 — 11:40 AM',
        status: 'Confirmed'
      },
      {
        id: 'appt_2b',
        treatment: 'HydraFacial Luxury Glow',
        date: '2026-10-28',
        time: '16:00',
        frequency: 'Monthly',
        notes: 'Pre-event skin brightening session',
        consentSignedBy: 'Ibrahim Koroma',
        createdAt: 'Tuesday, Oct 20, 2026 — 09:30 AM',
        status: 'Confirmed'
      }
    ],
    pastHistory: [
      {
        id: 'hist_2',
        dayDateTime: 'Wednesday, Sep 16, 2026 — 1:00 PM',
        treatment: 'Tooth Scaling & Polishing',
        ratingOrPayment: 'Paid SLE 850 Cash (Receipt #054)',
        specialist: 'Clinic Dental Officer',
        notes: 'Completed full ultrasonic scaling. Ready for orthodontic assessment.',
        specialistNotes: 'Mild supragingival calculus cleared on lower anterior teeth.'
      },
      {
        id: 'hist_2b',
        dayDateTime: 'Thursday, Sep 24, 2026 — 3:30 PM',
        treatment: 'PRP (Platelet-Rich Plasma) Rejuvenation',
        ratingOrPayment: 'Paid SLE 2,400 Mobile Money (Receipt #068) · Glowing & Smooth (5/5)',
        specialist: 'Sidratu Sesay',
        notes: 'First session of under-eye and cheek collagen induction.',
        specialistNotes: 'Centrifuged autologous PRP applied with 1.0mm microneedling.'
      }
    ]
  }
];

function getFormattedDayDateTime(): string {
  const now = new Date();
  return (
    now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) +
    ' — ' +
    now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  );
}

export default function App() {
  // Persistent state
  const [clientsDB, setClientsDB] = useState<ClientRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sidratu_clients_db');
      if (saved) {
        const parsed: ClientRecord[] = JSON.parse(saved);
        return parsed.map(c => ({
          ...c,
          newAppointments: (c.newAppointments || []).map((a, i) => ({
            ...a,
            id: a.id || `appt_${c.id}_${i}`,
            adminRespondedBy:
              a.adminRespondedBy === 'abdulbobsonbaituray@gmail.com'
                ? PRIMARY_ADMIN_EMAIL
                : a.adminRespondedBy
          })),
          pastHistory: (c.pastHistory || []).map((h, i) => ({
            ...h,
            id: h.id || `hist_${c.id}_${i}`,
            adminRespondedBy:
              h.adminRespondedBy === 'abdulbobsonbaituray@gmail.com'
                ? PRIMARY_ADMIN_EMAIL
                : h.adminRespondedBy
          }))
        }));
      }
      return INITIAL_CLIENTS;
    } catch {
      return INITIAL_CLIENTS;
    }
  });

  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() => {
    try {
      const saved = localStorage.getItem('sidratu_admin_config');
      if (saved) {
        const parsed: AdminConfig = JSON.parse(saved);
        const existingNormalized = new Set(
          (parsed.owners || []).map(x => normalizeIdentifier(x))
        );
        const mergedOwners = [...(parsed.owners || [])];
        for (const reqId of REQUIRED_OWNER_IDENTIFIERS) {
          if (!existingNormalized.has(normalizeIdentifier(reqId))) {
            mergedOwners.push(reqId);
          }
        }
        parsed.owners = mergedOwners;
        return parsed;
      }
      return DEFAULT_ADMIN_CONFIG;
    } catch {
      return DEFAULT_ADMIN_CONFIG;
    }
  });

  const [currentUser, setCurrentUser] = useState<(ClientRecord & { role: Role }) | null>(null);
  const [mainView, setMainView] = useState<'admin' | 'customer'>('customer');
  const [customerSection, setCustomerSection] = useState<
    'new-appointment' | 'past-history' | 'services-goals' | 'ai-community' | 'dashboard'
  >('dashboard');

  // Toast / Inline Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 5000);
  };

  // Login Form State
  const [loginName, setLoginName] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginAddress, setLoginAddress] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showAdminPasswordField, setShowAdminPasswordField] = useState(false);

  // Firebase Auth & Real-Time Firestore State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [drawerAdminPassword, setDrawerAdminPassword] = useState('');
  const [showDrawerAdminUnlock, setShowDrawerAdminUnlock] = useState(false);

  // Customer Appointment Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [apptTreatment, setApptTreatment] = useState('HydraFacial Luxury Glow');
  const [apptTreatmentSearch, setApptTreatmentSearch] = useState('');
  const [apptCustomTreatment, setApptCustomTreatment] = useState('');
  const [apptDate, setApptDate] = useState(todayStr);
  const [apptTime, setApptTime] = useState('11:00');
  const [apptFrequency, setApptFrequency] = useState<'None' | 'Weekly' | 'Monthly'>('None');
  const [apptNotes, setApptNotes] = useState('');
  const [apptConsentCheck, setApptConsentCheck] = useState(false);
  const [apptConsentSignature, setApptConsentSignature] = useState('');

  // Customer History Form State
  const [histTreatment, setHistTreatment] = useState('');
  const [histRating, setHistRating] = useState('Glowing & Smooth (5/5)');
  const [histNotes, setHistNotes] = useState('');
  const [historySortOrder, setHistorySortOrder] = useState<
    'date-newest' | 'date-oldest' | 'treatment-asc' | 'treatment-desc'
  >('date-newest');

  // Selected Goals in Treatments & Goals tab
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['Clear, Even-Toned Skin']);

  // Care Guide Interactive Question Filter
  const [careQuestionFilter, setCareQuestionFilter] = useState<'all' | 'skin' | 'dental' | 'body'>('all');

  // Admin Portal State
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clientsDB[0]?.id || 'client_1'
  );
  const [summaryViewFilter, setSummaryViewFilter] = useState<'all' | 'booked' | 'completed'>('all');

  // Official Admin Signature & Access Configuration ("change admin sig")
  const [adminSignature, setAdminSignature] = useState<AdminSignatureConfig>(() => {
    try {
      const saved = localStorage.getItem('sidratu_admin_signature');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_ADMIN_SIGNATURE,
          ...parsed,
          customAccessCode: parsed.customAccessCode || ADMIN_ACCESS_PASSWORD
        };
      }
      return DEFAULT_ADMIN_SIGNATURE;
    } catch {
      return DEFAULT_ADMIN_SIGNATURE;
    }
  });
  const [isEditingAdminSig, setIsEditingAdminSig] = useState(false);
  const [sigDraftName, setSigDraftName] = useState(adminSignature.signerName);
  const [sigDraftTitle, setSigDraftTitle] = useState(adminSignature.signerTitle);
  const [sigDraftEmail, setSigDraftEmail] = useState(adminSignature.signerEmail);
  const [sigDraftStyle, setSigDraftStyle] = useState<'script' | 'formal' | 'stamp'>(
    adminSignature.signatureStyle
  );
  const [sigDraftNote, setSigDraftNote] = useState(adminSignature.verificationNote);
  const [sigDraftCode, setSigDraftCode] = useState(
    adminSignature.customAccessCode || ADMIN_ACCESS_PASSWORD
  );

  const saveAdminSignatureChanges = (
    overridePreset?: Omit<AdminSignatureConfig, 'customAccessCode'>
  ) => {
    const nextConfig: AdminSignatureConfig = overridePreset
      ? {
          ...overridePreset,
          customAccessCode: sigDraftCode.trim() || ADMIN_ACCESS_PASSWORD
        }
      : {
          signerName: sigDraftName.trim() || 'Sidratu Sesay',
          signerTitle: sigDraftTitle.trim() || 'Founder & Lead Aesthetician',
          signerEmail: sigDraftEmail.trim() || PRIMARY_ADMIN_EMAIL,
          signatureStyle: sigDraftStyle,
          verificationNote:
            sigDraftNote.trim() ||
            'Official Clinic Authorization · 101 Jomo Kenyatta Road, Freetown',
          customAccessCode: sigDraftCode.trim() || ADMIN_ACCESS_PASSWORD
        };

    setAdminSignature(nextConfig);
    setSigDraftName(nextConfig.signerName);
    setSigDraftTitle(nextConfig.signerTitle);
    setSigDraftEmail(nextConfig.signerEmail);
    setSigDraftStyle(nextConfig.signatureStyle);
    setSigDraftNote(nextConfig.verificationNote);
    setSigDraftCode(nextConfig.customAccessCode);
    setSheetSecSpecialist(`${nextConfig.signerName} (${nextConfig.signerEmail})`);
    try {
      localStorage.setItem('sidratu_admin_signature', JSON.stringify(nextConfig));
    } catch {
      // ignore
    }
    setIsEditingAdminSig(false);
    showNotification(
      `Admin signature updated to "${nextConfig.signerName} — ${nextConfig.signerTitle}".`
    );
  };

  // Admin Record Sheet Editable State
  const [sheetVisitDateTime, setSheetVisitDateTime] = useState(getFormattedDayDateTime());
  const [sheetClientName, setSheetClientName] = useState('');
  const [sheetClientPhone, setSheetClientPhone] = useState('');
  const [sheetClientEmail, setSheetClientEmail] = useState('');
  const [sheetClientAddress, setSheetClientAddress] = useState('');
  const [sheetClientAllergies, setSheetClientAllergies] = useState('');
  const [sheetClientDOB, setSheetClientDOB] = useState('');
  const [sheetClientAvatar, setSheetClientAvatar] = useState<string | null>(null);
  const [sheetSecTreatment, setSheetSecTreatment] = useState('');
  const [sheetSecPayment, setSheetSecPayment] = useState('');
  const [sheetSecSpecialist, setSheetSecSpecialist] = useState('');
  const [sheetSecNotes, setSheetSecNotes] = useState('');
  const [sheetSecSpecialistNotes, setSheetSecSpecialistNotes] = useState('');
  const [sheetSecPhoto, setSheetSecPhoto] = useState<string | null>(null);
  const [emergencyModalClient, setEmergencyModalClient] = useState<ClientRecord | null>(null);
  const [sheetQuickNotes, setSheetQuickNotes] = useState('');
  const [clientPendingDelete, setClientPendingDelete] = useState<ClientRecord | null>(null);
  const [specialistNoteDrafts, setSpecialistNoteDrafts] = useState<Record<string, string>>({});

  // Live Camera Capture State for Before/After Progress Photos
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const lastLoadedClientIdRef = useRef<string | null>(null);

  // Live Camera Capture State for Client Profile Avatar Photo
  const [avatarCameraActive, setAvatarCameraActive] = useState(false);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const avatarCameraStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const stopAvatarCamera = () => {
    if (avatarCameraStreamRef.current) {
      avatarCameraStreamRef.current.getTracks().forEach(t => t.stop());
      avatarCameraStreamRef.current = null;
    }
    setAvatarCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      cameraStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);
    } catch {
      showNotification('Camera access unavailable or denied. Please use the file upload button instead.');
    }
  };

  const startAvatarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      avatarCameraStreamRef.current = stream;
      setAvatarCameraActive(true);
      setTimeout(() => {
        if (avatarVideoRef.current) {
          avatarVideoRef.current.srcObject = stream;
          avatarVideoRef.current.play().catch(() => {});
        }
      }, 80);
    } catch {
      showNotification('Camera access unavailable or denied. Please use the photo upload button instead.');
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setSheetSecPhoto(dataUrl);
      stopCamera();
      showNotification('Before/After progress photo captured and attached to Record Sheet.');
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (avatarCameraStreamRef.current) {
        avatarCameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // LocalStorage Sync Status Tracking ('saved' | 'saving' | 'unsynced')
  const [storageSyncState, setStorageSyncState] = useState<'saved' | 'saving' | 'unsynced'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Admin Direct Response Box State (Responds from Sidratu82sesay@gmail.com)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [emailModalData, setEmailModalData] = useState<{
    clientName: string;
    clientEmail: string;
    subject: string;
    body: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // WhatsApp Modal / Preview State
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Drawers & Modals
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [darkPlumTheme, setDarkPlumTheme] = useState(false);

  // PWA Web App Installation State (iPhone iOS & Android)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    }
    return false;
  });
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installDeviceTab, setInstallDeviceTab] = useState<'iphone' | 'android'>(() => {
    if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return 'iphone';
    }
    return 'android';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredInstallPrompt(null);
      showNotification('Sidratu Beauty Therapy Web App installed on your device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallWebAppClick = async (preferredPlatform?: 'iphone' | 'android') => {
    if (preferredPlatform) {
      setInstallDeviceTab(preferredPlatform);
    }
    if (deferredInstallPrompt && preferredPlatform !== 'iphone') {
      try {
        await deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setIsAppInstalled(true);
          showNotification('Installing Sidratu Beauty Therapy Web App...');
        }
        setDeferredInstallPrompt(null);
      } catch {
        setInstallModalOpen(true);
      }
    } else {
      setInstallModalOpen(true);
    }
  };

  // Automatically calculated age for the currently active Client Record Sheet
  const activeSheetAgeInfo = useMemo(
    () => calculatePatientAge(sheetClientDOB),
    [sheetClientDOB]
  );

  // Profile Drawer Form State
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profAllergies, setProfAllergies] = useState('');
  const [profDOB, setProfDOB] = useState('');

  // Automatically calculated age for the Personal Profile Drawer
  const profileAgeInfo = useMemo(
    () => calculatePatientAge(profDOB),
    [profDOB]
  );

  // Owner Config Strings
  const [cfgOwners, setCfgOwners] = useState(adminConfig.owners.join(', '));
  const [cfgSecretaries, setCfgSecretaries] = useState(adminConfig.secretaries.join(', '));
  const [cfgSecurity, setCfgSecurity] = useState(adminConfig.security.join(', '));

  // Sync DB to localStorage with fast non-blocking transition
  useEffect(() => {
    setStorageSyncState('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(clientsDB));
        setStorageSyncState('saved');
        setLastSavedTime(
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );
      } catch {
        setStorageSyncState('unsynced');
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [clientsDB]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners once Firebase Auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setFirestoreConnected(false);
      return;
    }

    const canQueryAllAsAdmin =
      isFirebaseBootstrappedAdmin(firebaseUser) &&
      currentUser !== null &&
      currentUser.role !== 'Customer';

    const clientsRef = canQueryAllAsAdmin
      ? collection(db, 'clients')
      : query(collection(db, 'clients'), where('ownerUid', '==', firebaseUser.uid));

    const apptsRef = canQueryAllAsAdmin
      ? collection(db, 'appointments')
      : query(collection(db, 'appointments'), where('ownerUid', '==', firebaseUser.uid));

    const historyRef = canQueryAllAsAdmin
      ? collection(db, 'treatmentHistory')
      : query(collection(db, 'treatmentHistory'), where('ownerUid', '==', firebaseUser.uid));

    const unsubClients = onSnapshot(
      clientsRef,
      snapshot => {
        setFirestoreConnected(true);
        if (snapshot.empty) return;
        setClientsDB(prev => {
          const byId = new Map(prev.map(c => [c.id, c]));
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const existing = byId.get(docSnap.id);
            byId.set(docSnap.id, {
              id: docSnap.id,
              name: data.name || existing?.name || 'Clinic Client',
              phone: data.phone ?? existing?.phone ?? '',
              email: data.email ?? existing?.email ?? '',
              address: data.address ?? existing?.address ?? 'Freetown, Sierra Leone',
              allergies: data.allergies ?? existing?.allergies ?? 'None',
              dob: data.dob ?? existing?.dob ?? '',
              avatarBase64: existing?.avatarBase64,
              quickNotes: data.quickNotes ?? existing?.quickNotes ?? '',
              newAppointments: existing?.newAppointments || [],
              pastHistory: existing?.pastHistory || []
            });
          });
          return Array.from(byId.values());
        });
      },
      error => {
        handleFirestoreError(error, OperationType.GET, 'clients');
      }
    );

    const unsubAppts = onSnapshot(
      apptsRef,
      snapshot => {
        setFirestoreConnected(true);
        if (snapshot.empty) return;
        setClientsDB(prev => {
          const apptsByClient = new Map<string, Appointment[]>();
          snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const cid = d.clientId;
            if (!cid) return;
            const item: Appointment = {
              id: docSnap.id,
              treatment: d.treatment || 'Clinic Consultation',
              date: d.date || '',
              time: d.time || '',
              notes: d.notes || '',
              consentSignedBy: d.consentSignedBy || d.clientName || 'Client',
              createdAt:
                typeof d.createdAt?.toDate === 'function'
                  ? d.createdAt.toDate().toLocaleString()
                  : getFormattedDayDateTime(),
              status: d.status || 'Confirmed',
              frequency: d.frequency || 'None',
              adminResponse: d.adminResponse || undefined,
              adminRespondedBy: d.adminRespondedBy || undefined,
              adminRespondedAt: d.adminRespondedAt || undefined
            };
            const list = apptsByClient.get(cid) || [];
            list.push(item);
            apptsByClient.set(cid, list);
          });

          return prev.map(c => {
            const remoteList = apptsByClient.get(c.id);
            if (!remoteList) return c;
            const mergedMap = new Map<string, Appointment>();
            (c.newAppointments || []).forEach(a => mergedMap.set(a.id, a));
            remoteList.forEach(a => mergedMap.set(a.id, a));
            return {
              ...c,
              newAppointments: Array.from(mergedMap.values())
            };
          });
        });
      },
      error => {
        handleFirestoreError(error, OperationType.GET, 'appointments');
      }
    );

    const unsubHistory = onSnapshot(
      historyRef,
      snapshot => {
        setFirestoreConnected(true);
        if (snapshot.empty) return;
        setClientsDB(prev => {
          const histByClient = new Map<string, HistoryEntry[]>();
          snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const cid = d.clientId;
            if (!cid) return;
            const item: HistoryEntry = {
              id: docSnap.id,
              dayDateTime: d.dayDateTime || getFormattedDayDateTime(),
              treatment: d.treatment || 'Clinic Session',
              ratingOrPayment: d.ratingOrPayment || 'Completed',
              specialist: d.specialist || 'Clinic Specialist',
              notes: d.notes || '',
              specialistNotes: d.specialistNotes || undefined,
              adminResponse: d.adminResponse || undefined,
              adminRespondedBy: d.adminRespondedBy || undefined,
              adminRespondedAt: d.adminRespondedAt || undefined
            };
            const list = histByClient.get(cid) || [];
            list.push(item);
            histByClient.set(cid, list);
          });

          return prev.map(c => {
            const remoteList = histByClient.get(c.id);
            if (!remoteList) return c;
            const mergedMap = new Map<string, HistoryEntry>();
            (c.pastHistory || []).forEach(h => mergedMap.set(h.id, h));
            remoteList.forEach(h => {
              const prevEntry = mergedMap.get(h.id);
              mergedMap.set(h.id, {
                ...h,
                photoBase64: prevEntry?.photoBase64
              });
            });
            return {
              ...c,
              pastHistory: Array.from(mergedMap.values())
            };
          });
        });
      },
      error => {
        handleFirestoreError(error, OperationType.GET, 'treatmentHistory');
      }
    );

    return () => {
      unsubClients();
      unsubAppts();
      unsubHistory();
    };
  }, [authReady, firebaseUser, currentUser?.role]);

  // Sync body classes for accessibility & theme
  useEffect(() => {
    document.body.classList.toggle('large-text-mode', largeTextMode);
  }, [largeTextMode]);

  useEffect(() => {
    document.body.classList.toggle('dark-plum-theme', darkPlumTheme);
  }, [darkPlumTheme]);

  // Load selected client into Record Sheet when selectedClientId changes
  useEffect(() => {
    if (clientsDB.length === 0) {
      lastLoadedClientIdRef.current = null;
      setSheetClientName('');
      setSheetClientPhone('');
      setSheetClientEmail('');
      setSheetClientAddress('');
      setSheetClientAllergies('');
      setSheetClientDOB('');
      setSheetClientAvatar(null);
      setSheetQuickNotes('');
      return;
    }

    const client = clientsDB.find(c => c.id === selectedClientId) || clientsDB[0];
    if (!client) return;

    if (client.id !== selectedClientId) {
      setSelectedClientId(client.id);
      return;
    }

    const clientSwitched = lastLoadedClientIdRef.current !== client.id;
    lastLoadedClientIdRef.current = client.id;

    if (clientSwitched) {
      setSheetVisitDateTime(getFormattedDayDateTime());
      setSheetClientName(client.name || '');
      setSheetClientPhone(client.phone || '');
      setSheetClientEmail(client.email || '');
      setSheetClientAddress(client.address || '');
      setSheetClientAllergies(client.allergies || 'None');
      setSheetClientDOB(client.dob || '');
      setSheetClientAvatar(client.avatarBase64 || null);
      setSheetQuickNotes(client.quickNotes || '');

      // Trigger Emergency Health Alert Modal ONLY when an Admin selects a client in Admin view with real allergies
      const normalizedAllergy = (client.allergies || '').trim().toLowerCase();
      if (
        currentUser &&
        currentUser.role !== 'Customer' &&
        mainView === 'admin' &&
        normalizedAllergy !== '' &&
        normalizedAllergy !== 'none' &&
        normalizedAllergy !== 'none listed yet' &&
        !normalizedAllergy.includes('no drug allergies')
      ) {
        setEmergencyModalClient(client);
      }
    }
  }, [selectedClientId, clientsDB, currentUser, mainView]);

  const detectRole = (identifier: string): Role => {
    const clean = normalizeIdentifier(identifier);
    if (
      REQUIRED_OWNER_IDENTIFIERS.some(x => normalizeIdentifier(x) === clean) ||
      adminConfig.owners.some(x => normalizeIdentifier(x) === clean)
    ) {
      return 'Owner';
    }
    if (adminConfig.secretaries.some(x => normalizeIdentifier(x) === clean)) {
      return 'Secretary';
    }
    if (adminConfig.security.some(x => normalizeIdentifier(x) === clean)) {
      return 'Security';
    }
    return 'Customer';
  };

  const executeLogin = (
    nameInput: string,
    identifierInput: string,
    addressInput: string,
    passwordInput: string = ''
  ) => {
    const name = nameInput.trim();
    const identifier = identifierInput.trim();
    const address = addressInput.trim() || 'Freetown, Sierra Leone';
    const cleanPassword = passwordInput.trim();

    const customCode = (adminSignature.customAccessCode || ADMIN_ACCESS_PASSWORD).trim();
    const isCodeMatch = (val: string) =>
      val === ADMIN_ACCESS_PASSWORD || (Boolean(customCode) && val === customCode);

    if (!identifier && !isCodeMatch(cleanPassword)) {
      showNotification('Please enter your email address or phone number.');
      return;
    }

    const detectedStaffRole = detectRole(identifier);
    const enteredCodeInIdentifier = isCodeMatch(identifier);
    const isAttemptingAdmin =
      detectedStaffRole !== 'Customer' ||
      enteredCodeInIdentifier ||
      showAdminPasswordField ||
      cleanPassword.length > 0;

    let role: Role = 'Customer';

    if (isAttemptingAdmin) {
      const isPasswordValid =
        isCodeMatch(cleanPassword) ||
        (enteredCodeInIdentifier && isCodeMatch(cleanPassword)) ||
        (enteredCodeInIdentifier && !showAdminPasswordField);

      // Strictly require password @sidratu82 (or configured Admin code) whenever an admin email/phone is used or admin access is requested
      if (detectedStaffRole !== 'Customer' && !isCodeMatch(cleanPassword)) {
        setShowAdminPasswordField(true);
        showNotification('Admin access requires the valid Admin password.');
        return;
      }

      if (!isPasswordValid && !isCodeMatch(cleanPassword)) {
        setShowAdminPasswordField(true);
        showNotification('Invalid Admin password or access code. Admin access denied.');
        return;
      }

      role = detectedStaffRole !== 'Customer' ? detectedStaffRole : 'Owner';
    }

    const effectiveIdentifier =
      enteredCodeInIdentifier || !identifier ? PRIMARY_ADMIN_EMAIL : identifier;
    const isEmail = effectiveIdentifier.includes('@');

    const normalizedInput = normalizeIdentifier(effectiveIdentifier);
    let existingClient = clientsDB.find(
      c =>
        normalizeIdentifier(c.email || '') === normalizedInput ||
        normalizeIdentifier(c.phone || '') === normalizedInput
    );

    let updatedClients = [...clientsDB];
    if (!existingClient) {
      existingClient = {
        id: 'client_' + Date.now(),
        name:
          name ||
          (role !== 'Customer'
            ? 'Sidratu Admin'
            : isEmail
            ? effectiveIdentifier.split('@')[0]
            : 'Walk-in Client'),
        phone: isEmail ? '+23277000001' : effectiveIdentifier,
        email: isEmail ? effectiveIdentifier : PRIMARY_ADMIN_EMAIL,
        address,
        allergies: 'None',
        dob: '',
        quickNotes: '',
        newAppointments: [],
        pastHistory: []
      };
      updatedClients = [existingClient, ...clientsDB];
      setClientsDB(updatedClients);
    } else if (name && existingClient.name === 'Walk-in Client') {
      existingClient = { ...existingClient, name };
      updatedClients = clientsDB.map(c => (c.id === existingClient!.id ? existingClient! : c));
      setClientsDB(updatedClients);
    }

    const activeUser = {
      ...existingClient,
      role
    };

    setCurrentUser(activeUser);
    setLoginPassword('');
    setProfName(activeUser.name || '');
    setProfPhone(activeUser.phone || '');
    setProfEmail(activeUser.email || '');
    setProfAddress(activeUser.address || '');
    setProfAllergies(activeUser.allergies || '');
    setProfDOB(activeUser.dob || '');
    setApptConsentSignature(activeUser.name || '');

    setCfgOwners(adminConfig.owners.join(', '));
    setCfgSecretaries(adminConfig.secretaries.join(', '));
    setCfgSecurity(adminConfig.security.join(', '));

    if (role !== 'Customer') {
      setMainView('admin');
      const firstCustomer = updatedClients.find(
        c =>
          normalizeIdentifier(c.email || '') !== normalizeIdentifier(PRIMARY_ADMIN_EMAIL) &&
          normalizeIdentifier(c.email || '') !== normalizeIdentifier(SIDRATU_ADMIN_EMAIL)
      );
      const targetId = firstCustomer?.id || updatedClients[0]?.id || existingClient.id;
      lastLoadedClientIdRef.current = null;
      setSelectedClientId(targetId);
    } else {
      setMainView('customer');
      setCustomerSection('dashboard');
      lastLoadedClientIdRef.current = null;
      setSelectedClientId(existingClient.id);
    }

    if (auth.currentUser) {
      void syncClientProfileToFirestore({
        ...existingClient,
        role
      });
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(loginName, loginIdentifier, loginAddress, loginPassword);
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const gEmail = (user.email || '').trim();
      const gName = (user.displayName || gEmail.split('@')[0] || 'Clinic Client').trim();
      const cleanPass = loginPassword.trim();

      // Never grant Admin access without the @sidratu82 password/code
      const staffRole = detectRole(gEmail);
      const grantedRole: Role =
        cleanPass === ADMIN_ACCESS_PASSWORD
          ? staffRole !== 'Customer'
            ? staffRole
            : 'Owner'
          : 'Customer';

      const normalizedEmail = normalizeIdentifier(gEmail);
      let existingClient = clientsDB.find(
        c => normalizeIdentifier(c.email || '') === normalizedEmail
      );

      let updatedClients = [...clientsDB];
      if (!existingClient) {
        existingClient = {
          id: `client_${user.uid.slice(0, 20)}`,
          name: gName,
          phone: loginIdentifier && !loginIdentifier.includes('@') ? loginIdentifier.trim() : '',
          email: gEmail,
          address: loginAddress.trim() || 'Freetown, Sierra Leone',
          allergies: 'None',
          dob: '',
          quickNotes: '',
          newAppointments: [],
          pastHistory: []
        };
        updatedClients = [existingClient, ...clientsDB];
        setClientsDB(updatedClients);
      }

      const activeUser = {
        ...existingClient,
        role: grantedRole
      };

      setCurrentUser(activeUser);
      setLoginPassword('');
      setProfName(activeUser.name || '');
      setProfPhone(activeUser.phone || '');
      setProfEmail(activeUser.email || '');
      setProfAddress(activeUser.address || '');
      setProfAllergies(activeUser.allergies || '');
      setProfDOB(activeUser.dob || '');
      setApptConsentSignature(activeUser.name || '');

      await syncClientProfileToFirestore({
        ...existingClient,
        ownerUid: user.uid,
        role: grantedRole
      });

      if (grantedRole !== 'Customer') {
        setMainView('admin');
        const firstCustomer = updatedClients.find(
          c =>
            normalizeIdentifier(c.email || '') !== normalizeIdentifier(PRIMARY_ADMIN_EMAIL) &&
            normalizeIdentifier(c.email || '') !== normalizeIdentifier(SIDRATU_ADMIN_EMAIL)
        );
        const targetId = firstCustomer?.id || updatedClients[0]?.id || existingClient.id;
        lastLoadedClientIdRef.current = null;
        setSelectedClientId(targetId);
        showNotification(`Signed in with Google as ${gName} (${grantedRole}). Synced with Firestore.`);
      } else {
        setMainView('customer');
        setCustomerSection('dashboard');
        lastLoadedClientIdRef.current = null;
        setSelectedClientId(existingClient.id);
        showNotification(`Signed in with Google as ${gName}. Connected to Firestore.`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google Sign-In was cancelled or failed.';
      showNotification(`Google Sign-In: ${msg}`);
    }
  };

  const handleUnlockAdminInDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const entered = drawerAdminPassword.trim();
    const customCode = (adminSignature.customAccessCode || ADMIN_ACCESS_PASSWORD).trim();
    if (entered !== ADMIN_ACCESS_PASSWORD && entered !== customCode) {
      showNotification('Invalid Admin password/code. Access to Admin is restricted.');
      return;
    }
    const staffRole = detectRole(currentUser.email || currentUser.phone || '');
    const nextRole: Role = staffRole !== 'Customer' ? staffRole : 'Owner';
    const upgradedUser = {
      ...currentUser,
      role: nextRole
    };
    setCurrentUser(upgradedUser);
    setDrawerAdminPassword('');
    setShowDrawerAdminUnlock(false);
    setProfileDrawerOpen(false);
    setMainView('admin');
    if (auth.currentUser) {
      void syncClientProfileToFirestore({
        ...upgradedUser,
        role: nextRole
      });
    }
    showNotification(`Admin Mode (${nextRole}) unlocked.`);
  };

  const APPOINTMENT_TREATMENT_GROUPS = useMemo(
    () => [
      {
        category: 'Facial & Skin Therapy',
        treatments: [
          'HydraFacial Luxury Glow',
          'Chemical Peel & Pigmentation Care',
          'Microneedling & Acne Scar Repair',
          'PRP (Platelet-Rich Plasma) Rejuvenation',
          'Skin Tag & Mole Removal'
        ]
      },
      {
        category: 'Dental & Smile Aesthetics',
        treatments: [
          'Laser Teeth Whitening',
          'Dental Braces Consultation & Fitting',
          'Teeth Filling & Dental Restoration',
          'Tooth Scaling & Polishing'
        ]
      },
      {
        category: 'Body & Specialty Aesthetics',
        treatments: [
          'Non-Surgical Nose Lift',
          'Full Body Detox Scrub & Polish',
          'IV Glutathione & Vitamin Glow Drip'
        ]
      }
    ],
    []
  );

  const filteredAppointmentGroups = useMemo(() => {
    const q = apptTreatmentSearch.trim().toLowerCase();
    if (!q) return APPOINTMENT_TREATMENT_GROUPS;
    return APPOINTMENT_TREATMENT_GROUPS.map(group => ({
      category: group.category,
      treatments: group.treatments.filter(
        t =>
          t.toLowerCase().includes(q) ||
          group.category.toLowerCase().includes(q)
      )
    })).filter(group => group.treatments.length > 0);
  }, [APPOINTMENT_TREATMENT_GROUPS, apptTreatmentSearch]);

  const handleApptTreatmentSearch = (query: string) => {
    setApptTreatmentSearch(query);
    const q = query.trim().toLowerCase();
    if (!q) return;

    const matchingTreatments = APPOINTMENT_TREATMENT_GROUPS.flatMap(group =>
      group.treatments.filter(
        t =>
          t.toLowerCase().includes(q) ||
          group.category.toLowerCase().includes(q)
      )
    );

    if (matchingTreatments.length > 0) {
      if (!matchingTreatments.includes(apptTreatment)) {
        setApptTreatment(matchingTreatments[0]);
      }
    } else {
      setApptTreatment('OTHER_CUSTOM');
    }
  };

  const submitNewAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const finalTreatment =
      apptTreatment === 'OTHER_CUSTOM'
        ? apptCustomTreatment.trim() || 'Custom Clinic Consultation'
        : apptTreatment;

    const newAppt: Appointment = {
      id: 'appt_' + Date.now(),
      treatment: finalTreatment,
      date: apptDate,
      time: apptTime,
      frequency: apptFrequency,
      notes: apptNotes,
      consentSignedBy: apptConsentSignature || currentUser.name,
      createdAt: getFormattedDayDateTime(),
      status: 'Confirmed'
    };

    const targetClientRecord =
      currentUser.role !== 'Customer' && selectedAdminClient
        ? selectedAdminClient
        : currentUser;
    const targetId = targetClientRecord.id;

    setClientsDB(prev =>
      prev.map(c =>
        c.id === targetId
          ? { ...c, newAppointments: [newAppt, ...(c.newAppointments || [])] }
          : c
      )
    );

    if (auth.currentUser) {
      void saveAppointmentToFirestore(targetClientRecord, {
        ...newAppt,
        clientId: targetId,
        clientName: targetClientRecord.name
      });
    }

    setApptNotes('');
    showNotification(
      `New Appointment Confirmed (${apptFrequency !== 'None' ? `${apptFrequency} Plan` : 'One-Time'})! Synced to Firestore & Admin (${PRIMARY_ADMIN_EMAIL}).`
    );
  };

  const addCustomerHistoryLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const newEntry: HistoryEntry = {
      id: 'hist_' + Date.now(),
      dayDateTime: getFormattedDayDateTime(),
      treatment: histTreatment.trim(),
      ratingOrPayment: histRating,
      specialist: 'Client Self-Report',
      notes: histNotes.trim()
    };

    const targetClientRecord =
      currentUser.role !== 'Customer' && selectedAdminClient
        ? selectedAdminClient
        : currentUser;
    const targetId = targetClientRecord.id;

    setClientsDB(prev =>
      prev.map(c =>
        c.id === targetId
          ? { ...c, pastHistory: [newEntry, ...(c.pastHistory || [])] }
          : c
      )
    );

    if (auth.currentUser) {
      void saveHistoryToFirestore(targetClientRecord, {
        ...newEntry,
        clientId: targetId,
        clientName: targetClientRecord.name
      });
    }

    setHistTreatment('');
    setHistNotes('');
    showNotification(`Progress update saved to Firestore and visible to Admin (${PRIMARY_ADMIN_EMAIL}).`);
  };

  // Admin Responds to a Specific Appointment or History Log with Sidratu82sesay@gmail.com
  const handleAdminRespondToAppointment = (
    clientId: string,
    apptId: string,
    openEmailModalAfter: boolean
  ) => {
    const draftKey = `appt_${apptId}`;
    const responseText = (replyDrafts[draftKey] || '').trim();
    if (!responseText) {
      showNotification('Please type a response message before sending.');
      return;
    }

    const responderEmail =
      adminSignature.signerEmail ||
      (currentUser?.email && currentUser.email.includes('@')
        ? currentUser.email
        : PRIMARY_ADMIN_EMAIL);
    const responderLabel = `${adminSignature.signerName} (${responderEmail})`;
    const timestamp = getFormattedDayDateTime();

    let targetClient: ClientRecord | undefined;
    let targetAppt: Appointment | undefined;

    setClientsDB(prev =>
      prev.map(c => {
        if (c.id !== clientId) return c;
        targetClient = c;
        return {
          ...c,
          newAppointments: (c.newAppointments || []).map(a => {
            if (a.id !== apptId) return a;
            targetAppt = a;
            return {
              ...a,
              status: 'Responded',
              adminResponse: responseText,
              adminRespondedBy: responderLabel,
              adminRespondedAt: timestamp
            };
          })
        };
      })
    );

    setReplyDrafts(prev => ({ ...prev, [draftKey]: '' }));
    if (auth.currentUser) {
      void respondToAppointmentInFirestore(apptId, responseText, responderLabel, timestamp);
    }
    showNotification(`Response signed & recorded by ${responderLabel}`);

    if (openEmailModalAfter && targetClient) {
      setEmailModalData({
        clientName: targetClient.name,
        clientEmail: targetClient.email || 'client@example.com',
        subject: `Sidratu Beauty Therapy — Appointment Update (${targetAppt?.treatment || 'Clinic Visit'})`,
        body: `Dear ${targetClient.name},\n\n${responseText}\n\nAppointment Details:\nTreatment: ${targetAppt?.treatment}\nScheduled Date & Time: ${targetAppt?.date} at ${targetAppt?.time}\nLocation: 101 Jomo Kenyatta Road, Freetown\n\nWarm regards,\n${adminSignature.signerName}\n${adminSignature.signerTitle}\nSidratu Beauty Therapy Skin Care\nAdmin Email: ${responderEmail}`
      });
    }
  };

  const handleAdminRespondToHistory = (
    clientId: string,
    histId: string,
    openEmailModalAfter: boolean
  ) => {
    const draftKey = `hist_${histId}`;
    const responseText = (replyDrafts[draftKey] || '').trim();
    if (!responseText) {
      showNotification('Please type a clinical response before sending.');
      return;
    }

    const responderEmail =
      currentUser?.email && currentUser.email.includes('@')
        ? currentUser.email
        : PRIMARY_ADMIN_EMAIL;
    const timestamp = getFormattedDayDateTime();

    let targetClient: ClientRecord | undefined;
    let targetHist: HistoryEntry | undefined;

    setClientsDB(prev =>
      prev.map(c => {
        if (c.id !== clientId) return c;
        targetClient = c;
        return {
          ...c,
          pastHistory: (c.pastHistory || []).map(h => {
            if (h.id !== histId) return h;
            targetHist = h;
            return {
              ...h,
              adminResponse: responseText,
              adminRespondedBy: responderEmail,
              adminRespondedAt: timestamp
            };
          })
        };
      })
    );

    setReplyDrafts(prev => ({ ...prev, [draftKey]: '' }));
    if (auth.currentUser) {
      void respondToHistoryInFirestore(histId, {
        adminResponse: responseText,
        adminRespondedBy: responderEmail,
        adminRespondedAt: timestamp
      });
    }
    showNotification(`Clinical follow-up response saved by ${responderEmail}`);

    if (openEmailModalAfter && targetClient) {
      setEmailModalData({
        clientName: targetClient.name,
        clientEmail: targetClient.email || 'client@example.com',
        subject: `Sidratu Beauty Therapy — Post-Care Follow-Up (${targetHist?.treatment || 'Session'})`,
        body: `Dear ${targetClient.name},\n\n${responseText}\n\nSession Reference: ${targetHist?.treatment} (${targetHist?.dayDateTime})\nLocation: 101 Jomo Kenyatta Road, Freetown\n\nWarm regards,\nSidratu Sesay\nSidratu Beauty Therapy Skin Care\nAdmin Email: ${PRIMARY_ADMIN_EMAIL}`
      });
    }
  };

  const saveSpecialistNoteOnHistory = (clientId: string, histId: string) => {
    const key = `spec_${histId}`;
    const noteText = (specialistNoteDrafts[key] ?? '').trim();
    setClientsDB(prev =>
      prev.map(c => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          pastHistory: (c.pastHistory || []).map(h =>
            h.id === histId ? { ...h, specialistNotes: noteText } : h
          )
        };
      })
    );
    if (auth.currentUser) {
      void respondToHistoryInFirestore(histId, {
        specialistNotes: noteText
      });
    }
    setSpecialistNoteDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    showNotification('Private Specialist Note saved to session record.');
  };

  const attachPhotoToExistingHistory = (clientId: string, histId: string, base64: string) => {
    setClientsDB(prev => {
      const updated = prev.map(c => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          pastHistory: (c.pastHistory || []).map(h =>
            h.id === histId ? { ...h, photoBase64: base64 } : h
          )
        };
      });
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showNotification('Before/After photo attached to Past History session.');
  };

  const removePhotoFromExistingHistory = (clientId: string, histId: string) => {
    setClientsDB(prev => {
      const updated = prev.map(c => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          pastHistory: (c.pastHistory || []).map(h => {
            if (h.id !== histId) return h;
            const nextEntry = { ...h };
            delete nextEntry.photoBase64;
            return nextEntry;
          })
        };
      });
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showNotification('Progress photo deleted from Past History session.');
  };

  const deleteAppointment = (clientId: string, apptId: string) => {
    let removedName = 'Appointment';
    setClientsDB(prev => {
      const updated = prev.map(c => {
        if (c.id !== clientId) return c;
        const found = (c.newAppointments || []).find(a => a.id === apptId);
        if (found) removedName = found.treatment;
        return {
          ...c,
          newAppointments: (c.newAppointments || []).filter(a => a.id !== apptId)
        };
      });
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    if (auth.currentUser) {
      void deleteAppointmentFromFirestore(apptId);
    }
    showNotification(`Deleted appointment: "${removedName}".`);
  };

  const deleteHistoryEntry = (clientId: string, histId: string) => {
    let removedTreatment = 'Session record';
    setClientsDB(prev => {
      const updated = prev.map(c => {
        if (c.id !== clientId) return c;
        const found = (c.pastHistory || []).find(h => h.id === histId);
        if (found) removedTreatment = found.treatment;
        return {
          ...c,
          pastHistory: (c.pastHistory || []).filter(h => h.id !== histId)
        };
      });
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    if (auth.currentUser) {
      void deleteHistoryFromFirestore(histId);
    }
    showNotification(`Deleted past history session: "${removedTreatment}".`);
  };

  const saveQuickNotesOnly = (customNotes?: string) => {
    const notesToSave = typeof customNotes === 'string' ? customNotes : sheetQuickNotes;
    if (typeof customNotes === 'string') {
      setSheetQuickNotes(customNotes);
    }
    const targetId = selectedAdminClient?.id || selectedClientId;
    setClientsDB(prev => {
      const updated = prev.map(c => (c.id === targetId ? { ...c, quickNotes: notesToSave } : c));
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showNotification(
      notesToSave
        ? `Quick Notes & Staff Reminders saved for ${sheetClientName || 'client'}.`
        : `Quick Notes cleared for ${sheetClientName || 'client'}.`
    );
  };

  const updateClientAvatarPhoto = (base64: string | null) => {
    setSheetClientAvatar(base64);
    const targetId = selectedAdminClient?.id || selectedClientId;
    setClientsDB(prev => {
      const updated = prev.map(c =>
        c.id === targetId ? { ...c, avatarBase64: base64 || undefined } : c
      );
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showNotification(
      base64
        ? `Profile photo updated for ${sheetClientName || 'client'}.`
        : `Profile photo removed for ${sheetClientName || 'client'}.`
    );
  };

  const captureAvatarCameraFrame = () => {
    if (!avatarVideoRef.current) return;
    const canvas = document.createElement('canvas');
    const vw = avatarVideoRef.current.videoWidth || 480;
    const vh = avatarVideoRef.current.videoHeight || 480;
    const size = Math.min(vw, vh);
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const sx = (vw - size) / 2;
      const sy = (vh - size) / 2;
      ctx.drawImage(avatarVideoRef.current, sx, sy, size, size, 0, 0, 320, 320);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      updateClientAvatarPhoto(dataUrl);
      stopAvatarCamera();
    }
  };

  const saveAdminRecordSheet = () => {
    const visitStamp = sheetVisitDateTime.trim() || getFormattedDayDateTime();
    const treatment = sheetSecTreatment.trim();
    const payment = sheetSecPayment.trim();
    const specialist =
      sheetSecSpecialist.trim() ||
      `${currentUser?.name || 'Admin'} (${PRIMARY_ADMIN_EMAIL})`;
    const notes = sheetSecNotes.trim();
    const specialistNotes = sheetSecSpecialistNotes.trim();
    const hasNewSessionData = Boolean(
      treatment || payment || notes || specialistNotes || sheetSecPhoto
    );

    const targetId = selectedAdminClient?.id || selectedClientId;

    const newHistoryEntry: HistoryEntry | null = hasNewSessionData
      ? {
          id: 'hist_' + Date.now(),
          dayDateTime: visitStamp,
          treatment: treatment || 'Clinic Consultation & Check-In',
          ratingOrPayment: payment || 'Payment Recorded in Office Ledger',
          specialist,
          notes: notes || 'Client attended clinic session.',
          specialistNotes: specialistNotes || undefined,
          photoBase64: sheetSecPhoto || undefined,
          adminRespondedBy: PRIMARY_ADMIN_EMAIL,
          adminRespondedAt: visitStamp
        }
      : null;

    setClientsDB(prev => {
      const updated = prev.map(c => {
        if (c.id !== targetId) return c;

        const updatedHistory = [...(c.pastHistory || [])];
        if (newHistoryEntry) {
          updatedHistory.unshift(newHistoryEntry);
        }

        return {
          ...c,
          name: sheetClientName,
          phone: sheetClientPhone,
          email: sheetClientEmail,
          address: sheetClientAddress,
          allergies: sheetClientAllergies,
          dob: sheetClientDOB,
          avatarBase64: sheetClientAvatar || undefined,
          quickNotes: sheetQuickNotes,
          pastHistory: updatedHistory
        };
      });
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    if (auth.currentUser) {
      const updatedClientObj = {
        id: targetId,
        name: sheetClientName,
        phone: sheetClientPhone,
        email: sheetClientEmail,
        address: sheetClientAddress,
        allergies: sheetClientAllergies,
        dob: sheetClientDOB,
        quickNotes: sheetQuickNotes
      };
      void syncClientProfileToFirestore(updatedClientObj);
      if (newHistoryEntry) {
        void saveHistoryToFirestore(updatedClientObj, {
          ...newHistoryEntry,
          clientId: targetId,
          clientName: sheetClientName
        });
      }
    }

    setSheetSecTreatment('');
    setSheetSecPayment('');
    setSheetSecNotes('');
    setSheetSecSpecialistNotes('');
    setSheetSecPhoto(null);
    showNotification(
      hasNewSessionData
        ? `Client Record Paper & Session saved to Firestore & ${sheetClientName}'s Past History (${visitStamp}).`
        : `Client profile, Date of Birth & Quick Notes saved for ${sheetClientName}.`
    );
  };

  const createNewWalkInClient = () => {
    const newClient: ClientRecord = {
      id: 'client_' + Date.now(),
      name: 'New Walk-In Client',
      phone: '+232770000000',
      email: '',
      address: 'Freetown',
      allergies: 'None',
      dob: '',
      quickNotes: 'Walk-in client created at front desk.',
      newAppointments: [],
      pastHistory: []
    };
    setClientsDB(prev => {
      const updated = [newClient, ...prev];
      try {
        localStorage.setItem('sidratu_clients_db', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    lastLoadedClientIdRef.current = null;
    setSelectedClientId(newClient.id);
    showNotification('Created new Walk-In Client Sheet. Edit details below and save.');
  };

  const requestDeleteClient = (clientId?: string) => {
    const target =
      (clientId ? clientsDB.find(c => c.id === clientId) : undefined) ||
      clientsDB.find(c => c.id === selectedClientId) ||
      clientsDB[0];
    if (!target) {
      showNotification('No client record available to delete.');
      return;
    }
    setClientPendingDelete(target);
  };

  const confirmDeleteClient = () => {
    if (!clientPendingDelete) return;
    const clientId = clientPendingDelete.id;
    const deletedName = clientPendingDelete.name;
    const remainingClients = clientsDB.filter(c => c.id !== clientId);

    setClientsDB(remainingClients);
    try {
      localStorage.setItem('sidratu_clients_db', JSON.stringify(remainingClients));
    } catch {
      // ignore
    }

    const nextClient =
      selectedClientId === clientId
        ? remainingClients[0] || null
        : remainingClients.find(c => c.id === selectedClientId) || remainingClients[0] || null;

    // Prevent emergency modal from auto-firing when switching after deletion
    lastLoadedClientIdRef.current = nextClient ? nextClient.id : null;
    setSelectedClientId(nextClient ? nextClient.id : '');

    if (nextClient) {
      setSheetVisitDateTime(getFormattedDayDateTime());
      setSheetClientName(nextClient.name || '');
      setSheetClientPhone(nextClient.phone || '');
      setSheetClientEmail(nextClient.email || '');
      setSheetClientAddress(nextClient.address || '');
      setSheetClientAllergies(nextClient.allergies || 'None');
      setSheetClientDOB(nextClient.dob || '');
      setSheetClientAvatar(nextClient.avatarBase64 || null);
      setSheetQuickNotes(nextClient.quickNotes || '');
    } else {
      setSheetVisitDateTime(getFormattedDayDateTime());
      setSheetClientName('');
      setSheetClientPhone('');
      setSheetClientEmail('');
      setSheetClientAddress('');
      setSheetClientAllergies('');
      setSheetClientDOB('');
      setSheetClientAvatar(null);
      setSheetQuickNotes('');
    }

    setSheetSecTreatment('');
    setSheetSecPayment('');
    setSheetSecNotes('');
    setSheetSecSpecialistNotes('');
    setSheetSecPhoto(null);
    setClientPendingDelete(null);
    if (auth.currentUser) {
      void deleteClientFromFirestore(clientId);
    }
    showNotification(`Client record "${deletedName}" has been permanently deleted.`);
  };

  const exportClientsToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clientsDB, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `sidratu_clients_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Client database exported to JSON.');
  };

  const savePersonalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const updatedName = profName.trim();
    const updatedPhone = profPhone.trim();
    const updatedEmail = profEmail.trim();
    const updatedAddress = profAddress.trim();
    const updatedAllergies = profAllergies.trim();
    const updatedDOB = profDOB.trim();

    setCurrentUser({
      ...currentUser,
      name: updatedName,
      phone: updatedPhone,
      email: updatedEmail,
      address: updatedAddress,
      allergies: updatedAllergies,
      dob: updatedDOB
    });

    setClientsDB(prev =>
      prev.map(c =>
        c.id === currentUser.id
          ? {
              ...c,
              name: updatedName,
              phone: updatedPhone,
              email: updatedEmail,
              address: updatedAddress,
              allergies: updatedAllergies,
              dob: updatedDOB
            }
          : c
      )
    );

    if (selectedClientId === currentUser.id) {
      setSheetClientName(updatedName);
      setSheetClientPhone(updatedPhone);
      setSheetClientEmail(updatedEmail);
      setSheetClientAddress(updatedAddress);
      setSheetClientAllergies(updatedAllergies);
      setSheetClientDOB(updatedDOB);
    }

    if (auth.currentUser) {
      void syncClientProfileToFirestore({
        id: currentUser.id,
        name: updatedName,
        phone: updatedPhone,
        email: updatedEmail,
        address: updatedAddress,
        allergies: updatedAllergies,
        dob: updatedDOB,
        role: currentUser.role
      });
    }

    setApptConsentSignature(updatedName);
    setProfileDrawerOpen(false);
    showNotification('Your personal profile and clinic record sheet have been updated.');
  };

  const saveOwnerStaffConfig = () => {
    const owners = cfgOwners
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!owners.includes(PRIMARY_ADMIN_EMAIL)) {
      owners.unshift(PRIMARY_ADMIN_EMAIL);
    }
    const secretaries = cfgSecretaries
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const security = cfgSecurity
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const newCfg: AdminConfig = { owners, secretaries, security };
    setAdminConfig(newCfg);
    setCfgOwners(owners.join(', '));
    try {
      localStorage.setItem('sidratu_admin_config', JSON.stringify(newCfg));
    } catch {
      // ignore
    }
    showNotification(`Authorized Staff updated (Primary Admin: ${PRIMARY_ADMIN_EMAIL}).`);
  };

  const logoutUser = () => {
    setProfileDrawerOpen(false);
    setCurrentUser(null);
    setMainView('customer');
    setLoginPassword('');
    setShowAdminPasswordField(false);
    setDrawerAdminPassword('');
    setShowDrawerAdminUnlock(false);
    if (auth.currentUser) {
      void firebaseSignOut(auth);
    }
  };

  const toggleGoalSelection = (goalTitle: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalTitle) ? prev.filter(g => g !== goalTitle) : [...prev, goalTitle]
    );
  };

  // Active client records for customer & admin views (When Admin previews Customer View, show selectedAdminClient!)
  const selectedAdminClient = useMemo(
    () => clientsDB.find(c => c.id === selectedClientId) || clientsDB[0],
    [clientsDB, selectedClientId]
  );

  const activeCustomerRecord = useMemo(() => {
    if (currentUser?.role !== 'Customer' && selectedAdminClient) {
      return selectedAdminClient;
    }
    return clientsDB.find(c => c.id === currentUser?.id) || clientsDB[0];
  }, [clientsDB, currentUser, selectedAdminClient]);

  const parseHistoryDateMs = (entry: HistoryEntry, fallbackIdx: number): number => {
    const raw = (entry.dayDateTime || '').trim();
    if (raw) {
      const parts = raw.split('—').map(s => s.trim());
      const dateWithoutWeekday = (parts[0] || '').replace(/^[A-Za-z]+,\s*/, '');
      const timePart = parts[1] || '';
      const combined = `${dateWithoutWeekday} ${timePart}`.trim();
      const parsed = Date.parse(combined);
      if (!isNaN(parsed)) return parsed;
      const fallbackParsed = Date.parse(parts[0]);
      if (!isNaN(fallbackParsed)) return fallbackParsed;
    }
    const idTimestamp = Number((entry.id || '').replace(/^hist_/, ''));
    if (!isNaN(idTimestamp) && idTimestamp > 1000000000) {
      return idTimestamp;
    }
    return -fallbackIdx;
  };

  const sortPastHistoryList = (list: HistoryEntry[] | undefined): HistoryEntry[] => {
    if (!list || list.length === 0) return [];
    const indexed = list.map((item, idx) => ({ item, idx }));
    indexed.sort((a, b) => {
      if (historySortOrder === 'treatment-asc') {
        const cmp = (a.item.treatment || '').localeCompare(b.item.treatment || '');
        if (cmp !== 0) return cmp;
      } else if (historySortOrder === 'treatment-desc') {
        const cmp = (b.item.treatment || '').localeCompare(a.item.treatment || '');
        if (cmp !== 0) return cmp;
      } else if (historySortOrder === 'date-oldest') {
        const diff =
          parseHistoryDateMs(a.item, a.idx) - parseHistoryDateMs(b.item, b.idx);
        if (diff !== 0) return diff;
        return b.idx - a.idx;
      }
      // Default: 'date-newest'
      const diff =
        parseHistoryDateMs(b.item, b.idx) - parseHistoryDateMs(a.item, a.idx);
      if (diff !== 0) return diff;
      return a.idx - b.idx;
    });
    return indexed.map(x => x.item);
  };

  const sortedCustomerHistory = useMemo(
    () => sortPastHistoryList(activeCustomerRecord?.pastHistory),
    [activeCustomerRecord?.pastHistory, historySortOrder]
  );

  const sortedAdminHistory = useMemo(
    () => sortPastHistoryList(selectedAdminClient?.pastHistory),
    [selectedAdminClient?.pastHistory, historySortOrder]
  );

  // Determine if the Admin Record Sheet or reply boxes have unsaved/pending edits not yet committed to localStorage
  const hasUnsavedAdminEdits = Boolean(
    selectedAdminClient &&
      (sheetClientName !== (selectedAdminClient.name || '') ||
        sheetClientPhone !== (selectedAdminClient.phone || '') ||
        sheetClientEmail !== (selectedAdminClient.email || '') ||
        sheetClientAddress !== (selectedAdminClient.address || '') ||
        sheetClientAllergies !== (selectedAdminClient.allergies || 'None') ||
        sheetClientDOB !== (selectedAdminClient.dob || '') ||
        sheetQuickNotes !== (selectedAdminClient.quickNotes || '') ||
        sheetSecTreatment.trim() !== '' ||
        sheetSecPayment.trim() !== '' ||
        sheetSecSpecialist.trim() !== '' ||
        sheetSecNotes.trim() !== '' ||
        sheetSecSpecialistNotes.trim() !== '' ||
        sheetSecPhoto !== null ||
        Object.values(replyDrafts).some(val => val.trim() !== ''))
  );

  const effectiveSyncStatus: 'saved' | 'saving' | 'unsynced' =
    storageSyncState === 'saving'
      ? 'saving'
      : hasUnsavedAdminEdits || storageSyncState === 'unsynced'
      ? 'unsynced'
      : 'saved';

  const filteredClients = useMemo(() => {
    const q = adminSearchQuery.toLowerCase().trim();
    if (!q) return clientsDB;
    return clientsDB.filter(
      c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [clientsDB, adminSearchQuery]);

  // Collect all appointments scheduled for today's date across all clients
  const todaysScheduledItems = useMemo(
    () =>
      clientsDB.flatMap(client =>
        (client.newAppointments || [])
          .filter(appt => appt.date === todayStr)
          .map(appt => ({
            client,
            appt
          }))
      ),
    [clientsDB, todayStr]
  );

  // Memoized Executive Admin Dashboard Summary Analytics: Top-Performing Services & Total Revenue Trends
  const adminSummaryAnalytics = useMemo(() => {
    const serviceMap = new Map<
      string,
      {
        treatment: string;
        category: string;
        bookedCount: number;
        completedCount: number;
        bookedRevenueSLE: number;
        realizedRevenueSLE: number;
      }
    >();

    const monthMap = new Map<
      string,
      {
        month: string;
        sortKey: number;
        realizedSLE: number;
        bookedSLE: number;
        totalSLE: number;
        completedCount: number;
        bookedCount: number;
      }
    >();

    const ensureMonthBucket = (dateObj: Date | null, fallbackLabel = 'Oct 26') => {
      const valid = dateObj && !isNaN(dateObj.getTime());
      const label = valid
        ? dateObj!.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : fallbackLabel;
      const sortKey = valid
        ? dateObj!.getFullYear() * 100 + dateObj!.getMonth()
        : 202609;
      if (!monthMap.has(label)) {
        monthMap.set(label, {
          month: label,
          sortKey,
          realizedSLE: 0,
          bookedSLE: 0,
          totalSLE: 0,
          completedCount: 0,
          bookedCount: 0
        });
      }
      return monthMap.get(label)!;
    };

    const ensureServiceEntry = (treatmentRaw: string) => {
      const name = (treatmentRaw || 'Clinic Consultation').trim();
      if (!serviceMap.has(name)) {
        const info = getServiceTariffAndCategory(name);
        serviceMap.set(name, {
          treatment: name,
          category: info.category,
          bookedCount: 0,
          completedCount: 0,
          bookedRevenueSLE: 0,
          realizedRevenueSLE: 0
        });
      }
      return serviceMap.get(name)!;
    };

    clientsDB.forEach(client => {
      // 1. Aggregate Booked Appointments
      (client.newAppointments || []).forEach(appt => {
        const svc = ensureServiceEntry(appt.treatment);
        const estSLE = getServiceTariffAndCategory(appt.treatment).tariffSLE;
        svc.bookedCount += 1;
        svc.bookedRevenueSLE += estSLE;

        const parsedDate = appt.date ? new Date(appt.date) : null;
        const bucket = ensureMonthBucket(parsedDate, 'Oct 26');
        bucket.bookedSLE += estSLE;
        bucket.totalSLE += estSLE;
        bucket.bookedCount += 1;
      });

      // 2. Aggregate Completed Sessions & Realized Revenue
      (client.pastHistory || []).forEach(hist => {
        const svc = ensureServiceEntry(hist.treatment);
        const revSLE = extractSessionRevenueSLE(hist.treatment, hist.ratingOrPayment);
        svc.completedCount += 1;
        svc.realizedRevenueSLE += revSLE;

        const rawPart = (hist.dayDateTime || '').split('—')[0].trim();
        const cleanedDateStr = rawPart.replace(/^[A-Za-z]+,\s*/, '');
        const parsedDate = cleanedDateStr ? new Date(cleanedDateStr) : null;
        const bucket = ensureMonthBucket(parsedDate, 'Oct 26');
        bucket.realizedSLE += revSLE;
        bucket.totalSLE += revSLE;
        bucket.completedCount += 1;
      });
    });

    const allServices = Array.from(serviceMap.values()).map(item => {
      const totalInteractions = item.bookedCount + item.completedCount;
      const totalRevenueSLE = item.bookedRevenueSLE + item.realizedRevenueSLE;
      return {
        ...item,
        totalInteractions,
        totalRevenueSLE
      };
    });

    const totalBookedCount = allServices.reduce((acc, s) => acc + s.bookedCount, 0);
    const totalCompletedCount = allServices.reduce((acc, s) => acc + s.completedCount, 0);
    const totalActivityCount = Math.max(totalBookedCount + totalCompletedCount, 1);
    const totalRealizedSLE = allServices.reduce((acc, s) => acc + s.realizedRevenueSLE, 0);
    const totalBookedSLE = allServices.reduce((acc, s) => acc + s.bookedRevenueSLE, 0);
    const combinedRevenueSLE = totalRealizedSLE + totalBookedSLE;

    const rankedServices = allServices
      .map(s => {
        const activeCount =
          summaryViewFilter === 'booked'
            ? s.bookedCount
            : summaryViewFilter === 'completed'
            ? s.completedCount
            : s.totalInteractions;
        const activeDenom =
          summaryViewFilter === 'booked'
            ? Math.max(totalBookedCount, 1)
            : summaryViewFilter === 'completed'
            ? Math.max(totalCompletedCount, 1)
            : totalActivityCount;
        const activeRevenueSLE =
          summaryViewFilter === 'booked'
            ? s.bookedRevenueSLE
            : summaryViewFilter === 'completed'
            ? s.realizedRevenueSLE
            : s.totalRevenueSLE;
        return {
          ...s,
          activeCount,
          activeRevenueSLE,
          sharePct: Math.round((activeCount / activeDenom) * 100)
        };
      })
      .filter(s =>
        summaryViewFilter === 'booked'
          ? s.bookedCount > 0 || s.totalInteractions > 0
          : summaryViewFilter === 'completed'
          ? s.completedCount > 0 || s.totalInteractions > 0
          : true
      )
      .sort((a, b) => {
        if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
        return b.activeRevenueSLE - a.activeRevenueSLE;
      });

    const monthlyRevenueTrends = Array.from(monthMap.values()).sort(
      (a, b) => a.sortKey - b.sortKey
    );

    if (monthlyRevenueTrends.length === 0) {
      monthlyRevenueTrends.push({
        month: 'Oct 26',
        sortKey: 202609,
        realizedSLE: 0,
        bookedSLE: 0,
        totalSLE: 0,
        completedCount: 0,
        bookedCount: 0
      });
    }

    let momGrowthPct = 0;
    if (monthlyRevenueTrends.length >= 2) {
      const latest = monthlyRevenueTrends[monthlyRevenueTrends.length - 1].totalSLE;
      const prev = monthlyRevenueTrends[monthlyRevenueTrends.length - 2].totalSLE;
      if (prev > 0) {
        momGrowthPct = Math.round(((latest - prev) / prev) * 100);
      } else if (latest > 0) {
        momGrowthPct = 100;
      }
    }

    const topServiceByBookings =
      [...allServices].sort((a, b) => {
        if (b.bookedCount !== a.bookedCount) return b.bookedCount - a.bookedCount;
        return b.totalRevenueSLE - a.totalRevenueSLE;
      })[0] || null;

    const avgRevenuePerClientSLE = Math.round(
      combinedRevenueSLE / Math.max(clientsDB.length, 1)
    );

    return {
      rankedServices,
      monthlyRevenueTrends,
      totalBookedCount,
      totalCompletedCount,
      totalRealizedSLE,
      totalBookedSLE,
      combinedRevenueSLE,
      topServiceByBookings,
      avgRevenuePerClientSLE,
      momGrowthPct
    };
  }, [clientsDB, summaryViewFilter]);

  // Memoized consolidated upcoming appointments & recent history for fast rendering
  const allUpcomingAppointments = useMemo(
    () =>
      clientsDB
        .flatMap(c =>
          (c.newAppointments || []).map(a => ({ ...a, clientName: c.name, clientId: c.id }))
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [clientsDB]
  );

  const recentClientHistory = useMemo(
    () =>
      clientsDB
        .flatMap(c =>
          (c.pastHistory || []).map(h => ({ ...h, clientName: c.name, clientId: c.id }))
        )
        .slice(0, 10),
    [clientsDB]
  );

  const userInitials =
    (currentUser?.name || '')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'AB';

  const rawWhatsAppPhone = (sheetClientPhone || '').replace(/[^0-9]/g, '');
  const whatsAppText = `Hello ${sheetClientName}, this is Sidratu Beauty Therapy Skin Care at 101 Jomo Kenyatta Road, Freetown (Admin: ${PRIMARY_ADMIN_EMAIL}). We are confirming your clinic appointment (${sheetVisitDateTime}). We look forward to welcoming you!`;
  const whatsAppUrl = `https://wa.me/${rawWhatsAppPhone}?text=${encodeURIComponent(whatsAppText)}`;

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(whatsAppText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const handleCopyEmailBody = () => {
    if (!emailModalData) return;
    navigator.clipboard.writeText(
      `To: ${emailModalData.clientEmail}\nFrom: ${PRIMARY_ADMIN_EMAIL}\nSubject: ${emailModalData.subject}\n\n${emailModalData.body}`
    );
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-10">
      {/* =====================================================================
          NOTIFICATION TOAST BANNER
          ===================================================================== */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md theming-card border-2 border-[#D4AF37] rounded-xl px-4 py-3 shadow-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          TOP NAVIGATION BAR (Visible after Login)
          ===================================================================== */}
      {currentUser && (
        <header className="plum-header text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-8">
            {/* Zone 1: Brand Title */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-10 h-10 rounded-full overflow-hidden bg-[#D4AF37] text-[#3B0944] flex items-center justify-center font-extrabold text-lg border-2 border-white shrink-0"
                aria-hidden="true"
              >
                <img
                  src="/assets/aistudio/Gemini_Generated_Image_uuwh6auuwh6auuwh_8bbd66ae.jpg"
                  alt="Sidratu Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-display font-bold tracking-wide text-[#F3E5AB] whitespace-nowrap shrink-0 text-xl md:text-2xl">
                Sidratu Beauty Therapy
              </span>
            </div>

            {/* Zone 2: Concise Single-Line Navigation Links */}
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-200">
              {currentUser.role !== 'Customer' && (
                <button
                  onClick={() => setMainView('admin')}
                  className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                    mainView === 'admin'
                      ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                      : ''
                  }`}
                >
                  Admin View & Respond
                </button>
              )}
              <button
                onClick={() => {
                  setMainView('customer');
                  setCustomerSection('dashboard');
                }}
                className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                  mainView === 'customer' && customerSection === 'dashboard'
                    ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                    : ''
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setMainView('customer');
                  setCustomerSection('new-appointment');
                }}
                className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                  mainView === 'customer' && customerSection === 'new-appointment'
                    ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                    : ''
                }`}
              >
                New Appointment
              </button>
              <button
                onClick={() => {
                  setMainView('customer');
                  setCustomerSection('past-history');
                }}
                className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                  mainView === 'customer' && customerSection === 'past-history'
                    ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                    : ''
                }`}
              >
                Past History
              </button>
              <button
                onClick={() => {
                  setMainView('customer');
                  setCustomerSection('services-goals');
                }}
                className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                  mainView === 'customer' && customerSection === 'services-goals'
                    ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                    : ''
                }`}
              >
                Treatments & Goals
              </button>
              <button
                onClick={() => {
                  setMainView('customer');
                  setCustomerSection('ai-community');
                }}
                className={`hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0 ${
                  mainView === 'customer' && customerSection === 'ai-community'
                    ? 'text-[#F3E5AB] underline underline-offset-4 decoration-[#D4AF37]'
                    : ''
                }`}
              >
                AI & Care Guide
              </button>
              <button
                onClick={() => setHelpModalOpen(true)}
                className="hover:text-[#F3E5AB] transition-colors whitespace-nowrap shrink-0"
              >
                How to Use
              </button>
            </nav>

            {/* Zone 3: Primary Profile / Account Action & Install Web App Button (iPhone & Android) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleInstallWebAppClick()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full gold-btn text-[11px] sm:text-xs font-bold shadow-sm transition whitespace-nowrap shrink-0"
                title="Install Sidratu Web App on iPhone (iOS) or Android"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {isAppInstalled ? 'Installed' : 'Install App (iPhone / Android)'}
                </span>
              </button>

              <button
                onClick={() => setHelpModalOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-[#D4AF37]/60 text-xs font-semibold text-[#F3E5AB] transition whitespace-nowrap shrink-0"
                title="How to Use This App"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Guide</span>
              </button>

              <button
                onClick={() => setProfileDrawerOpen(true)}
                className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border-2 border-[#D4AF37] hover:bg-white/10 transition bg-[#52125E] whitespace-nowrap shrink-0"
                title="Personal Info & App Settings"
              >
                <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#3B0944] font-bold flex items-center justify-center text-xs">
                  {userInitials}
                </div>
                <span className="text-xs font-semibold text-[#F3E5AB] hidden sm:inline">
                  {currentUser.role} Profile
                </span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* =====================================================================
          LOGIN & WELCOME PORTAL (Default View Before Login)
          ===================================================================== */}
      {!currentUser && (
        <section className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full theming-card rounded-2xl shadow-xl overflow-hidden border-2 border-[#D4AF37]">
            <div className="plum-header p-6 text-center text-white">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden border-2 border-white shadow-md">
                <img
                  src="/assets/aistudio/Gemini_Generated_Image_uuwh6auuwh6auuwh_8bbd66ae.jpg"
                  alt="Sidratu Beauty Therapy Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="font-display text-3xl font-bold text-[#F3E5AB]">
                Sidratu Beauty Therapy
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Skin Care, Aesthetics & Dental Clinic
              </p>
              <p className="text-xs text-[#D4AF37] mt-1 font-medium">
                101 Jomo Kenyatta Road, Freetown
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-center">
                  Welcome — Sign In or Create Profile
                </h2>
                <p className="text-xs text-center opacity-75 mt-1">
                  Sign in with Google (Firebase Auth) or enter your details to access your appointments and clinic records.
                </p>
              </div>

              {/* Google Sign-In via Firebase Authentication */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-900 font-bold text-sm border-2 border-[#D4AF37] shadow-sm flex items-center justify-center gap-3 transition whitespace-nowrap"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google (Firebase Auth)</span>
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px bg-[#E6DEC8] flex-1" />
                  <span className="text-[11px] uppercase tracking-wider opacity-70 font-semibold">
                    or enter clinic profile details
                  </span>
                  <div className="h-px bg-[#E6DEC8] flex-1" />
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4" aria-label="Login form">
                <div>
                  <label className="block text-sm font-semibold mb-1" htmlFor="login-name">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="login-name"
                    required={!showAdminPasswordField}
                    value={loginName}
                    onChange={e => setLoginName(e.target.value)}
                    placeholder="e.g., Aminata Kamara"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1" htmlFor="login-identifier">
                    Email Address or Phone Number
                  </label>
                  <input
                    type="text"
                    id="login-identifier"
                    required={!showAdminPasswordField}
                    value={loginIdentifier}
                    onChange={e => {
                      const val = e.target.value;
                      setLoginIdentifier(val);
                      if (detectRole(val) !== 'Customer') {
                        setShowAdminPasswordField(true);
                      }
                    }}
                    placeholder="e.g., +232 77 123456 or email@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1" htmlFor="login-address">
                    Home Address (Freetown / Sierra Leone)
                  </label>
                  <input
                    type="text"
                    id="login-address"
                    value={loginAddress}
                    onChange={e => setLoginAddress(e.target.value)}
                    placeholder="e.g., 24 Wilkinson Road, Freetown"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#D4AF37] outline-none"
                  />
                </div>

                {/* Protected Admin Access Code / Password Section */}
                <div className="pt-1">
                  {!showAdminPasswordField && detectRole(loginIdentifier) === 'Customer' ? (
                    <button
                      type="button"
                      onClick={() => setShowAdminPasswordField(true)}
                      className="text-xs font-semibold text-[#3B0944] dark:text-[#F3E5AB] underline underline-offset-2 flex items-center gap-1.5 opacity-80 hover:opacity-100"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Staff / Admin Sign In (Requires Access Code or Password)</span>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-[#D4AF37] bg-amber-50/40 dark:bg-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          className="block text-xs font-bold text-[#3B0944] dark:text-[#F3E5AB] flex items-center gap-1.5"
                          htmlFor="login-admin-password"
                        >
                          <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Admin Access Code / Password</span>
                        </label>
                        {detectRole(loginIdentifier) === 'Customer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAdminPasswordField(false);
                              setLoginPassword('');
                            }}
                            className="text-[11px] opacity-70 hover:opacity-100 underline"
                          >
                            Cancel Admin Login
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        id="login-admin-password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="Enter Admin password / code"
                        autoComplete="current-password"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-[#D4AF37] outline-none text-sm"
                      />
                      <p className="text-[11px] opacity-75">
                        Admin access is strictly protected. Enter your authorized Admin email and password to continue.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl gold-btn text-base shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Enter Clinic Portal</span>
                </button>
              </form>

              {/* Install Web App Buttons on Welcome/Login Screen for iPhone & Android */}
              <div className="pt-4 border-t border-[#E6DEC8] space-y-2.5">
                <div className="text-xs font-bold text-center text-[#3B0944] dark:text-[#F3E5AB] flex items-center justify-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Install Sidratu Web App on Your Phone</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInstallWebAppClick('iphone')}
                    className="py-2.5 px-3 rounded-xl plum-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Install on iPhone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInstallWebAppClick('android')}
                    className="py-2.5 px-3 rounded-xl gold-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install on Android</span>
                  </button>
                </div>
                <p className="text-[11px] opacity-75 text-center">
                  Add Sidratu Clinic directly to your iPhone or Android Home Screen for 1-tap access.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MAIN APPLICATION WORKSPACE
          ===================================================================== */}
      {currentUser && (
        <main className="max-w-6xl w-full mx-auto px-4 py-6 space-y-6" role="main">
          {/* Clinic Location & Role Context Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-80 border-b border-[#E6DEC8] pb-3">
            <div className="flex items-center gap-2">
              <span>101 Jomo Kenyatta Road, Freetown, Sierra Leone</span>
              <span aria-hidden="true">·</span>
              <span>
                Signed in as <strong>{currentUser.name}</strong> ({currentUser.role})
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                Admin Contact: {PRIMARY_ADMIN_EMAIL}
              </span>
            </div>

            {/* Visual Connection & Firestore / LocalStorage Sync Status Indicator */}
            <div className="flex items-center gap-2">
              {firestoreConnected && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Firestore Live</span>
                  <span aria-hidden="true">·</span>
                </span>
              )}
              {effectiveSyncStatus === 'saved' && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Saved ({lastSavedTime})</span>
                </span>
              )}
              {effectiveSyncStatus === 'saving' && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Pending — Syncing to localStorage...</span>
                </span>
              )}
              {effectiveSyncStatus === 'unsynced' && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Unsynced Edits — Click Save to commit to localStorage</span>
                </span>
              )}
            </div>
          </div>

          {/* MODE SWITCH BANNER / ADMIN HEADER */}
          {currentUser.role !== 'Customer' && (
            <div
              className="theming-card p-4 rounded-xl border border-[#D4AF37] flex flex-wrap items-center justify-between gap-3"
              role="region"
              aria-label="Admin header and storage status"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-[#D4AF37] shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">
                      {currentUser.role} Mode Active — Responding as {PRIMARY_ADMIN_EMAIL}
                    </p>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    {effectiveSyncStatus === 'saved' && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                        role="status"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>localStorage Synced ({lastSavedTime})</span>
                      </span>
                    )}
                    {effectiveSyncStatus === 'saving' && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
                        role="status"
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Sync Pending...</span>
                      </span>
                    )}
                    {effectiveSyncStatus === 'unsynced' && (
                      <button
                        type="button"
                        onClick={saveAdminRecordSheet}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:opacity-80"
                        title="Click to save current record sheet edits to localStorage"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Unsynced Changes (Tap to Save Now)</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs opacity-75 mt-0.5">
                    Inspect all client views, respond directly to appointments & past history, and manage the Client Record Paper.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMainView('admin')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
                    mainView === 'admin'
                      ? 'gold-btn'
                      : 'border border-[#D4AF37] hover:bg-amber-50/10'
                  }`}
                >
                  Admin Dashboard & Responses
                </button>
                <button
                  onClick={() => setMainView('customer')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
                    mainView === 'customer'
                      ? 'gold-btn'
                      : 'border border-[#D4AF37] hover:bg-amber-50/10'
                  }`}
                >
                  Preview Customer View
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              CUSTOMER PORTAL VIEW
              =================================================================== */}
          {mainView === 'customer' && (
            <div className="space-y-6">
              {/* If Admin is previewing Customer View, let them switch which Client's Customer Portal they are viewing */}
              {currentUser.role !== 'Customer' && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 text-gray-900 border border-[#D4AF37] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-purple-900 shrink-0" />
                    <span>
                      Admin Customer Portal Preview — Viewing Portal as:{' '}
                      <strong className="text-purple-950">{activeCustomerRecord?.name}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="admin-preview-client-select" className="font-bold">
                      Switch Client:
                    </label>
                    <select
                      id="admin-preview-client-select"
                      value={selectedClientId}
                      onChange={e => setSelectedClientId(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold"
                    >
                      {clientsDB.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Top Navigation Tabs (Functional Segmented Controls) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button
                  onClick={() => setCustomerSection('dashboard')}
                  className={`p-3.5 rounded-xl font-bold text-left border transition flex items-center gap-3 ${
                    customerSection === 'dashboard'
                      ? 'border-[#D4AF37] gold-btn shadow-sm'
                      : 'theming-card hover:border-[#D4AF37]'
                  }`}
                >
                  <LayoutDashboard
                    className={`w-6 h-6 shrink-0 ${
                      customerSection === 'dashboard' ? 'text-[#1F1624]' : 'text-[#D4AF37]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm md:text-base whitespace-nowrap truncate">Dashboard</div>
                    <div className="text-xs opacity-75 font-normal whitespace-nowrap truncate">
                      Clinic Overview
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setCustomerSection('new-appointment')}
                  className={`p-3.5 rounded-xl font-bold text-left border transition flex items-center gap-3 ${
                    customerSection === 'new-appointment'
                      ? 'border-[#D4AF37] gold-btn shadow-sm'
                      : 'theming-card hover:border-[#D4AF37]'
                  }`}
                >
                  <CalendarPlus
                    className={`w-6 h-6 shrink-0 ${
                      customerSection === 'new-appointment' ? 'text-[#1F1624]' : 'text-[#D4AF37]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm md:text-base whitespace-nowrap truncate">
                      New Appointment
                    </div>
                    <div className="text-xs opacity-80 font-normal whitespace-nowrap truncate">
                      Book & Consent
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setCustomerSection('past-history')}
                  className={`p-3.5 rounded-xl font-bold text-left border transition flex items-center gap-3 ${
                    customerSection === 'past-history'
                      ? 'border-[#D4AF37] gold-btn shadow-sm'
                      : 'theming-card hover:border-[#D4AF37]'
                  }`}
                >
                  <History
                    className={`w-6 h-6 shrink-0 ${
                      customerSection === 'past-history' ? 'text-[#1F1624]' : 'text-[#D4AF37]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm md:text-base whitespace-nowrap truncate">
                      Past History
                    </div>
                    <div className="text-xs opacity-75 font-normal whitespace-nowrap truncate">
                      Visits & Reports
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setCustomerSection('services-goals')}
                  className={`p-3.5 rounded-xl font-bold text-left border transition flex items-center gap-3 ${
                    customerSection === 'services-goals'
                      ? 'border-[#D4AF37] gold-btn shadow-sm'
                      : 'theming-card hover:border-[#D4AF37]'
                  }`}
                >
                  <Sparkles
                    className={`w-6 h-6 shrink-0 ${
                      customerSection === 'services-goals' ? 'text-[#1F1624]' : 'text-[#D4AF37]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm md:text-base whitespace-nowrap truncate">
                      Treatments & Goals
                    </div>
                    <div className="text-xs opacity-75 font-normal whitespace-nowrap truncate">
                      Skin, Body & Dental
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setCustomerSection('ai-community')}
                  className={`p-3.5 rounded-xl font-bold text-left border transition flex items-center gap-3 ${
                    customerSection === 'ai-community'
                      ? 'border-[#D4AF37] gold-btn shadow-sm'
                      : 'theming-card hover:border-[#D4AF37]'
                  }`}
                >
                  <MessageCircleHeart
                    className={`w-6 h-6 shrink-0 ${
                      customerSection === 'ai-community' ? 'text-[#1F1624]' : 'text-[#D4AF37]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm md:text-base whitespace-nowrap truncate">
                      AI & Care Guide
                    </div>
                    <div className="text-xs opacity-75 font-normal whitespace-nowrap truncate">
                      Live Voice & Pre-Care
                    </div>
                  </div>
                </button>
              </div>

              {/* CUSTOMER SECTION 0: DASHBOARD */}
              {customerSection === 'dashboard' && (
                <section className="theming-card rounded-2xl p-6 space-y-6">
                  <div className="border-b border-[#E6DEC8] pb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                        <LayoutDashboard className="w-6 h-6 text-[#D4AF37]" />
                        <span>Welcome, {activeCustomerRecord?.name} — Personal Clinic Dashboard</span>
                      </h2>
                      <p className="text-xs opacity-80 mt-0.5">
                        Visual summary of your upcoming appointments, pending clinical tasks, and recent session feedback at 101 Jomo Kenyatta Road, Freetown.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Next Appointment */}
                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2 text-[#D4AF37]">
                          <Clock className="w-4 h-4" />
                          <span>Upcoming Appointment</span>
                        </h3>
                        {activeCustomerRecord?.newAppointments?.[0] ? (
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-sm">
                                {activeCustomerRecord.newAppointments[0].treatment}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteAppointment(
                                    activeCustomerRecord.id,
                                    activeCustomerRecord.newAppointments[0].id
                                  )
                                }
                                className="p-1 rounded-md text-red-600 hover:bg-red-50 transition shrink-0"
                                title="Delete / Cancel Appointment"
                                aria-label="Delete upcoming appointment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-xs font-mono-tabular">
                              {activeCustomerRecord.newAppointments[0].date} at{' '}
                              {activeCustomerRecord.newAppointments[0].time}
                            </div>
                            {activeCustomerRecord.newAppointments[0].frequency &&
                              activeCustomerRecord.newAppointments[0].frequency !== 'None' && (
                                <div className="text-xs font-semibold text-[#D4AF37]">
                                  Plan: {activeCustomerRecord.newAppointments[0].frequency} Maintenance
                                </div>
                              )}
                            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                              Status: {activeCustomerRecord.newAppointments[0].status || 'Confirmed'}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs opacity-70 italic">No upcoming appointments booked.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomerSection('new-appointment')}
                        className="w-full py-2 rounded-lg gold-btn text-xs font-bold"
                      >
                        {activeCustomerRecord?.newAppointments?.length
                          ? 'View / Book Appointment'
                          : 'Book New Appointment'}
                      </button>
                    </div>

                    {/* Card 2: Pending Tasks & Consent */}
                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2 text-[#D4AF37]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Pending Clinical Tasks</span>
                        </h3>
                        <ul className="text-xs space-y-1.5 opacity-90">
                          <li className="flex items-center gap-1.5">
                            <span>•</span>
                            <span>
                              Consent Status:{' '}
                              <strong>
                                {activeCustomerRecord?.newAppointments?.length
                                  ? `Signed by ${activeCustomerRecord.newAppointments[0].consentSignedBy}`
                                  : 'Sign during next booking'}
                              </strong>
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span>•</span>
                            <span>
                              Date of Birth:{' '}
                              <strong>{activeCustomerRecord?.dob || 'Tap Profile to add DOB'}</strong>
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span>•</span>
                            <span>
                              Allergy Record:{' '}
                              <strong>{activeCustomerRecord?.allergies || 'None'}</strong>
                            </span>
                          </li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProfileDrawerOpen(true)}
                        className="w-full py-2 rounded-lg border border-[#D4AF37] text-xs font-bold hover:bg-amber-50/20"
                      >
                        Update Clinical Profile
                      </button>
                    </div>

                    {/* Card 3: Latest Session & Admin Follow-Up */}
                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2 text-[#D4AF37]">
                          <History className="w-4 h-4" />
                          <span>Latest Past Session</span>
                        </h3>
                        {activeCustomerRecord?.pastHistory?.[0] ? (
                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-sm">
                              {activeCustomerRecord.pastHistory[0].treatment}
                            </div>
                            <div className="opacity-75 font-mono-tabular">
                              {activeCustomerRecord.pastHistory[0].dayDateTime}
                            </div>
                            {activeCustomerRecord.pastHistory[0].adminResponse && (
                              <div className="p-2 rounded bg-amber-50/90 text-gray-900 border border-[#D4AF37] mt-1">
                                <strong>Admin Reply:</strong>{' '}
                                {activeCustomerRecord.pastHistory[0].adminResponse}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs opacity-70 italic">No past sessions logged yet.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomerSection('past-history')}
                        className="w-full py-2 rounded-lg border border-[#D4AF37] text-xs font-bold hover:bg-amber-50/20"
                      >
                        Open Past History ({activeCustomerRecord?.pastHistory?.length || 0})
                      </button>
                    </div>

                    {/* Card 4: Active Goals & AI Concierge */}
                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm flex items-center gap-2 text-[#D4AF37]">
                          <Sparkles className="w-4 h-4" />
                          <span>Goals & AI Care Suite</span>
                        </h3>
                        <p className="text-xs opacity-85">
                          {selectedGoals.length > 0
                            ? `Active Goals: ${selectedGoals.join(', ')}`
                            : 'Select your skin, dental, or body goals.'}
                        </p>
                        <p className="text-xs opacity-70">
                          Chat or speak live with Sidratu AI for Freetown climate care tips.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomerSection('services-goals')}
                          className="py-2 px-2 rounded-lg border border-[#D4AF37] text-xs font-bold hover:bg-amber-50/20"
                        >
                          Goals
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerSection('ai-community')}
                          className="py-2 px-2 rounded-lg plum-btn text-xs font-bold"
                        >
                          Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* CUSTOMER SECTION 1: NEW APPOINTMENT */}
              {customerSection === 'new-appointment' && (
                <section className="theming-card rounded-2xl p-6 space-y-6">
                  <div className="border-b border-[#E6DEC8] pb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                        <CalendarPlus className="w-6 h-6 text-[#D4AF37]" />
                        <span>New Appointment</span>
                      </h2>
                      <p className="text-sm opacity-80 mt-0.5">
                        Schedule your visit at 101 Jomo Kenyatta Road, Freetown. Reviewed by Admin ({PRIMARY_ADMIN_EMAIL}).
                      </p>
                    </div>
                    <span className="text-xs opacity-75">
                      Instant Front-Desk Sync
                    </span>
                  </div>

                  <form
                    onSubmit={submitNewAppointment}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                    aria-label="New appointment form"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="block text-sm font-bold" htmlFor="appt-treatment">
                          Select Service / Treatment
                        </label>
                        {apptTreatmentSearch.trim() && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#3B0944]">
                            {filteredAppointmentGroups.reduce(
                              (acc, g) => acc + g.treatments.length,
                              0
                            )}{' '}
                            match
                            {filteredAppointmentGroups.reduce(
                              (acc, g) => acc + g.treatments.length,
                              0
                            ) === 1
                              ? ''
                              : 'es'}
                          </span>
                        )}
                      </div>

                      {/* Keyword Search Filter for Service Dropdown */}
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          id="appt-treatment-search"
                          value={apptTreatmentSearch}
                          onChange={e => handleApptTreatmentSearch(e.target.value)}
                          placeholder="Search treatments by keyword (e.g. PRP, whitening, peel)..."
                          aria-label="Filter treatments by keyword"
                          className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#D4AF37]/60 bg-[#FAF7F2] text-gray-900 text-xs focus:outline-none focus:border-[#3B0944]"
                        />
                        {apptTreatmentSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setApptTreatmentSearch('');
                              if (apptTreatment === 'OTHER_CUSTOM' && !apptCustomTreatment) {
                                setApptTreatment('HydraFacial Luxury Glow');
                              }
                            }}
                            aria-label="Clear treatment search"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        id="appt-treatment"
                        value={apptTreatment}
                        onChange={e => setApptTreatment(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium"
                      >
                        {filteredAppointmentGroups.map(group => (
                          <optgroup key={group.category} label={group.category}>
                            {group.treatments.map(treatment => (
                              <option key={treatment} value={treatment}>
                                {treatment}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <optgroup label="Custom Request">
                          <option value="OTHER_CUSTOM">
                            Other (Type Your Custom Service Below)
                          </option>
                        </optgroup>
                      </select>

                      {apptTreatmentSearch.trim() &&
                        filteredAppointmentGroups.length === 0 && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-1.5">
                            No preset treatment matched &ldquo;{apptTreatmentSearch}&rdquo; — switched to Custom Service so you can type it below.
                          </p>
                        )}
                    </div>

                    {apptTreatment === 'OTHER_CUSTOM' && (
                      <div>
                        <label
                          className="block text-sm font-bold mb-1.5"
                          htmlFor="appt-custom-treatment"
                        >
                          Type Custom Treatment Name
                        </label>
                        <input
                          type="text"
                          id="appt-custom-treatment"
                          value={apptCustomTreatment}
                          onChange={e => setApptCustomTreatment(e.target.value)}
                          placeholder="Describe the treatment you want..."
                          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-bold mb-1.5" htmlFor="appt-date">
                        Preferred Date of Visit
                      </label>
                      <input
                        type="date"
                        id="appt-date"
                        required
                        value={apptDate}
                        onChange={e => setApptDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1.5" htmlFor="appt-time">
                        Preferred Time of Visit
                      </label>
                      <input
                        type="time"
                        id="appt-time"
                        required
                        value={apptTime}
                        onChange={e => setApptTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold mb-1.5" htmlFor="appt-frequency">
                        Recurring Frequency
                      </label>
                      <select
                        id="appt-frequency"
                        value={apptFrequency}
                        onChange={e => setApptFrequency(e.target.value as 'None' | 'Weekly' | 'Monthly')}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium"
                      >
                        <option value="None">None (One-time)</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-1.5" htmlFor="appt-notes">
                        Personal Notes or Skin/Dental Concerns for the Specialist
                      </label>
                      <textarea
                        id="appt-notes"
                        rows={2}
                        value={apptNotes}
                        onChange={e => setApptNotes(e.target.value)}
                        placeholder="Any specific areas to focus on, sensitivities, or questions?"
                        className="w-full px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                      />
                    </div>

                    {/* Digital Clinical Consent Box */}
                    <div className="md:col-span-2 p-4 rounded-xl bg-amber-50/90 border border-[#D4AF37] text-gray-900 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="appt-consent-check"
                          required
                          checked={apptConsentCheck}
                          onChange={e => setApptConsentCheck(e.target.checked)}
                          className="mt-1 w-5 h-5 accent-[#3B0944]"
                        />
                        <label
                          htmlFor="appt-consent-check"
                          className="text-sm font-medium leading-snug"
                        >
                          <strong>Clinical & Aesthetic Informed Consent:</strong> I confirm that I have reviewed the pre-care guidelines, disclosed my known allergies in my profile, and consent to the selected assessment/procedure at Sidratu Beauty Therapy Skin Care.
                        </label>
                      </div>
                      <div>
                        <label
                          className="block text-xs font-bold text-gray-700 mb-1"
                          htmlFor="appt-consent-signature"
                        >
                          Digital Signature (Type Your Full Name)
                        </label>
                        <input
                          type="text"
                          id="appt-consent-signature"
                          required
                          value={apptConsentSignature}
                          onChange={e => setApptConsentSignature(e.target.value)}
                          placeholder="Type your full legal name as digital signature"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="px-6 py-3 rounded-xl gold-btn text-base shadow-md flex items-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirm New Appointment</span>
                      </button>
                    </div>
                  </form>

                  {/* Active "New Appointment" List for this Customer */}
                  <div className="pt-6 border-t border-[#E6DEC8]">
                    <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#D4AF37]" />
                      <span>Your Scheduled New Appointments & Admin Responses</span>
                    </h3>
                    <div className="space-y-3">
                      {!activeCustomerRecord?.newAppointments?.length ? (
                        <p className="text-xs opacity-70 italic">
                          No active appointments yet. Use the form above to book.
                        </p>
                      ) : (
                        activeCustomerRecord.newAppointments.map(a => (
                          <div
                            key={a.id}
                            className="p-4 rounded-xl border border-[#D4AF37] space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <div className="font-bold text-sm">{a.treatment}</div>
                                <div className="text-xs opacity-80 font-mono-tabular">
                                  Scheduled Date: <strong>{a.date}</strong> at <strong>{a.time}</strong>
                                  {a.frequency && a.frequency !== 'None' && (
                                    <span className="ml-2 font-bold text-[#D4AF37]">
                                      ({a.frequency} Recurring)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs opacity-70">
                                  Consent Signed: {a.consentSignedBy} · Booked on {a.createdAt}
                                </div>
                                {a.notes && (
                                  <div className="text-xs opacity-80 italic">Note: "{a.notes}"</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                  {a.status || 'Confirmed'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteAppointment(activeCustomerRecord.id, a.id)}
                                  className="px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition"
                                  title="Delete Appointment"
                                  aria-label={`Delete appointment for ${a.treatment}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>

                            {a.adminResponse && (
                              <div className="p-3 rounded-lg bg-amber-50/90 text-gray-900 border border-[#D4AF37] text-xs space-y-1">
                                <div className="font-bold text-purple-950 flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    Clinic Admin Response ({a.adminRespondedBy || PRIMARY_ADMIN_EMAIL})
                                  </span>
                                  <span className="font-mono-tabular opacity-75">
                                    {a.adminRespondedAt}
                                  </span>
                                </div>
                                <p className="leading-relaxed">{a.adminResponse}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* CUSTOMER SECTION 2: PAST HISTORY */}
              {customerSection === 'past-history' && (
                <section className="theming-card rounded-2xl p-6 space-y-6">
                  <div className="border-b border-[#E6DEC8] pb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                        <History className="w-6 h-6 text-[#D4AF37]" />
                        <span>Past History (Sessions, Clinical Reports & Admin Follow-Ups)</span>
                      </h2>
                      <p className="text-sm opacity-80 mt-0.5">
                        Every completed session, specialist report, and post-treatment log with direct responses from {PRIMARY_ADMIN_EMAIL}.
                      </p>
                    </div>

                    {/* Sort Order Dropdown Control */}
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="customer-history-sort"
                        className="text-xs font-bold whitespace-nowrap opacity-85"
                      >
                        Sort By:
                      </label>
                      <select
                        id="customer-history-sort"
                        value={historySortOrder}
                        onChange={e =>
                          setHistorySortOrder(
                            e.target.value as
                              | 'date-newest'
                              | 'date-oldest'
                              | 'treatment-asc'
                              | 'treatment-desc'
                          )
                        }
                        aria-label="Sort past history"
                        className="px-3 py-1.5 rounded-lg border border-[#D4AF37] bg-white text-gray-900 text-xs font-semibold focus:outline-none focus:border-[#3B0944]"
                      >
                        <option value="date-newest">Date (Newest First)</option>
                        <option value="date-oldest">Date (Oldest First)</option>
                        <option value="treatment-asc">Treatment Type (A–Z)</option>
                        <option value="treatment-desc">Treatment Type (Z–A)</option>
                      </select>
                    </div>
                  </div>

                  {/* Log a Progress Note to Past History */}
                  <form
                    onSubmit={addCustomerHistoryLog}
                    className="p-4 rounded-xl border border-[#D4AF37]/60 space-y-4"
                    aria-label="Add progress log"
                  >
                    <h3 className="font-bold text-base">
                      Add Personal Progress Log or Reaction Update
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1" htmlFor="hist-treatment">
                          Treatment Completed
                        </label>
                        <input
                          type="text"
                          id="hist-treatment"
                          required
                          value={histTreatment}
                          onChange={e => setHistTreatment(e.target.value)}
                          placeholder="e.g., HydraFacial / Teeth Whitening"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1" htmlFor="hist-rating">
                          How Does Your Skin/Smile Feel?
                        </label>
                        <select
                          id="hist-rating"
                          value={histRating}
                          onChange={e => setHistRating(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        >
                          <option value="Glowing & Smooth (5/5)">Glowing & Smooth (5/5)</option>
                          <option value="Healing Well (4/5)">Healing Well (4/5)</option>
                          <option value="Mild Sensitivity / Normal Redness">
                            Mild Sensitivity / Normal Redness
                          </option>
                          <option value="Needs Doctor/Owner Review">
                            Needs Specialist Follow-Up
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1" htmlFor="hist-notes">
                          Progress Note / Report
                        </label>
                        <input
                          type="text"
                          id="hist-notes"
                          required
                          value={histNotes}
                          onChange={e => setHistNotes(e.target.value)}
                          placeholder="Describe your results..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg gold-btn text-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Save to Past History</span>
                    </button>
                  </form>

                  <div className="space-y-4">
                    {!sortedCustomerHistory.length ? (
                      <p className="text-xs opacity-70 italic">No past history logs yet.</p>
                    ) : (
                      sortedCustomerHistory.map(h => (
                        <div
                          key={h.id}
                          className="p-4 rounded-xl border border-[#E6DEC8] space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-base text-[#D4AF37]">
                              {h.treatment}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono-tabular opacity-80">
                                {h.dayDateTime}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteHistoryEntry(activeCustomerRecord.id, h.id)}
                                className="px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition"
                                title="Delete History Entry"
                                aria-label={`Delete history entry for ${h.treatment}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                          <p className="text-xs font-semibold">
                            {h.ratingOrPayment} · {h.specialist}
                          </p>
                          <p className="text-sm opacity-90">{h.notes}</p>
                          {h.photoBase64 && (
                            <div className="mt-2">
                              <span className="block text-xs font-bold text-[#D4AF37] mb-1">
                                Session Progress Photo:
                              </span>
                              <img
                                src={h.photoBase64}
                                alt="Before and After Progress"
                                className="h-32 w-32 object-cover rounded-lg border border-[#D4AF37]"
                              />
                            </div>
                          )}


                          {h.adminResponse && (
                            <div className="p-3 rounded-lg bg-amber-50/90 text-gray-900 border border-[#D4AF37] text-xs space-y-1 mt-2">
                              <div className="font-bold text-purple-950 flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  Follow-Up from Admin ({h.adminRespondedBy || PRIMARY_ADMIN_EMAIL})
                                </span>
                                <span className="font-mono-tabular opacity-75">
                                  {h.adminRespondedAt}
                                </span>
                              </div>
                              <p className="leading-relaxed">{h.adminResponse}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {/* CUSTOMER SECTION 3: TREATMENTS & GOALS */}
              {customerSection === 'services-goals' && (
                <section className="theming-card rounded-2xl p-6 space-y-6">
                  <div className="border-b border-[#E6DEC8] pb-4">
                    <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-[#D4AF37]" />
                      <span>Clinic Specialties & Your Personal Goals</span>
                    </h2>
                    <p className="text-sm opacity-80 mt-0.5">
                      Select your personal goals below to highlight them for your next consultation. Treatment pricing is handled privately in-clinic with the Secretary.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        category: 'Skin Therapy',
                        title: 'Clear, Even-Toned Skin',
                        desc: 'HydraFacials, Chemical Peels, PRP Rejuvenation, Acne Scar Microneedling, and Skin Tag Removal.',
                        defaultService: 'HydraFacial Luxury Glow'
                      },
                      {
                        category: 'Dental Care',
                        title: 'Bright Smile & Alignment',
                        desc: 'Dental Braces, Teeth Filling, Laser Whitening, and Scaling & Polishing.',
                        defaultService: 'Laser Teeth Whitening'
                      },
                      {
                        category: 'Aesthetics',
                        title: 'Contour & Full-Body Glow',
                        desc: 'Non-Surgical Nose Lift, Full Body Detox Polish, and IV Vitamin Glow Drips.',
                        defaultService: 'IV Glutathione & Vitamin Glow Drip'
                      }
                    ].map(item => {
                      const isSelected = selectedGoals.includes(item.title);
                      return (
                        <div
                          key={item.title}
                          onClick={() => toggleGoalSelection(item.title)}
                          className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                            isSelected
                              ? 'border-2 border-[#D4AF37] bg-amber-50/10'
                              : 'border-[#E6DEC8] hover:border-[#D4AF37]/60'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs opacity-75">
                              <span>{item.category}</span>
                              <span className="font-bold text-[#D4AF37]">
                                {isSelected ? 'Selected Goal ✓' : 'Tap to Select'}
                              </span>
                            </div>
                            <h3 className="font-bold text-base">{item.title}</h3>
                            <p className="text-xs opacity-80 leading-relaxed">{item.desc}</p>
                          </div>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setApptTreatment(item.defaultService);
                              setCustomerSection('new-appointment');
                            }}
                            className="w-full py-2 px-3 rounded-lg gold-btn text-xs whitespace-nowrap"
                          >
                            Book {item.category} Session
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* CUSTOMER SECTION 4: AI SUITE & CARE GUIDE */}
              {customerSection === 'ai-community' && (
                <section className="theming-card rounded-2xl p-6 space-y-8">
                  {/* Interactive Gemini AI Suite: Chatbot, Live Voice, Search Grounding, Maps Grounding */}
                  <GeminiAssistantHub
                    currentUserName={currentUser.name}
                    currentUserRole={currentUser.role}
                    onNotify={showNotification}
                  />

                  <div className="border-t border-[#E6DEC8] pt-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                        <Bot className="w-6 h-6 text-[#D4AF37]" />
                        <span>Sidratu Pre-Care & Post-Care Clinical Guide</span>
                      </h2>
                      <p className="text-sm opacity-80 mt-0.5">
                        Essential clinical preparation and aftercare instructions for Freetown's climate.
                      </p>
                    </div>

                    {/* Interactive Filter Controls */}
                    <div className="flex items-center gap-1 p-1 rounded-lg border border-[#E6DEC8]">
                      {(['all', 'skin', 'dental', 'body'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setCareQuestionFilter(f)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition ${
                            careQuestionFilter === f ? 'gold-btn' : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          {f === 'all' ? 'All Care' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 space-y-3">
                      <h3 className="font-bold text-base text-[#D4AF37]">
                        Before Your Visit (Pre-Care)
                      </h3>
                      <ul className="text-sm space-y-2 list-disc pl-5">
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'skin') && (
                          <li>
                            Pause strong retinoids, hydroquinone, or exfoliating acids 48 hours before facials, microneedling, or chemical peels.
                          </li>
                        )}
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'body') && (
                          <li>
                            Arrive well-hydrated (drink at least 1 liter of water) prior to PRP Rejuvenation or IV Glutathione & Vitamin Glow sessions.
                          </li>
                        )}
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'dental') && (
                          <li>
                            For Dental Braces, Scaling, or Fillings, brush gently prior to arrival and list any medication sensitivities in your Profile.
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="p-5 rounded-xl border border-[#D4AF37]/60 space-y-3">
                      <h3 className="font-bold text-base text-[#D4AF37]">
                        After Your Visit (Post-Care)
                      </h3>
                      <ul className="text-sm space-y-2 list-disc pl-5">
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'skin') && (
                          <li>
                            Apply broad-spectrum SPF 50 every morning and midday—especially in direct Freetown sunlight after peels or HydraFacials.
                          </li>
                        )}
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'dental') && (
                          <li>
                            Avoid dark-staining drinks (coffee, hibiscus/bissap, red wine, dark tea) for 48 hours after Laser Teeth Whitening.
                          </li>
                        )}
                        {(careQuestionFilter === 'all' || careQuestionFilter === 'body') && (
                          <li>
                            Log any post-treatment sensitivity in your <strong>Past History</strong> tab so the Owner ({PRIMARY_ADMIN_EMAIL}) and Specialist can review it immediately.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ===================================================================
              ADMIN PORTAL VIEW (Owner, Secretary & Security — Strictly Protected)
              =================================================================== */}
          {mainView === 'admin' && currentUser.role !== 'Customer' && (
            <div className="space-y-6">
              {/* EXECUTIVE DASHBOARD SUMMARY CARD: TOP-PERFORMING SERVICES & TOTAL REVENUE TRENDS */}
              <section
                className="theming-card p-6 rounded-2xl border-2 border-[#D4AF37] space-y-6"
                role="region"
                aria-label="Admin Dashboard Summary: Top-Performing Services and Total Revenue Trends"
              >
                {/* Header & Interactive View Filter */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E6DEC8] pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider text-[#D4AF37]">
                      <span>EXECUTIVE CLINIC ANALYTICS</span>
                      <span aria-hidden="true">·</span>
                      <span>SIGNED AS: {adminSignature.signerName.toUpperCase()}</span>
                    </div>
                    <h2 className="font-display text-2xl font-bold flex items-center gap-2.5">
                      <TrendingUp className="w-6 h-6 text-[#D4AF37] shrink-0" />
                      <span>Top-Performing Services &amp; Total Revenue Trends</span>
                    </h2>
                    <p className="text-xs opacity-80">
                      Real-time performance metrics computed from{' '}
                      <strong className="font-mono-tabular">{clientsDB.length}</strong> client records,{' '}
                      <strong className="font-mono-tabular">
                        {adminSummaryAnalytics.totalBookedCount}
                      </strong>{' '}
                      booked appointments, and{' '}
                      <strong className="font-mono-tabular">
                        {adminSummaryAnalytics.totalCompletedCount}
                      </strong>{' '}
                      completed clinic sessions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl border border-[#E6DEC8]">
                      {(
                        [
                          { id: 'all', label: 'All Activity' },
                          { id: 'booked', label: 'Booked Appointments' },
                          { id: 'completed', label: 'Completed Sessions' }
                        ] as const
                      ).map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSummaryViewFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                            summaryViewFilter === tab.id
                              ? 'gold-btn'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditingAdminSig(prev => !prev)}
                      className="px-3.5 py-2 rounded-xl plum-btn text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                      title="Customize Official Admin Signature & Sign-Off"
                    >
                      <PenTool className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Change Admin Sig</span>
                    </button>
                  </div>
                </div>

                {/* Quick Collapsible Admin Signature Editor ("change admin sig") right inside the Dashboard Summary Card */}
                {isEditingAdminSig && (
                  <div className="p-4 rounded-xl border-2 border-[#D4AF37] bg-amber-50/40 dark:bg-white/5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DEC8] pb-2.5">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <PenTool className="w-4 h-4 text-[#D4AF37]" />
                          <span>Change Official Admin Signature &amp; Sign-In Credentials</span>
                        </h3>
                        <p className="text-xs opacity-75">
                          Updates the official signature on Client Record Sheets, email dispatches, appointment responses, and Admin sign-in.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ADMIN_SIGNATURE_PRESETS.map(preset => (
                          <button
                            key={preset.signerName}
                            type="button"
                            onClick={() => saveAdminSignatureChanges(preset)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition whitespace-nowrap ${
                              adminSignature.signerName === preset.signerName
                                ? 'bg-[#3B0944] text-[#F3E5AB] border-[#D4AF37]'
                                : 'border-[#D4AF37] hover:bg-amber-100/50'
                            }`}
                          >
                            Use {preset.signerName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold mb-1">Admin Signer Full Name</label>
                        <input
                          type="text"
                          value={sigDraftName}
                          onChange={e => setSigDraftName(e.target.value)}
                          placeholder="e.g. Sidratu Sesay"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Official Role / Clinical Title</label>
                        <input
                          type="text"
                          value={sigDraftTitle}
                          onChange={e => setSigDraftTitle(e.target.value)}
                          placeholder="e.g. Founder & Lead Aesthetician"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Official Admin Email</label>
                        <input
                          type="email"
                          value={sigDraftEmail}
                          onChange={e => setSigDraftEmail(e.target.value)}
                          placeholder={PRIMARY_ADMIN_EMAIL}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Signature Typography Style</label>
                        <select
                          value={sigDraftStyle}
                          onChange={e =>
                            setSigDraftStyle(e.target.value as 'script' | 'formal' | 'stamp')
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold"
                        >
                          <option value="script">Calligraphic Script Signature</option>
                          <option value="formal">Formal Clinical Serif</option>
                          <option value="stamp">Official Clinic Seal Stamp</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
                      <div className="sm:col-span-2">
                        <label className="block font-bold mb-1">
                          Official Stamp / Verification Footer Line
                        </label>
                        <input
                          type="text"
                          value={sigDraftNote}
                          onChange={e => setSigDraftNote(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">
                          Admin Sign-In Access Code (Default: {ADMIN_ACCESS_PASSWORD})
                        </label>
                        <input
                          type="text"
                          value={sigDraftCode}
                          onChange={e => setSigDraftCode(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E6DEC8]">
                      <div className="text-xs flex items-center gap-2">
                        <span className="opacity-75">Live Signature Preview:</span>
                        <span
                          className={`px-3 py-1 rounded border border-[#D4AF37] bg-white text-[#3B0944] ${
                            sigDraftStyle === 'script'
                              ? 'font-display italic text-base font-bold'
                              : sigDraftStyle === 'stamp'
                              ? 'font-mono-tabular uppercase tracking-widest font-extrabold text-xs'
                              : 'font-display font-bold text-sm'
                          }`}
                        >
                          {sigDraftName || 'Sidratu Sesay'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingAdminSig(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveAdminSignatureChanges()}
                          className="px-4 py-1.5 rounded-lg gold-btn text-xs font-bold flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Admin Signature</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4-Metric KPI Strip (Single-elevation flat borders, tabular numerals) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-1">
                    <div className="text-xs opacity-75 font-semibold">
                      Total Clinic Revenue (Combined)
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular text-[#D4AF37]">
                      SLE {adminSummaryAnalytics.combinedRevenueSLE.toLocaleString()}
                    </div>
                    <div className="text-xs opacity-80 font-mono-tabular">
                      SLE {adminSummaryAnalytics.totalRealizedSLE.toLocaleString()} realized ·{' '}
                      {adminSummaryAnalytics.momGrowthPct >= 0
                        ? `+${adminSummaryAnalytics.momGrowthPct}%`
                        : `${adminSummaryAnalytics.momGrowthPct}%`}{' '}
                      MoM
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-1">
                    <div className="text-xs opacity-75 font-semibold">
                      Booked Appointment Pipeline
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular">
                      SLE {adminSummaryAnalytics.totalBookedSLE.toLocaleString()}
                    </div>
                    <div className="text-xs opacity-80 font-mono-tabular">
                      {adminSummaryAnalytics.totalBookedCount} active booked{' '}
                      {adminSummaryAnalytics.totalBookedCount === 1 ? 'session' : 'sessions'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-1">
                    <div className="text-xs opacity-75 font-semibold flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Top Service by Bookings</span>
                    </div>
                    <div
                      className="text-base font-extrabold truncate"
                      title={
                        adminSummaryAnalytics.topServiceByBookings?.treatment ||
                        'HydraFacial Luxury Glow'
                      }
                    >
                      {adminSummaryAnalytics.topServiceByBookings?.treatment ||
                        'HydraFacial Luxury Glow'}
                    </div>
                    <div className="text-xs opacity-80 font-mono-tabular">
                      {adminSummaryAnalytics.topServiceByBookings?.bookedCount || 0} booked ·{' '}
                      {adminSummaryAnalytics.topServiceByBookings?.completedCount || 0} completed
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-1">
                    <div className="text-xs opacity-75 font-semibold">
                      Average Revenue per Client
                    </div>
                    <div className="text-2xl font-extrabold font-mono-tabular">
                      SLE {adminSummaryAnalytics.avgRevenuePerClientSLE.toLocaleString()}
                    </div>
                    <div className="text-xs opacity-80 font-mono-tabular">
                      Across {clientsDB.length} registered{' '}
                      {clientsDB.length === 1 ? 'client' : 'clients'}
                    </div>
                  </div>
                </div>

                {/* Two-Column Analytics Grid: Top-Performing Services Leaderboard + Monthly Revenue Trends Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left 7 Cols: Top-Performing Services Leaderboard */}
                  <div className="lg:col-span-7 p-4 rounded-xl border border-[#E6DEC8] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DEC8] pb-2.5">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-[#D4AF37]" />
                          <span>Top-Performing Services (Ranked by Bookings &amp; Revenue)</span>
                        </h3>
                        <p className="text-xs opacity-75">
                          Click any service row to pre-fill the Secretary Record Sheet below.
                        </p>
                      </div>
                      <span className="text-xs font-mono-tabular opacity-75">
                        Showing top {Math.min(adminSummaryAnalytics.rankedServices.length, 6)} services
                      </span>
                    </div>

                    {adminSummaryAnalytics.rankedServices.length === 0 ? (
                      <div className="p-4 text-xs opacity-75 italic">
                        No services recorded for this filter yet. Book an appointment or log a session to populate service rankings.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E6DEC8]">
                        {adminSummaryAnalytics.rankedServices.slice(0, 6).map((svc, idx) => (
                          <button
                            key={svc.treatment}
                            type="button"
                            onClick={() => {
                              setSheetSecTreatment(svc.treatment);
                              showNotification(
                                `Selected "${svc.treatment}" on the Client Record Sheet.`
                              );
                            }}
                            className="w-full py-2.5 px-2 text-left hover:bg-amber-50/20 transition flex flex-col gap-1.5 group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-md bg-[#3B0944] text-[#F3E5AB] font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs sm:text-sm truncate group-hover:text-[#D4AF37] transition-colors">
                                    {svc.treatment}
                                  </div>
                                  <div className="text-[11px] opacity-75 font-mono-tabular">
                                    {svc.category} · {svc.bookedCount} booked · {svc.completedCount}{' '}
                                    completed
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 font-mono-tabular">
                                <div className="font-bold text-xs sm:text-sm text-[#D4AF37]">
                                  SLE {svc.activeRevenueSLE.toLocaleString()}
                                </div>
                                <div className="text-[11px] opacity-75">
                                  {svc.sharePct}% of volume
                                </div>
                              </div>
                            </div>

                            <div className="w-full h-1.5 rounded-full bg-[#E6DEC8]/60 overflow-hidden">
                              <div
                                className="h-full bg-[#D4AF37] rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(svc.sharePct, 8)}%` }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right 5 Cols: Monthly Revenue & Treatment Trends Chart */}
                  <div className="lg:col-span-5 p-4 rounded-xl border border-[#E6DEC8] space-y-3">
                    <div className="border-b border-[#E6DEC8] pb-2.5">
                      <h3 className="font-bold text-sm flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
                        <span>Monthly Revenue Trends (SLE)</span>
                      </h3>
                      <p className="text-xs opacity-75">
                        Realized session receipts vs. booked appointment pipeline by month.
                      </p>
                    </div>

                    <div className="h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height={245} minWidth={0}>
                        <BarChart data={adminSummaryAnalytics.monthlyRevenueTrends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E6DEC8" />
                          <XAxis dataKey="month" stroke="#5C4D63" fontSize={12} />
                          <YAxis
                            stroke="#5C4D63"
                            fontSize={11}
                            tickFormatter={val => `SLE ${val}`}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [
                              `SLE ${Number(value || 0).toLocaleString()}`,
                              name
                            ]}
                            contentStyle={{
                              backgroundColor: '#FAF7F2',
                              color: '#1F1624',
                              borderRadius: '12px',
                              border: '1px solid #D4AF37',
                              fontSize: '12px'
                            }}
                          />
                          <Bar
                            dataKey="realizedSLE"
                            name="Realized Revenue (Completed)"
                            fill="#3B0944"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="bookedSLE"
                            name="Booked Pipeline Revenue"
                            fill="#D4AF37"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular pt-1 border-t border-[#E6DEC8]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#3B0944] inline-block" />
                        <span>Realized: SLE {adminSummaryAnalytics.totalRealizedSLE.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37] inline-block" />
                        <span>Booked: SLE {adminSummaryAnalytics.totalBookedSLE.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* TODAY'S APPOINTMENTS VISUAL ALERT & SUMMARY SECTION */}
              <div
                className="theming-card p-5 rounded-2xl border-2 border-[#D4AF37] space-y-4"
                role="region"
                aria-label="Today's appointments summary"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DEC8] pb-3">
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck className="w-6 h-6 text-[#D4AF37] shrink-0" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-bold">
                          Today's Appointments Alert & Schedule
                        </h2>
                        <span aria-hidden="true">·</span>
                        <span className="text-xs font-mono-tabular font-semibold text-[#D4AF37]">
                          {todayStr} ({todaysScheduledItems.length}{' '}
                          {todaysScheduledItems.length === 1 ? 'Client' : 'Clients'} Scheduled Today)
                        </span>
                      </div>
                      <p className="text-xs opacity-75">
                        Clients scheduled for today at 101 Jomo Kenyatta Road. Click any appointment to load their Record Sheet or send a WhatsApp reminder.
                      </p>
                    </div>
                  </div>
                </div>

                {todaysScheduledItems.length === 0 ? (
                  <div className="p-4 rounded-xl border border-[#E6DEC8] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs opacity-80">
                      No clients are currently booked for today (<span className="font-mono-tabular">{todayStr}</span>). You can create a walk-in sheet or schedule a visit in the Customer Portal.
                    </div>
                    <button
                      type="button"
                      onClick={createNewWalkInClient}
                      className="px-3.5 py-2 rounded-lg gold-btn text-xs whitespace-nowrap"
                    >
                      + Log Walk-In Client for Today
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {todaysScheduledItems.map(({ client, appt }) => {
                      const isCurrentSheet = client.id === selectedClientId;
                      return (
                        <div
                          key={appt.id}
                          className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                            isCurrentSheet
                              ? 'border-2 border-[#D4AF37] bg-amber-50/15'
                              : 'border-[#E6DEC8] hover:border-[#D4AF37]'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#D4AF37] bg-[#3B0944] text-[#F3E5AB] flex items-center justify-center font-bold text-xs shrink-0">
                                  {client.avatarBase64 ? (
                                    <img
                                      src={client.avatarBase64}
                                      alt={client.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span>{getClientInitials(client.name)}</span>
                                  )}
                                </div>
                                <span className="font-bold text-sm truncate">{client.name}</span>
                              </div>
                              <span className="text-xs font-mono-tabular font-bold text-[#D4AF37] shrink-0">
                                Today at {appt.time}
                              </span>
                            </div>
                            <div className="text-xs font-semibold">{appt.treatment}</div>
                            <div className="text-xs opacity-75 font-mono-tabular">
                              {client.phone || 'No phone'} · {appt.status || 'Confirmed'}
                            </div>
                            {appt.notes && (
                              <div className="text-xs opacity-80 italic">
                                Note: "{appt.notes}"
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6DEC8]">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setSheetSecTreatment(appt.treatment);
                              }}
                              className="px-3 py-1.5 rounded-lg gold-btn text-xs whitespace-nowrap"
                            >
                              {isCurrentSheet
                                ? 'Loaded on Record Sheet ✓'
                                : 'Open Client Record Sheet'}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClientId(client.id);
                                  setWhatsAppModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp Client</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAppointment(client.id, appt.id)}
                                className="p-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition"
                                title="Delete Appointment"
                                aria-label={`Delete appointment for ${client.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CONSOLIDATED ALL UPCOMING APPOINTMENTS & RECENT HISTORY */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Upcoming Appointments */}
                <div className="theming-card p-5 rounded-2xl border-2 border-[#D4AF37] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-[#D4AF37]" />
                      <span>All Upcoming Appointments ({allUpcomingAppointments.length})</span>
                    </h2>
                    <span className="text-xs opacity-75">Tap any row to load sheet</span>
                  </div>
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {allUpcomingAppointments.length === 0 ? (
                      <p className="text-xs opacity-70 italic">No upcoming appointments scheduled.</p>
                    ) : (
                      allUpcomingAppointments.map((appt, idx) => (
                        <div
                          key={`${appt.clientId}_${appt.id}_${idx}`}
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClientId(appt.clientId);
                              setSheetSecTreatment(appt.treatment);
                            }}
                            className={`flex-1 min-w-0 text-left p-3 rounded-xl border transition text-xs space-y-1 ${
                              appt.clientId === selectedClientId
                                ? 'border-2 border-[#D4AF37] bg-amber-50/15'
                                : 'border-[#E6DEC8] hover:border-[#D4AF37]'
                            }`}
                          >
                            <div className="flex justify-between font-bold">
                              <span className="truncate">{appt.clientName}</span>
                              <span className="font-mono-tabular text-[#D4AF37] shrink-0">
                                {appt.date} · {appt.time}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{appt.treatment}</span>
                              {appt.frequency && appt.frequency !== 'None' && (
                                <span className="text-[11px] font-semibold text-purple-800 dark:text-amber-300 shrink-0">
                                  {appt.frequency}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAppointment(appt.clientId, appt.id)}
                            className="p-2.5 rounded-xl border border-[#E6DEC8] hover:border-red-500 hover:bg-red-50 text-red-600 transition shrink-0"
                            title={`Delete ${appt.treatment}`}
                            aria-label={`Delete appointment ${appt.treatment}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Client History */}
                <div className="theming-card p-5 rounded-2xl border-2 border-[#D4AF37] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold flex items-center gap-2">
                      <History className="w-5 h-5 text-[#D4AF37]" />
                      <span>Recent Client History</span>
                    </h2>
                    <span className="text-xs opacity-75">Tap any row to load sheet</span>
                  </div>
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {recentClientHistory.length === 0 ? (
                      <p className="text-xs opacity-70 italic">No past sessions recorded yet.</p>
                    ) : (
                      recentClientHistory.map((hist, idx) => (
                        <div
                          key={`${hist.clientId}_${hist.id}_${idx}`}
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(hist.clientId)}
                            className={`flex-1 min-w-0 text-left p-3 rounded-xl border transition text-xs space-y-1 ${
                              hist.clientId === selectedClientId
                                ? 'border-2 border-[#D4AF37] bg-amber-50/15'
                                : 'border-[#E6DEC8] hover:border-[#D4AF37]'
                            }`}
                          >
                            <div className="flex justify-between font-bold">
                              <span className="truncate">{hist.clientName}</span>
                              <span className="font-mono-tabular opacity-80 shrink-0">
                                {hist.dayDateTime}
                              </span>
                            </div>
                            <div className="font-medium text-[#D4AF37] truncate">
                              {hist.treatment}
                            </div>
                            <div className="opacity-75 truncate">{hist.notes}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHistoryEntry(hist.clientId, hist.id)}
                            className="p-2.5 rounded-xl border border-[#E6DEC8] hover:border-red-500 hover:bg-red-50 text-red-600 transition shrink-0"
                            title={`Delete ${hist.treatment}`}
                            aria-label={`Delete history session ${hist.treatment}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* INSTANT CLIENT SEARCH BAR (By Phone Number, Email, or Name) */}
              <div className="theming-card p-5 rounded-2xl border border-[#D4AF37] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold flex items-center gap-2">
                      <Search className="w-5 h-5 text-[#D4AF37]" />
                      <span>Instant Client Search, View Inspection & Email Response</span>
                    </h2>
                    <p className="text-xs opacity-75">
                      Select any client below to inspect their New Appointments and Past History, respond as <strong className="font-mono-tabular">{PRIMARY_ADMIN_EMAIL}</strong>, or print their Record Sheet.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={adminSearchQuery}
                    onChange={e => setAdminSearchQuery(e.target.value)}
                    placeholder="Search by Phone (e.g. +23277...) or Email or Name..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium focus:border-[#3B0944] outline-none"
                    aria-label="Admin client search"
                  />
                  <button
                    type="button"
                    onClick={createNewWalkInClient}
                    className="px-4 py-2.5 rounded-xl plum-btn text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                    <span>+ Walk-In Client Sheet</span>
                  </button>
                </div>

                {/* Search Results Cards */}
                <div
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2"
                  aria-live="polite"
                >
                  {filteredClients.length === 0 ? (
                    <p className="text-xs opacity-70 italic">No matching clients found.</p>
                  ) : (
                    filteredClients.map(c => {
                      const isSelected = c.id === selectedClientId;
                      return (
                        <div key={c.id} className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(c.id)}
                            className={`p-3.5 rounded-xl text-left border transition flex-1 min-w-0 flex items-center gap-3 ${
                              isSelected
                                ? 'border-2 border-[#D4AF37] bg-amber-50/15'
                                : 'border-[#E6DEC8] hover:border-[#D4AF37]/60'
                            }`}
                          >
                            {/* Circular Client Avatar in Admin List */}
                            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-[#3B0944] text-[#F3E5AB] flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              {c.avatarBase64 ? (
                                <img
                                  src={c.avatarBase64}
                                  alt={c.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{getClientInitials(c.name)}</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm flex items-center justify-between gap-2">
                                <span className="truncate">{c.name}</span>
                                <span className="text-xs font-semibold text-[#D4AF37] shrink-0">
                                  {isSelected ? 'Active Sheet ✓' : 'Select'}
                                </span>
                              </div>
                              <div className="text-xs opacity-80 mt-0.5 font-mono-tabular truncate">
                                {c.phone || 'No phone'} · {c.email || 'No email'}
                              </div>
                              <div className="text-xs opacity-70 mt-0.5 font-mono-tabular flex flex-wrap items-center gap-x-2">
                                <span>
                                  New Appts: <strong>{(c.newAppointments || []).length}</strong> · Past History:{' '}
                                  <strong>{(c.pastHistory || []).length}</strong>
                                </span>
                                {calculatePatientAge(c.dob) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[11px]">
                                    Age: {calculatePatientAge(c.dob)?.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              requestDeleteClient(c.id);
                            }}
                            className="p-3.5 rounded-xl border border-[#E6DEC8] hover:border-red-500 hover:bg-red-50 transition text-red-600 shrink-0"
                            title={`Delete ${c.name}`}
                            aria-label={`Delete ${c.name}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ADMIN WORKSPACE GRID: CLIENT RECORD SHEET (3 COLS) + QUICK NOTES SIDEBAR (1 COL) */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* AUTO-FILL CLIENT RECORD PAPER (Digital & Printable Sheet) */}
                <section
                  id="printable-record-paper"
                  className="lg:col-span-3 theming-card rounded-2xl p-6 shadow-md border-2 border-[#3B0944] space-y-6"
                  role="region"
                  aria-label="Client record paper"
                >
                  {/* Official Clinic Letterhead */}
                  <div className="border-b-2 border-[#D4AF37] pb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold tracking-wider text-[#D4AF37]">
                        Official Clinic Record Sheet · Admin: {PRIMARY_ADMIN_EMAIL}
                      </span>
                      <h2 className="font-display text-2xl md:text-3xl font-bold mt-0.5">
                        Sidratu Beauty Therapy Skin Care
                      </h2>
                      <p className="text-xs opacity-80">
                        101 Jomo Kenyatta Road, Freetown, Sierra Leone
                      </p>
                    </div>

                    {/* Day, Date & Exact Time of Visit Stamp */}
                    <div className="bg-amber-50 text-gray-900 border border-[#D4AF37] rounded-xl p-3 text-right min-w-[250px]">
                      <label
                        className="block text-xs font-bold text-purple-900"
                        htmlFor="sheet-visit-datetime"
                      >
                        Day, Date & Time of Visit
                      </label>
                      <input
                        type="text"
                        id="sheet-visit-datetime"
                        value={sheetVisitDateTime}
                        onChange={e => setSheetVisitDateTime(e.target.value)}
                        className="w-full text-right font-mono-tabular font-bold text-xs bg-transparent border-b border-dashed border-gray-400 focus:outline-none py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setSheetVisitDateTime(getFormattedDayDateTime())}
                        className="no-print text-xs text-purple-800 underline mt-1"
                      >
                        Stamp Current Day & Time Now
                      </button>
                    </div>
                  </div>

                  {/* Client Profile Avatar Header & Upload/Camera Controls on Record Sheet */}
                  <div className="p-4 rounded-xl border border-[#E6DEC8] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-[#3B0944] text-[#F3E5AB] flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                        {sheetClientAvatar ? (
                          <img
                            src={sheetClientAvatar}
                            alt={sheetClientName || 'Client Avatar'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getClientInitials(sheetClientName)}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-base flex flex-wrap items-center gap-2">
                          <span>{sheetClientName || 'No Client Selected'}</span>
                          {activeSheetAgeInfo && (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                activeSheetAgeInfo.isMinor
                                  ? 'bg-amber-100 text-amber-900 border-amber-400'
                                  : 'bg-[#3B0944] text-[#F3E5AB] border-[#D4AF37]'
                              }`}
                            >
                              <Cake className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>{activeSheetAgeInfo.label}</span>
                              <span className="opacity-80">· {activeSheetAgeInfo.category}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs opacity-75">
                          Client Identification Avatar · Displayed in Admin Directory & Record Sheet
                        </p>
                        <div className="no-print flex flex-wrap items-center gap-2 pt-1">
                          {!avatarCameraActive ? (
                            <button
                              type="button"
                              onClick={startAvatarCamera}
                              className="px-3 py-1.5 rounded-lg plum-btn text-xs font-bold flex items-center gap-1.5"
                            >
                              <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>Capture Photo</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopAvatarCamera}
                              className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Close Camera</span>
                            </button>
                          )}

                          <label className="px-3 py-1.5 rounded-lg gold-btn text-xs font-bold cursor-pointer flex items-center gap-1.5">
                            <span>Upload Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = ev =>
                                    updateClientAvatarPhoto(ev.target?.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>

                          {sheetClientAvatar && (
                            <button
                              type="button"
                              onClick={() => updateClientAvatarPhoto(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Photo</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {avatarCameraActive && (
                      <div className="no-print p-3 rounded-xl border-2 border-[#D4AF37] bg-black/90 w-full sm:w-64 space-y-2">
                        <video
                          ref={avatarVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={captureAvatarCameraFrame}
                          className="w-full py-2 rounded-lg gold-btn text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Snap Client Avatar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto-Filled Client Personal & Clinical Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold opacity-75 mb-1">
                        Client Full Name
                      </label>
                      <input
                        type="text"
                        value={sheetClientName}
                        onChange={e => setSheetClientName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold opacity-75 mb-1">
                        Phone Number (WhatsApp)
                      </label>
                      <input
                        type="text"
                        value={sheetClientPhone}
                        onChange={e => setSheetClientPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold opacity-75 mb-1">
                        Email Address
                      </label>
                      <input
                        type="text"
                        value={sheetClientEmail}
                        onChange={e => setSheetClientEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold opacity-75 mb-1">
                        Home Address
                      </label>
                      <input
                        type="text"
                        value={sheetClientAddress}
                        onChange={e => setSheetClientAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold opacity-75 mb-1">
                        Skin Type & Allergies
                      </label>
                      <input
                        type="text"
                        value={sheetClientAllergies}
                        onChange={e => setSheetClientAllergies(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          className="block text-xs font-bold opacity-75"
                          htmlFor="sheet-client-dob"
                        >
                          Date of Birth
                        </label>
                        {activeSheetAgeInfo ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold font-mono-tabular ${
                              activeSheetAgeInfo.isMinor
                                ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                : 'bg-purple-100 text-[#3B0944] border border-purple-300'
                            }`}
                          >
                            <Cake className="w-3 h-3 text-[#3B0944]" />
                            <span>Current Age: {activeSheetAgeInfo.label}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] opacity-60 italic">
                            Enter DOB to auto-calculate age
                          </span>
                        )}
                      </div>
                      <input
                        id="sheet-client-dob"
                        type="date"
                        value={sheetClientDOB}
                        onChange={e => setSheetClientDOB(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular"
                      />
                    </div>
                  </div>

                  {/* Automatic Patient Age & Age-Appropriate Clinical Decision Support Panel */}
                  <div
                    className={`p-4 rounded-xl border-2 transition ${
                      activeSheetAgeInfo
                        ? activeSheetAgeInfo.isMinor
                          ? 'bg-amber-50/90 text-gray-900 border-amber-400'
                          : 'bg-purple-50/60 text-gray-900 border-[#D4AF37]'
                        : 'bg-gray-50/60 text-gray-700 border-dashed border-gray-300'
                    }`}
                    role="region"
                    aria-label="Patient Current Age and Clinical Decision Guidance"
                  >
                    {activeSheetAgeInfo ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/40 pb-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold text-xs border border-[#D4AF37]">
                              <Cake className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>Patient Current Age: {activeSheetAgeInfo.detailedLabel}</span>
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-[#D4AF37] text-[#3B0944] font-bold text-xs">
                              {activeSheetAgeInfo.category}
                            </span>
                            {activeSheetAgeInfo.isBirthdayMonth && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-200 text-amber-950 font-bold text-xs">
                                Birthday Month — Eligible for Loyalty Treat
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              activeSheetAgeInfo.isMinor
                                ? 'bg-amber-200 text-amber-950'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {activeSheetAgeInfo.consentRequirement}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-[#E6DEC8]">
                            <div className="font-bold text-[#3B0944] mb-0.5">
                              Clinical Overview
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                              {activeSheetAgeInfo.clinicalGuidance}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-[#E6DEC8]">
                            <div className="font-bold text-[#3B0944] mb-0.5">
                              Age-Appropriate Skin & Aesthetics Protocol
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                              {activeSheetAgeInfo.skinProtocol}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-[#E6DEC8]">
                            <div className="font-bold text-[#3B0944] mb-0.5">
                              Age-Appropriate Dental Care Protocol
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                              {activeSheetAgeInfo.dentalProtocol}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-semibold text-[#3B0944]">
                          <Cake className="w-4 h-4 text-[#D4AF37]" />
                          <span>
                            Patient Age Not Yet Calculated — Select or enter a Date of Birth above to automatically display the patient&apos;s current age and age-appropriate clinical protocols.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Unified Sections on the Record Paper: "New Appointment" & "Past History" with Direct Admin Response */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* New Appointment Column */}
                    <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-3">
                      <h3 className="font-bold text-sm text-[#D4AF37] flex items-center gap-1.5">
                        <CalendarCheck className="w-4 h-4" />
                        <span>New Appointment (View & Respond as {PRIMARY_ADMIN_EMAIL})</span>
                      </h3>
                      <div className="text-sm space-y-3 max-h-96 overflow-y-auto">
                        {!selectedAdminClient?.newAppointments?.length ? (
                          <p className="text-xs opacity-70 italic">
                            No scheduled New Appointment on file.
                          </p>
                        ) : (
                          selectedAdminClient.newAppointments.map(a => {
                            const draftKey = `appt_${a.id}`;
                            return (
                              <div
                                key={a.id}
                                className="p-3 rounded-lg bg-emerald-50 text-gray-900 border border-emerald-200 space-y-2"
                              >
                                <div>
                                  <div className="font-bold text-xs flex items-center justify-between gap-2">
                                    <span>{a.treatment}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-emerald-800">
                                        {a.status || 'Confirmed'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteAppointment(selectedAdminClient.id, a.id)
                                        }
                                        className="no-print p-1 rounded text-red-600 hover:bg-red-100 transition"
                                        title="Delete Appointment"
                                        aria-label={`Delete appointment ${a.treatment}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs font-mono-tabular">
                                    Date: <strong>{a.date}</strong> at <strong>{a.time}</strong>
                                    {a.frequency && a.frequency !== 'None' && (
                                      <span className="ml-1.5 font-bold text-purple-900">
                                        ({a.frequency})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs opacity-80">
                                    Consent Signed by: <strong>{a.consentSignedBy}</strong>
                                  </div>
                                  {a.notes && (
                                    <div className="text-xs italic mt-0.5">
                                      Client Note: "{a.notes}"
                                    </div>
                                  )}
                                  <div className="text-xs opacity-75 font-mono-tabular">
                                    Booked: {a.createdAt}
                                  </div>
                                </div>

                                {a.adminResponse && (
                                  <div className="p-2 rounded bg-white border border-emerald-300 text-xs space-y-0.5">
                                    <div className="font-bold text-purple-900">
                                      Responded ({a.adminRespondedBy || PRIMARY_ADMIN_EMAIL}):
                                    </div>
                                    <div>{a.adminResponse}</div>
                                  </div>
                                )}

                                {/* Admin Direct Response Input */}
                                <div className="no-print pt-1 space-y-1.5 border-t border-emerald-200">
                                  <input
                                    type="text"
                                    value={replyDrafts[draftKey] || ''}
                                    onChange={e =>
                                      setReplyDrafts(prev => ({
                                        ...prev,
                                        [draftKey]: e.target.value
                                      }))
                                    }
                                    placeholder={`Write response from ${PRIMARY_ADMIN_EMAIL}...`}
                                    className="w-full px-2.5 py-1.5 rounded border border-gray-300 bg-white text-gray-900 text-xs"
                                  />
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdminRespondToAppointment(
                                          selectedAdminClient.id,
                                          a.id,
                                          false
                                        )
                                      }
                                      className="px-2.5 py-1 rounded gold-btn text-xs flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>Post Response</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdminRespondToAppointment(
                                          selectedAdminClient.id,
                                          a.id,
                                          true
                                        )
                                      }
                                      className="px-2.5 py-1 rounded plum-btn text-xs flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Mail className="w-3 h-3 text-[#D4AF37]" />
                                      <span>Respond via Email</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Past History Column (Includes Private Specialist Notes & Before/After Photos for Admin) */}
                    <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-sm text-[#D4AF37] flex items-center gap-1.5">
                          <History className="w-4 h-4" />
                          <span>Past History (Sessions, Specialist Notes & Follow-Up)</span>
                        </h3>
                        <div className="no-print flex items-center gap-1.5">
                          <label
                            htmlFor="admin-history-sort"
                            className="text-[11px] font-bold opacity-80 whitespace-nowrap"
                          >
                            Sort:
                          </label>
                          <select
                            id="admin-history-sort"
                            value={historySortOrder}
                            onChange={e =>
                              setHistorySortOrder(
                                e.target.value as
                                  | 'date-newest'
                                  | 'date-oldest'
                                  | 'treatment-asc'
                                  | 'treatment-desc'
                              )
                            }
                            aria-label="Sort client past history"
                            className="px-2 py-1 rounded border border-[#D4AF37] bg-white text-gray-900 text-[11px] font-semibold focus:outline-none"
                          >
                            <option value="date-newest">Date (Newest)</option>
                            <option value="date-oldest">Date (Oldest)</option>
                            <option value="treatment-asc">Treatment (A–Z)</option>
                            <option value="treatment-desc">Treatment (Z–A)</option>
                          </select>
                        </div>
                      </div>
                      <div className="text-sm space-y-3 max-h-96 overflow-y-auto">
                        {!sortedAdminHistory.length ? (
                          <p className="text-xs opacity-70 italic">
                            No Past History sessions recorded yet.
                          </p>
                        ) : (
                          sortedAdminHistory.map(h => {
                            const draftKey = `hist_${h.id}`;
                            const specKey = `spec_${h.id}`;
                            const currentSpecVal =
                              specialistNoteDrafts[specKey] !== undefined
                                ? specialistNoteDrafts[specKey]
                                : h.specialistNotes || '';

                            return (
                              <div
                                key={h.id}
                                className="p-3 rounded-lg bg-amber-50/70 text-gray-900 border border-amber-200 space-y-2"
                              >
                                <div>
                                  <div className="font-bold text-xs flex items-center justify-between gap-2">
                                    <span>{h.treatment}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteHistoryEntry(selectedAdminClient.id, h.id)
                                      }
                                      className="no-print p-1 rounded text-red-600 hover:bg-red-100 transition"
                                      title="Delete Past History Session"
                                      aria-label={`Delete session ${h.treatment}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="text-xs font-mono-tabular font-semibold text-purple-900">
                                    {h.dayDateTime}
                                  </div>
                                  <div className="text-xs">{h.ratingOrPayment}</div>
                                  <div className="text-xs opacity-80">{h.notes}</div>
                                </div>

                                {/* Before / After Progress Photo */}
                                {h.photoBase64 && (
                                  <div className="pt-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-emerald-900">
                                        Attached Progress Photo:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removePhotoFromExistingHistory(
                                            selectedAdminClient.id,
                                            h.id
                                          )
                                        }
                                        className="no-print text-[11px] text-red-600 font-bold flex items-center gap-0.5 hover:underline"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete Photo</span>
                                      </button>
                                    </div>
                                    <img
                                      src={h.photoBase64}
                                      alt="Before and After Progress"
                                      className="h-24 w-24 object-cover rounded-lg border border-[#D4AF37]"
                                    />
                                  </div>
                                )}

                                {/* Private Internal Specialist Notes (Admin/Staff Only) */}
                                <div className="p-2 rounded bg-purple-100/80 border border-purple-300 text-xs space-y-1.5">
                                  <div className="font-bold text-purple-950 flex items-center justify-between">
                                    <span>Internal Specialist Notes (Private — Staff Only):</span>
                                  </div>
                                  {h.specialistNotes && (
                                    <div className="italic text-purple-900">{h.specialistNotes}</div>
                                  )}
                                  <div className="no-print flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={currentSpecVal}
                                      onChange={e =>
                                        setSpecialistNoteDrafts(prev => ({
                                          ...prev,
                                          [specKey]: e.target.value
                                        }))
                                      }
                                      placeholder="Add/edit private clinical observation..."
                                      className="flex-1 px-2 py-1 rounded border border-purple-300 bg-white text-gray-900 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveSpecialistNoteOnHistory(selectedAdminClient.id, h.id)
                                      }
                                      className="px-2 py-1 rounded plum-btn text-[11px] font-bold whitespace-nowrap"
                                    >
                                      Save Note
                                    </button>
                                  </div>
                                  <div className="no-print flex items-center justify-between pt-1">
                                    <label className="text-[11px] font-semibold text-purple-900 cursor-pointer underline">
                                      <span>+ Attach/Replace Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onload = ev =>
                                              attachPhotoToExistingHistory(
                                                selectedAdminClient.id,
                                                h.id,
                                                ev.target?.result as string
                                              );
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>

                                {h.adminResponse && (
                                  <div className="p-2 rounded bg-white border border-amber-300 text-xs space-y-0.5">
                                    <div className="font-bold text-purple-900">
                                      Customer-Visible Follow-Up ({h.adminRespondedBy || PRIMARY_ADMIN_EMAIL}):
                                    </div>
                                    <div>{h.adminResponse}</div>
                                  </div>
                                )}

                                {/* Admin Direct Response Input for Past History */}
                                <div className="no-print pt-1 space-y-1.5 border-t border-amber-200">
                                  <input
                                    type="text"
                                    value={replyDrafts[draftKey] || ''}
                                    onChange={e =>
                                      setReplyDrafts(prev => ({
                                        ...prev,
                                        [draftKey]: e.target.value
                                      }))
                                    }
                                    placeholder={`Reply to client as ${PRIMARY_ADMIN_EMAIL}...`}
                                    className="w-full px-2.5 py-1.5 rounded border border-gray-300 bg-white text-gray-900 text-xs"
                                  />
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdminRespondToHistory(
                                          selectedAdminClient.id,
                                          h.id,
                                          false
                                        )
                                      }
                                      className="px-2.5 py-1 rounded gold-btn text-xs flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>Post Follow-Up</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdminRespondToHistory(
                                          selectedAdminClient.id,
                                          h.id,
                                          true
                                        )
                                      }
                                      className="px-2.5 py-1 rounded plum-btn text-xs flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Mail className="w-3 h-3 text-[#D4AF37]" />
                                      <span>Email Client</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECRETARY & OWNER ADMINISTRATIVE RECORD BOX */}
                  <div className="p-4 rounded-xl bg-purple-950/10 border border-[#D4AF37] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
                        <span>Secretary & Admin Office Log (In-Clinic Payment, Session & Camera)</span>
                      </h3>
                      <span className="text-xs opacity-75">
                        Staff Only — Logged under {PRIMARY_ADMIN_EMAIL}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          Treatment Performed Today
                        </label>
                        <input
                          type="text"
                          value={sheetSecTreatment}
                          onChange={e => setSheetSecTreatment(e.target.value)}
                          placeholder="e.g. PRP Session 1 / Braces Adjustment"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          Manual Payment / Receipt Log (SLE)
                        </label>
                        <input
                          type="text"
                          value={sheetSecPayment}
                          onChange={e => setSheetSecPayment(e.target.value)}
                          placeholder="e.g. Paid Full Cash / Receipt #104"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono-tabular"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          Attending Specialist / Admin
                        </label>
                        <input
                          type="text"
                          value={sheetSecSpecialist}
                          onChange={e => setSheetSecSpecialist(e.target.value)}
                          placeholder={`e.g. Sidratu (${PRIMARY_ADMIN_EMAIL})`}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">
                        Clinical Report & Next Follow-Up Instructions (Shared with Client)
                      </label>
                      <textarea
                        rows={2}
                        value={sheetSecNotes}
                        onChange={e => setSheetSecNotes(e.target.value)}
                        placeholder="Record clinical observations, products used, or next appointment date..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-purple-900 dark:text-amber-300">
                        Internal Specialist Notes (Private — Hidden from Customer)
                      </label>
                      <textarea
                        rows={2}
                        value={sheetSecSpecialistNotes}
                        onChange={e => setSheetSecSpecialistNotes(e.target.value)}
                        placeholder="Private clinical observations not shared with the customer..."
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-200 bg-purple-50/70 text-gray-900"
                      />
                    </div>

                    {/* Camera Access & Photo Upload for Before/After Progress */}
                    <div className="no-print space-y-2">
                      <label className="block text-xs font-bold mb-1">
                        Before / After Progress Photo (Live Camera or Upload)
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {!cameraActive ? (
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-3.5 py-2 rounded-lg plum-btn text-xs font-bold flex items-center gap-1.5"
                          >
                            <Camera className="w-4 h-4 text-[#D4AF37]" />
                            <span>Open Camera to Snap Photo</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="px-3.5 py-2 rounded-lg bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            <span>Close Camera</span>
                          </button>
                        )}

                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = ev => setSheetSecPhoto(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="text-xs"
                        />
                        {sheetSecPhoto && (
                          <button
                            type="button"
                            onClick={() => setSheetSecPhoto(null)}
                            className="text-xs text-red-600 font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Remove Photo</span>
                          </button>
                        )}
                      </div>

                      {cameraActive && (
                        <div className="p-3 rounded-xl border-2 border-[#D4AF37] bg-black/90 max-w-sm space-y-2">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={captureCameraFrame}
                            className="w-full py-2 rounded-lg gold-btn text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Capture Before/After Photo</span>
                          </button>
                        </div>
                      )}

                      {sheetSecPhoto && (
                        <img
                          src={sheetSecPhoto}
                          alt="Preview"
                          className="mt-2 h-24 w-24 object-cover rounded-lg border-2 border-[#D4AF37]"
                        />
                      )}
                    </div>
                  </div>

                  {/* OFFICIAL ADMIN AUTHORIZATION & SIGNATURE BLOCK (Printable & Customizable) */}
                  <div className="p-4 rounded-xl border border-[#D4AF37] bg-amber-50/50 text-gray-900 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold tracking-wider uppercase text-purple-900 flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Authorized Admin Signature &amp; Clinical Stamp</span>
                      </div>
                      <div
                        className={`text-[#3B0944] ${
                          adminSignature.signatureStyle === 'script'
                            ? 'font-display italic text-2xl font-bold'
                            : adminSignature.signatureStyle === 'stamp'
                            ? 'font-mono-tabular uppercase tracking-widest text-base font-extrabold border-2 border-[#3B0944] px-2.5 py-0.5 inline-block rounded'
                            : 'font-display text-xl font-bold'
                        }`}
                      >
                        {adminSignature.signerName}
                      </div>
                      <div className="text-xs font-semibold text-gray-800">
                        {adminSignature.signerTitle} ·{' '}
                        <span className="font-mono-tabular">{adminSignature.signerEmail}</span>
                      </div>
                      <div className="text-[11px] opacity-75">
                        {adminSignature.verificationNote}
                      </div>
                    </div>

                    <div className="no-print flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSheetSecSpecialist(
                            `${adminSignature.signerName} (${adminSignature.signerEmail})`
                          );
                          showNotification(
                            `Stamped "${adminSignature.signerName}" as Attending Specialist.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#3B0944] text-[#3B0944] hover:bg-purple-100 text-xs font-bold transition whitespace-nowrap"
                      >
                        Stamp Specialist Field
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingAdminSig(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg plum-btn text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PenTool className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Change Admin Signature</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Bar: Save Record, Print/PDF, Delete Client, Export JSON, Email Dispatch, WhatsApp */}
                  <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={saveAdminRecordSheet}
                        className="px-5 py-2.5 rounded-xl gold-btn text-sm shadow flex items-center gap-2 whitespace-nowrap"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save Record & Session</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-2.5 rounded-xl plum-btn text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
                      >
                        <Printer className="w-4 h-4 text-[#D4AF37]" />
                        <span>Print / Save as PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => requestDeleteClient(selectedAdminClient?.id || selectedClientId)}
                        disabled={clientsDB.length === 0}
                        className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2 shadow whitespace-nowrap"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Client Sheet</span>
                      </button>

                      <button
                        type="button"
                        onClick={exportClientsToJson}
                        className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold flex items-center gap-2 shadow whitespace-nowrap"
                      >
                        <Save className="w-4 h-4" />
                        <span>Export Database (JSON)</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEmailModalData({
                            clientName: sheetClientName,
                            clientEmail: sheetClientEmail || 'client@example.com',
                            subject: `Sidratu Beauty Therapy — Clinic Record & Appointment Confirmation`,
                            body: `Dear ${sheetClientName},\n\nThis is an official message from Sidratu Beauty Therapy Skin Care at 101 Jomo Kenyatta Road, Freetown.\n\nVisit Timestamp: ${sheetVisitDateTime}\nRecorded Notes: ${sheetSecNotes || 'Your appointment and clinical record sheet are up to date.'}\n\nWarm regards,\n${adminSignature.signerName}\n${adminSignature.signerTitle}\nSidratu Beauty Therapy Skin Care\nAdmin Email: ${adminSignature.signerEmail}`
                          })
                        }
                        className="px-4 py-2.5 rounded-xl plum-btn text-sm font-bold flex items-center gap-2 shadow whitespace-nowrap"
                      >
                        <Mail className="w-4 h-4 text-[#D4AF37]" />
                        <span>Email from {adminSignature.signerEmail}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWhatsAppModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold flex items-center gap-2 shadow whitespace-nowrap"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>One-Tap WhatsApp Reminder</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* PERSISTENT STAFF QUICK NOTES & REMINDERS SIDEBAR */}
                <aside
                  className="no-print theming-card rounded-2xl p-5 shadow-md border-2 border-[#D4AF37] space-y-4 sticky top-20"
                  aria-label="Client quick notes sidebar"
                >
                  <div className="border-b border-[#E6DEC8] pb-3">
                    <h3 className="font-display text-lg font-bold flex items-center gap-2">
                      <StickyNote className="w-5 h-5 text-[#D4AF37]" />
                      <span>Staff Quick Notes</span>
                    </h3>
                    <p className="text-xs opacity-75 mt-0.5">
                      Persistent staff reminders for <strong>{sheetClientName || 'Selected Client'}</strong> across sessions.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold opacity-80" htmlFor="quick-notes-box">
                      Client Reminders & Loyalty Notes
                    </label>
                    <textarea
                      id="quick-notes-box"
                      rows={5}
                      value={sheetQuickNotes}
                      onChange={e => setSheetQuickNotes(e.target.value)}
                      placeholder="e.g., Needs birthday discount, upcoming loyalty bonus, prefers gentle peel..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-amber-50/60 text-gray-900 text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold opacity-75">
                      1-Tap Quick Reminder Tags:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Needs Birthday Discount',
                        'Upcoming Loyalty Bonus',
                        'VIP Priority Client',
                        'Follow-Up Call Needed',
                        'Sensitive Skin Protocol'
                      ].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const updated = sheetQuickNotes
                              ? `${sheetQuickNotes.trim()} · ${tag}`
                              : tag;
                            saveQuickNotesOnly(updated);
                          }}
                          className="px-2 py-1 rounded-lg border border-[#D4AF37]/70 text-[11px] font-semibold hover:bg-amber-50/30 transition"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => saveQuickNotesOnly()}
                      className="w-full py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Notes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => saveQuickNotesOnly('')}
                      className="w-full py-2.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Notes</span>
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          NATIVE MOBILE BOTTOM TAB NAVIGATION BAR (Visible on Mobile Devices)
          ===================================================================== */}
      {currentUser && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 flex z-30 bg-[#3B0944] text-white border-t-2 border-[#D4AF37] px-1.5 py-1.5 items-center justify-around shadow-2xl no-print shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setMainView('customer');
              setCustomerSection('dashboard');
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
              mainView === 'customer' && customerSection === 'dashboard'
                ? 'text-[#D4AF37] bg-white/10'
                : 'text-gray-200 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainView('customer');
              setCustomerSection('new-appointment');
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
              mainView === 'customer' && customerSection === 'new-appointment'
                ? 'text-[#D4AF37] bg-white/10'
                : 'text-gray-200 hover:text-white'
            }`}
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Book</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainView('customer');
              setCustomerSection('past-history');
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
              mainView === 'customer' && customerSection === 'past-history'
                ? 'text-[#D4AF37] bg-white/10'
                : 'text-gray-200 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainView('customer');
              setCustomerSection('ai-community');
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
              mainView === 'customer' && customerSection === 'ai-community'
                ? 'text-[#D4AF37] bg-white/10'
                : 'text-gray-200 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Care</span>
          </button>

          {currentUser.role !== 'Customer' ? (
            <button
              type="button"
              onClick={() => setMainView('admin')}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
                mainView === 'admin'
                  ? 'text-[#D4AF37] bg-white/10'
                  : 'text-gray-200 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMainView('customer');
                setCustomerSection('services-goals');
              }}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition ${
                mainView === 'customer' && customerSection === 'services-goals'
                  ? 'text-[#D4AF37] bg-white/10'
                  : 'text-gray-200 hover:text-white'
              }`}
            >
              <Cake className="w-4 h-4" />
              <span>Goals</span>
            </button>
          )}
        </nav>
      )}

      {/* =====================================================================
          EMAIL RESPONSE DISPATCH MODAL (From Sidratu82sesay@gmail.com)
          ===================================================================== */}
      {emailModalData && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg w-full theming-card rounded-2xl shadow-2xl overflow-hidden border-2 border-[#D4AF37]">
            <div className="plum-header p-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-base text-[#F3E5AB] flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#D4AF37]" />
                <span>Admin Email Response</span>
              </h3>
              <button
                onClick={() => setEmailModalData(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Close Email modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="p-2.5 rounded-lg border border-[#E6DEC8] flex items-center justify-between">
                  <span className="opacity-75">From Admin Email:</span>
                  <strong className="font-mono-tabular text-[#D4AF37]">
                    {PRIMARY_ADMIN_EMAIL}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E6DEC8] flex items-center justify-between">
                  <span className="opacity-75">To Client:</span>
                  <strong className="font-mono-tabular">
                    {emailModalData.clientName} ({emailModalData.clientEmail})
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Subject</label>
                <input
                  type="text"
                  value={emailModalData.subject}
                  onChange={e =>
                    setEmailModalData({ ...emailModalData, subject: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Message Body</label>
                <textarea
                  rows={6}
                  value={emailModalData.body}
                  onChange={e =>
                    setEmailModalData({ ...emailModalData, body: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyEmailBody}
                  className="px-4 py-2.5 rounded-xl border border-[#D4AF37] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Copied Email</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Email Text</span>
                    </>
                  )}
                </button>
                <a
                  href={`mailto:${encodeURIComponent(
                    emailModalData.clientEmail
                  )}?cc=${encodeURIComponent(PRIMARY_ADMIN_EMAIL)}&subject=${encodeURIComponent(
                    emailModalData.subject
                  )}&body=${encodeURIComponent(emailModalData.body)}`}
                  onClick={() => setEmailModalData(null)}
                  className="px-4 py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Email Client</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          WHATSAPP REMINDER DISPATCH MODAL
          ===================================================================== */}
      {whatsAppModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg w-full theming-card rounded-2xl shadow-2xl overflow-hidden border-2 border-[#D4AF37]">
            <div className="plum-header p-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-base text-[#F3E5AB] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
                <span>WhatsApp Appointment Reminder</span>
              </h3>
              <button
                onClick={() => setWhatsAppModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Close WhatsApp modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="space-y-1">
                <div className="text-xs opacity-75">Recipient Client & Phone</div>
                <div className="font-bold font-mono-tabular">
                  {sheetClientName} ({sheetClientPhone || 'No phone number listed'})
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 text-gray-900 border border-emerald-200 text-xs leading-relaxed">
                {whatsAppText}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="px-4 py-2.5 rounded-xl border border-[#D4AF37] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedWhatsApp ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Copied Message</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Reminder Text</span>
                    </>
                  )}
                </button>
                {rawWhatsAppPhone && (
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWhatsAppModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Launch WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOP-RIGHT PROFILE & APP SETTINGS SLIDE-OUT DRAWER
          ===================================================================== */}
      {profileDrawerOpen && currentUser && (
        <>
          <div
            onClick={() => setProfileDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 z-40"
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 right-0 h-full w-full max-w-md theming-card z-50 shadow-2xl overflow-y-auto border-l-2 border-[#D4AF37]"
            role="dialog"
            aria-modal="true"
          >
            <div className="plum-header p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#3B0944] font-extrabold text-lg flex items-center justify-center border-2 border-white">
                  {userInitials}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#F3E5AB]">{currentUser.name}</h3>
                  <span className="text-xs text-[#D4AF37] font-semibold">
                    {currentUser.role} Account ({currentUser.email || PRIMARY_ADMIN_EMAIL})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setProfileDrawerOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Close profile drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* 1. App Settings (Easy on the Eyes & Accessibility) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-wider text-[#D4AF37]">
                  App Settings & Eye Comfort
                </h4>

                <label className="flex items-center justify-between p-3 rounded-xl border border-[#E6DEC8] cursor-pointer">
                  <div>
                    <div className="font-bold text-sm">Large Text / Easy Reading Mode</div>
                    <div className="text-xs opacity-75">Makes all words and buttons larger</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={largeTextMode}
                    onChange={e => setLargeTextMode(e.target.checked)}
                    className="w-5 h-5 accent-[#3B0944]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-[#E6DEC8] cursor-pointer">
                  <div>
                    <div className="font-bold text-sm">Luxury Dark Plum Theme</div>
                    <div className="text-xs opacity-75">Switch between Soft Cream & Dark Plum</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={darkPlumTheme}
                    onChange={e => setDarkPlumTheme(e.target.checked)}
                    className="w-5 h-5 accent-[#3B0944]"
                  />
                </label>
              </div>

              {/* 2. Personal Information & Beauty/Clinical Profile */}
              <form
                onSubmit={savePersonalProfile}
                className="space-y-3 pt-4 border-t border-[#E6DEC8]"
              >
                <h4 className="text-xs font-bold tracking-wider text-[#D4AF37]">
                  My Personal & Clinical Information
                </h4>

                <div>
                  <label className="block text-xs font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={e => setProfName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={profPhone}
                      onChange={e => setProfPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Email Address</label>
                    <input
                      type="text"
                      value={profEmail}
                      onChange={e => setProfEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1">Home Address</label>
                    <input
                      type="text"
                      value={profAddress}
                      onChange={e => setProfAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label className="block text-xs font-bold">Date of Birth</label>
                      {profileAgeInfo && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-[#3B0944] font-bold text-[11px] font-mono-tabular">
                          {profileAgeInfo.label}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={profDOB}
                      onChange={e => setProfDOB(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-mono-tabular"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Skin Type, Known Allergies & Personal Goals
                  </label>
                  <input
                    type="text"
                    value={profAllergies}
                    onChange={e => setProfAllergies(e.target.value)}
                    placeholder="e.g. Combination skin, no allergies, brighter smile"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl gold-btn text-sm shadow whitespace-nowrap"
                >
                  Save My Profile Changes
                </button>
              </form>

              {/* 3. OWNER-ONLY ADMIN SETTINGS (Manage Staff Emails/Phones & Official Signature) */}
              {currentUser.role !== 'Customer' && (
                <div className="space-y-3 pt-4 border-t border-[#E6DEC8]">
                  <h4 className="text-xs font-bold tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Official Admin Signature &amp; Sign-Off</span>
                  </h4>
                  <div>
                    <label className="block text-xs font-bold mb-1">Admin Signer Name</label>
                    <input
                      type="text"
                      value={sigDraftName}
                      onChange={e => setSigDraftName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold mb-1">Official Title</label>
                      <input
                        type="text"
                        value={sigDraftTitle}
                        onChange={e => setSigDraftTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Signature Email</label>
                      <input
                        type="email"
                        value={sigDraftEmail}
                        onChange={e => setSigDraftEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-mono-tabular"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveAdminSignatureChanges()}
                    className="w-full py-2 rounded-lg gold-btn text-xs font-bold whitespace-nowrap"
                  >
                    Save Admin Signature
                  </button>
                </div>
              )}

              {currentUser.role === 'Owner' && (
                <div className="space-y-3 pt-4 border-t border-[#E6DEC8]">
                  <h4 className="text-xs font-bold tracking-wider text-[#D4AF37]">
                    Owner Access Control (Staff Emails & Phones)
                  </h4>
                  <p className="text-xs opacity-75">
                    Primary Admin <strong className="font-mono-tabular">{PRIMARY_ADMIN_EMAIL}</strong> and any email or phone listed below are automatically routed to Admin Mode.
                  </p>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Owner Emails / Phones (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={cfgOwners}
                      onChange={e => setCfgOwners(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Secretary Emails / Phones
                    </label>
                    <input
                      type="text"
                      value={cfgSecretaries}
                      onChange={e => setCfgSecretaries(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Security Emails / Phones
                    </label>
                    <input
                      type="text"
                      value={cfgSecurity}
                      onChange={e => setCfgSecurity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs font-mono-tabular"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveOwnerStaffConfig}
                    className="w-full py-2 rounded-lg plum-btn text-xs font-bold whitespace-nowrap"
                  >
                    Update Authorized Staff List
                  </button>
                </div>
              )}

              {/* 3B. STAFF / ADMIN ROLE UNLOCK FOR CUSTOMERS WITH ADMIN PASSWORD */}
              {currentUser.role === 'Customer' && (
                <div className="space-y-2.5 pt-4 border-t border-[#E6DEC8]">
                  {!showDrawerAdminUnlock ? (
                    <button
                      type="button"
                      onClick={() => setShowDrawerAdminUnlock(true)}
                      className="text-xs font-semibold text-[#3B0944] dark:text-[#F3E5AB] underline underline-offset-2 flex items-center gap-1.5 opacity-80 hover:opacity-100"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Staff / Admin Unlock (Requires Password)</span>
                    </button>
                  ) : (
                    <form
                      onSubmit={handleUnlockAdminInDrawer}
                      className="p-3 rounded-xl border border-[#D4AF37] bg-amber-50/40 dark:bg-white/5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Enter Admin Password / Code</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDrawerAdminUnlock(false);
                            setDrawerAdminPassword('');
                          }}
                          className="text-[11px] underline opacity-75"
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="password"
                        value={drawerAdminPassword}
                        onChange={e => setDrawerAdminPassword(e.target.value)}
                        placeholder="Enter Admin password"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg plum-btn text-xs font-bold"
                      >
                        Verify &amp; Unlock Admin Mode
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 4. Install Web App (iPhone & Android) & Sign Out */}
              <div className="pt-4 border-t border-[#E6DEC8] space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDrawerOpen(false);
                      handleInstallWebAppClick('iphone');
                    }}
                    className="py-2.5 px-3 rounded-xl plum-btn font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <span>Install on iPhone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDrawerOpen(false);
                      handleInstallWebAppClick('android');
                    }}
                    className="py-2.5 px-3 rounded-xl gold-btn font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install on Android</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={logoutUser}
                  className="w-full py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out / Switch User</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* =====================================================================
          INSTALL WEB APP (PWA) MODAL FOR IPHONE (iOS) & ANDROID
          ===================================================================== */}
      {installModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install Sidratu Web App on iPhone or Android"
        >
          <div className="max-w-lg w-full theming-card rounded-2xl shadow-2xl overflow-hidden border-2 border-[#D4AF37]">
            <div className="plum-header p-5 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#F3E5AB] flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#D4AF37]" />
                <span>Install Web App (iPhone & Android)</span>
              </h3>
              <button
                type="button"
                onClick={() => setInstallModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Close install modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-sm max-h-[82vh] overflow-y-auto">
              <p className="opacity-85 text-xs sm:text-sm">
                Add <strong>Sidratu Beauty Therapy Skin Care</strong> to your <strong>iPhone</strong> or <strong>Android</strong> Home Screen so it launches full-screen like a native mobile app.
              </p>

              {/* Device Selector Tabs: iPhone (iOS) vs Android */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/5 border border-[#E6DEC8]">
                <button
                  type="button"
                  onClick={() => setInstallDeviceTab('iphone')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    installDeviceTab === 'iphone'
                      ? 'bg-[#3B0944] text-[#F3E5AB] shadow-sm border border-[#D4AF37]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                  <span>iPhone / iPad (iOS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInstallDeviceTab('android')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    installDeviceTab === 'android'
                      ? 'bg-[#3B0944] text-[#F3E5AB] shadow-sm border border-[#D4AF37]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Download className="w-4 h-4 text-[#D4AF37]" />
                  <span>Android Phone / Tablet</span>
                </button>
              </div>

              {installDeviceTab === 'iphone' ? (
                <div className="p-4 rounded-xl border-2 border-[#D4AF37] bg-amber-50/40 text-gray-900 space-y-3">
                  <div className="font-bold text-sm text-[#3B0944] flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <span>How to Install on iPhone or iPad (Safari)</span>
                  </div>
                  <ol className="space-y-2.5 text-xs">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Open this web app in <strong>Safari</strong> on your iPhone or iPad.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Tap the <strong>Share</strong> button (the square icon with an upward arrow <strong>↑</strong>) at the bottom of Safari.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>
                        Scroll down the share sheet and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        4
                      </span>
                      <span>
                        Tap <strong>&ldquo;Add&rdquo;</strong> in the top-right corner. The <strong>Sidratu Clinic</strong> icon will now appear on your iPhone Home Screen!
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="p-4 rounded-xl border-2 border-[#D4AF37] bg-amber-50/40 text-gray-900 space-y-3">
                  <div className="font-bold text-sm text-[#3B0944] flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#D4AF37]" />
                    <span>How to Install on Android (Chrome / Samsung Internet)</span>
                  </div>

                  {deferredInstallPrompt && (
                    <div className="p-3 rounded-xl bg-white border border-[#D4AF37] space-y-2">
                      <div className="font-bold text-xs text-emerald-800">
                        Direct One-Tap Android Install Available
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleInstallWebAppClick('android');
                          setInstallModalOpen(false);
                        }}
                        className="w-full py-2.5 rounded-xl gold-btn text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tap Here to Install App Now</span>
                      </button>
                    </div>
                  )}

                  <ol className="space-y-2.5 text-xs">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Open this web app in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your Android phone.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Tap the browser menu icon (<strong>⋮</strong> in the top-right corner).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#3B0944] text-[#F3E5AB] font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>
                        Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>, then confirm <strong>Install</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-[11px] opacity-75">
                  101 Jomo Kenyatta Road, Freetown · Works on iPhone & Android
                </span>
                <button
                  type="button"
                  onClick={() => setInstallModalOpen(false)}
                  className="px-5 py-2 rounded-xl gold-btn text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          "HOW TO USE THIS APP" MODAL
          ===================================================================== */}
      {helpModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-2xl w-full theming-card rounded-2xl shadow-2xl overflow-hidden border-2 border-[#D4AF37]">
            <div className="plum-header p-5 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#F3E5AB] flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-[#D4AF37]" />
                <span>How to Use Sidratu Beauty Therapy App</span>
              </h3>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Close help modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-sm">
              <div className="p-4 rounded-xl border border-[#D4AF37] space-y-2">
                <h4 className="font-bold text-base text-[#D4AF37]">For Customers (Clients)</h4>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <strong>New Appointment:</strong> Tap the <em>New Appointment</em> tab to choose your facial, dental, or body service, pick your date and time, sign the digital consent box, and confirm.
                  </li>
                  <li>
                    <strong>Past History:</strong> Tap <em>Past History</em> to view all your previous sessions, clinical reports, and direct responses from Admin (<strong>{PRIMARY_ADMIN_EMAIL}</strong>).
                  </li>
                  <li>
                    <strong>Top-Right Profile Button:</strong> Tap your initials in the top-right corner to update your phone number, address, allergies, or turn on <strong>Large Text Mode</strong>.
                  </li>
                </ol>
              </div>

              {currentUser && currentUser.role !== 'Customer' && (
                <div className="p-4 rounded-xl border border-[#D4AF37] space-y-2">
                  <h4 className="font-bold text-base text-[#D4AF37]">
                    For Admin ({PRIMARY_ADMIN_EMAIL}) & Clinic Staff
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>
                      <strong>See All Views:</strong> Use the top navigation bar or the Admin banner to switch seamlessly between the <strong>Admin Dashboard</strong> and the <strong>Customer Portal</strong> views.
                    </li>
                    <li>
                      <strong>Respond to Appointments & History:</strong> Inside the Client Record Sheet, type a reply on any client's <em>New Appointment</em> or <em>Past History</em> entry and click <strong>Post Response</strong> or <strong>Respond via Email</strong> to send from <code>{PRIMARY_ADMIN_EMAIL}</code>.
                    </li>
                    <li>
                      <strong>Secretary & Admin Ledger:</strong> Record manual payment details, specialist notes, and click <strong>Save to Client's Past History</strong> or <strong>Print / Save as PDF</strong>.
                    </li>
                  </ol>
                </div>
              )}

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setHelpModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl gold-btn text-sm whitespace-nowrap"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DELETE CLIENT CONFIRMATION MODAL (Iframe-Safe Replacement for window.confirm)
          ===================================================================== */}
      {clientPendingDelete && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full theming-card rounded-2xl shadow-2xl overflow-hidden border-2 border-red-600">
            <div className="bg-red-700 p-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                <span>Confirm Delete Client Sheet</span>
              </h3>
              <button
                onClick={() => setClientPendingDelete(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Cancel delete"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p>
                Are you sure you want to permanently delete the client record sheet for{' '}
                <strong>{clientPendingDelete.name}</strong> ({clientPendingDelete.phone || 'Walk-In'})?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClientPendingDelete(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteClient}
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Delete Client Sheet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          EMERGENCY HEALTH ALERTS MODAL (Admin View Only)
          ===================================================================== */}
      {emergencyModalClient && currentUser && currentUser.role !== 'Customer' && mainView === 'admin' && (
        <div
          className="fixed inset-0 bg-red-950/70 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-red-50 rounded-2xl shadow-2xl overflow-hidden border-4 border-red-600">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="font-bold text-lg">CRITICAL HEALTH & ALLERGY ALERT</h3>
            </div>
            <div className="p-6 space-y-4 text-gray-900">
              <p className="font-bold text-base">Client: {emergencyModalClient.name}</p>
              <div className="bg-white p-4 rounded-xl border border-red-200">
                <span className="block text-xs font-bold text-red-700 uppercase mb-1">
                  Health Conditions & Allergies:
                </span>
                <p className="text-sm font-semibold">{emergencyModalClient.allergies}</p>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyModalClient(null)}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow whitespace-nowrap"
              >
                Acknowledge Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
