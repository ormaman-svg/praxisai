export type Lang = "he" | "en" | "ar" | "ro";

export const LANG_META: Record<Lang, { label: string; dir: "rtl" | "ltr"; flag: string }> = {
  he: { label: "עברית",    dir: "rtl", flag: "🇮🇱" },
  en: { label: "English",  dir: "ltr", flag: "🇬🇧" },
  ar: { label: "العربية", dir: "rtl", flag: "🇦🇪" },
  ro: { label: "Română",   dir: "ltr", flag: "🇷🇴" },
};

export const LANG_COOKIE = "praxis_lang";

/* ─────────────────────────────────────────────────────────── */
/* Translation shape                                            */
/* ─────────────────────────────────────────────────────────── */

interface T {
  nav: {
    dashboard: string; schedule: string; inbox: string; patients: string;
    scribe: string; chat: string; analytics: string; documents: string;
  };
  adminSection: { title: string; users: string; whatsapp: string; billing: string; };
  superAdminSection: { clinics: string; template: string; };
  common: {
    save: string; saving: string; cancel: string; close: string; delete: string;
    edit: string; add: string; search: string; loading: string; new: string;
    yes: string; no: string; back: string; signOut: string; language: string;
    error: string; success: string; optional: string;
  };
  roles: { owner: string; admin: string; therapist: string; receptionist: string; };
  patientStatus: { active: string; discharged: string; on_hold: string; };
  apptStatus: { scheduled: string; completed: string; cancelled: string; no_show: string; };
  dashboard: {
    title: string; subtitle: string; activePatients: string; treatmentsThisWeek: string;
    draftDocuments: string; teamMembers: string; recentTreatments: string;
    viewAll: string; noTreatments: string;
  };
  patients: {
    title: string; subtitle: string; importCrm: string; newPatient: string;
    searchPlaceholder: string; columns: string; firstName: string; lastName: string;
    nationalId: string; dob: string; kupah: string; diagnosis: string; phone: string;
    email: string; status: string; therapist: string; noPatientsYet: string;
    noResults: string; bituachLeumi: string; primaryTherapist: string;
    savePatient: string; newPatientTitle: string; saveFailed: string; nationalIdRequired: string;
  };
  schedule: {
    title: string; subtitle: string; newAppointment: string; today: string; allStaff: string;
    therapistFilter: string; duration: string; notes: string; appointmentDate: string;
    occurred: string; noShow: string; cancelAppt: string; restoreScheduled: string;
    deleteAppt: string; setAppointment: string; selectPatient: string; saveFailed: string;
  };
  scribe: {
    title: string; subtitle: string; patient: string; microphone: string; defaultMic: string;
    recording: string; paused: string; transcribing: string; generating: string;
    reviewReady: string; startRecording: string; stopRecording: string; pause: string;
    resume: string; generateNote: string; saveRecord: string; newTreatment: string;
    transcription: string; aiRecommendations: string; aiNote: string;
    commandMode: string; manualMode: string; vasLabel: string; savedSuccess: string;
    noPatientError: string; saveFailed: string; transcribeFailed: string; noteFailed: string;
    waitingCommand: string; micOpen: string;
  };
  chat: {
    title: string; subtitle: string; placeholder: string; hint: string; errorMsg: string;
    clinicalAssistant: string; askAnything: string;
  };
  analytics: {
    title: string; subtitle: string; filterByPatient: string; allClinic: string;
    treatmentsLast30: string; activePatients: string; documentsLast6m: string;
    vasAvg: string; newPatientsMonth: string; avgPerPatient: string; peakDay: string;
    topTherapist: string; treatmentsByWeek: string; treatmentTypes: string;
    byKupah: string; romProgress: string; noRom: string; noData: string;
    managerDash: string; therapistComparison: string; improvement: string; worsening: string;
  };
  documents: {
    title: string; subtitle: string; newDoc: string; searchPlaceholder: string;
    draft: string; final: string; noDocuments: string; aiGenerated: string; sign: string; signed: string;
  };
  inbox: {
    title: string; subtitle: string; noConversations: string; bot: string; human: string;
    takeOver: string; returnToBot: string; send: string; typePlaceholder: string;
    inbound: string; outbound: string;
  };
  settings: {
    languageTitle: string; languageSubtitle: string;
  };
  login: {
    title: string; subtitle: string; signInGoogle: string; signingInGoogle: string;
    email: string; password: string; signIn: string; signingIn: string;
    inviteNote: string; tagline: string; taglineSub: string;
    expiredSession: string; notInvitedError: string; authError: string; wrongCredentials: string;
    orEmail: string;
  };
}

/* ─────────────────────────────────────────────────────────── */
/* Hebrew                                                       */
/* ─────────────────────────────────────────────────────────── */

const he: T = {
  nav: {
    dashboard: "לוח בקרה", schedule: "יומן תורים", inbox: "תיבת הודעות",
    patients: "מטופלים", scribe: "תיעוד AI", chat: "צ'אט AI",
    analytics: "אנליטיקות", documents: "מסמכים",
  },
  adminSection: { title: "ניהול", users: "משתמשים והרשאות", whatsapp: "חיבור WhatsApp", billing: "חיוב ומנוי" },
  superAdminSection: { clinics: "קליניקות", template: "סוג הקליניקה" },
  common: {
    save: "שמירה", saving: "שומר...", cancel: "ביטול", close: "סגירה", delete: "מחיקה",
    edit: "עריכה", add: "הוספה", search: "חיפוש", loading: "טוען...", new: "חדש",
    yes: "כן", no: "לא", back: "חזרה", signOut: "התנתקות", language: "שפה",
    error: "שגיאה", success: "הצלחה", optional: "לא חובה",
  },
  roles: { owner: "בעלים", admin: "מנהל", therapist: "מטפל/ת", receptionist: "קבלה" },
  patientStatus: { active: "פעיל", discharged: "שוחרר", on_hold: "בהמתנה" },
  apptStatus: { scheduled: "מתוכנן", completed: "התקיים", cancelled: "בוטל", no_show: "לא הגיע" },
  dashboard: {
    title: "לוח בקרה",
    subtitle: "תמונת מצב של הקליניקה — נתונים חיים מהמערכת.",
    activePatients: "מטופלים פעילים",
    treatmentsThisWeek: "טיפולים בשבוע האחרון",
    draftDocuments: "מסמכים בטיוטה",
    teamMembers: "חברי צוות",
    recentTreatments: "טיפולים אחרונים",
    viewAll: "לכל המטופלים ←",
    noTreatments: "אין עדיין טיפולים מתועדים. הוסיפו מטופל ראשון כדי להתחיל.",
  },
  patients: {
    title: "מטופלים", subtitle: "מטופלים בקליניקה",
    importCrm: "ייבוא מ‑CRM", newPatient: "מטופל חדש",
    searchPlaceholder: "חיפוש לפי שם, ת״ז או טלפון…", columns: "עמודות",
    firstName: "שם פרטי", lastName: "שם משפחה", nationalId: "ת״ז", dob: "תאריך לידה",
    kupah: "קופה", diagnosis: "אבחנה", phone: "טלפון", email: "מייל",
    status: "סטטוס", therapist: "מטפל/ת",
    noPatientsYet: "אין עדיין מטופלים — הוסיפו את הראשון.",
    noResults: "לא נמצאו תוצאות לחיפוש.",
    bituachLeumi: "ביטוח לאומי", primaryTherapist: "מטפל/ת אחראי/ת",
    savePatient: "שמירת מטופל", newPatientTitle: "מטופל חדש",
    saveFailed: "שמירת המטופל נכשלה. בדקו את הפרטים ונסו שוב.",
    nationalIdRequired: "יש להזין תעודת זהות — היא משמשת לאימות זהות המטופל בווטסאפ.",
  },
  schedule: {
    title: "יומן תורים",
    subtitle: "תזמון, מעקב והשלמת תורים — לחצו על משבצת ריקה לקביעת תור.",
    newAppointment: "תור חדש", today: "היום", allStaff: "כל הצוות",
    therapistFilter: "מטפל/ת", duration: "משך (דקות)", notes: "הערות",
    appointmentDate: "מועד", occurred: "התקיים", noShow: "לא הגיע",
    cancelAppt: "ביטול תור", restoreScheduled: "החזרה למתוכנן", deleteAppt: "מחיקה",
    setAppointment: "קביעת תור", selectPatient: "בחרו מטופל.",
    saveFailed: "שמירת התור נכשלה — נסו שוב.",
  },
  scribe: {
    title: "תיעוד AI — Scribe",
    subtitle: "הקליטו את הטיפול — praxisAI תמלל ותכתוב רשומה.",
    patient: "מטופל", microphone: "מיקרופון", defaultMic: "מיקרופון ברירת מחדל",
    recording: "מקליט", paused: "מושהה", transcribing: "מתמלל בעברית…",
    generating: "ה‑AI כותב רשומה…", reviewReady: "הרשומה מוכנה לעיון",
    startRecording: "מוכנים להקליט?", stopRecording: "סיים — וצור רשומה",
    pause: "השהה", resume: "המשך הקלטה", generateNote: "צור רשומה",
    saveRecord: "שמור רשומה", newTreatment: "טיפול חדש", transcription: "תמלול",
    aiRecommendations: "המלצות AI", aiNote: "תוספת של ה‑AI — אינה חלק מהתיעוד הקליני שמבוסס על ההקלטה בלבד",
    commandMode: "מצב פקודה קולית", manualMode: "מצב ידני",
    vasLabel: "VAS — דרגת כאב (0–10)", savedSuccess: "הרשומה נשמרה בהצלחה",
    noPatientError: "יש לבחור מטופל לפני השמירה.", saveFailed: "שמירה נכשלה — נסו שוב.",
    transcribeFailed: "התמלול נכשל — נסו שוב.", noteFailed: "יצירת הרשומה נכשלה.",
    waitingCommand: "ממתין לפקודה…", micOpen: "המיקרופון פתוח — ממתין לפקודת ההתחלה",
  },
  chat: {
    title: "צ'אט AI קליני", subtitle: "שאלו שאלות קליניות — פרוטוקולים, אבחנות, תרגילים, תיעוד.",
    placeholder: "שאלו שאלה קלינית…", hint: "Enter לשליחה · Shift+Enter לשורה חדשה",
    errorMsg: "אירעה שגיאה — נסו שוב.", clinicalAssistant: "עוזר AI קליני ל",
    askAnything: "שאלו כל שאלה קלינית — אני כאן לעזור.",
  },
  analytics: {
    title: "אנליטיקות", subtitle: "מדדים ומגמות — 6 החודשים האחרונים",
    filterByPatient: "סינון לפי מטופל", allClinic: "כל הקליניקה",
    treatmentsLast30: "טיפולים ב‑30 הימים האחרונים", activePatients: "מטופלים פעילים",
    documentsLast6m: "מסמכים שהופקו (6 ח׳)", vasAvg: "ממוצע",
    newPatientsMonth: "מטופלים חדשים החודש", avgPerPatient: "ממוצע טיפולים למטופל",
    peakDay: "יום השיא בקליניקה", topTherapist: "מוביל/ת בטיפולים (6 ח׳)",
    treatmentsByWeek: "טיפולים לפי שבוע", treatmentTypes: "התפלגות סוגי טיפול",
    byKupah: "מטופלים לפי קופת חולים", romProgress: "טווח תנועה (ROM)",
    noRom: "אין מדידות ROM למטופל זה.",
    noData: "אין נתוני טיפולים בתקופה — הגרפים יתמלאו עם התיעוד.",
    managerDash: "לוח בקרה מנהלי", therapistComparison: "השוואת מטפלים — 6 החודשים האחרונים",
    improvement: "שיפור", worsening: "החמרה",
  },
  documents: {
    title: "מסמכים", subtitle: "מסמכים קליניים שנוצרו על ידי AI",
    newDoc: "מסמך חדש", searchPlaceholder: "חיפוש מסמך…",
    draft: "טיוטה", final: "סופי", noDocuments: "אין מסמכים עדיין.",
    aiGenerated: "AI", sign: "חתימה", signed: "חתום",
  },
  inbox: {
    title: "תיבת הודעות", subtitle: "שיחות WhatsApp עם המטופלים",
    noConversations: "אין שיחות עדיין.", bot: "בוט", human: "אדם",
    takeOver: "קח על עצמי", returnToBot: "החזר לבוט",
    send: "שלח", typePlaceholder: "הקלידו הודעה…", inbound: "נכנס", outbound: "יוצא",
  },
  settings: {
    languageTitle: "שפת הממשק", languageSubtitle: "בחרו את שפת תצוגת המערכת",
  },
  login: {
    title: "כניסה למערכת", subtitle: "ברוכים השבים — התחברו כדי להמשיך.",
    signInGoogle: "כניסה עם Google", signingInGoogle: "מחבר...",
    email: "דוא״ל", password: "סיסמה", signIn: "כניסה", signingIn: "מתחבר...",
    inviteNote: "קיבלת מייל הזמנה? לחץ על הקישור שבמייל כדי להגדיר סיסמה ולהיכנס לראשונה.",
    tagline: "פחות ניירת.\nיותר זמן לטפל.",
    taglineSub: "הקליטו את הטיפול — praxisAI תכתוב את הרשומה, תכין את הדוחות ותשאיר אתכם פנויים למה שבאמת חשוב.",
    expiredSession: "פג תוקף החיבור — מטעמי אבטחה יש להתחבר מחדש.",
    notInvitedError: "הכתובת הזו לא הוזמנה למערכת. הכניסה היא בהזמנה בלבד — פנה למנהל הקליניקה.",
    authError: "ההתחברות נכשלה. נסה שוב.",
    wrongCredentials: "פרטי ההתחברות שגויים. פנה למנהל הקליניקה אם אינך זוכר את הסיסמה.",
    orEmail: "או עם דוא״ל",
  },
};

/* ─────────────────────────────────────────────────────────── */
/* English                                                      */
/* ─────────────────────────────────────────────────────────── */

const en: T = {
  nav: {
    dashboard: "Dashboard", schedule: "Schedule", inbox: "Inbox",
    patients: "Patients", scribe: "AI Documentation", chat: "AI Chat",
    analytics: "Analytics", documents: "Documents",
  },
  adminSection: { title: "Management", users: "Users & Permissions", whatsapp: "WhatsApp Connection", billing: "Billing & Subscription" },
  superAdminSection: { clinics: "Clinics", template: "Clinic Type" },
  common: {
    save: "Save", saving: "Saving...", cancel: "Cancel", close: "Close", delete: "Delete",
    edit: "Edit", add: "Add", search: "Search", loading: "Loading...", new: "New",
    yes: "Yes", no: "No", back: "Back", signOut: "Sign out", language: "Language",
    error: "Error", success: "Success", optional: "Optional",
  },
  roles: { owner: "Owner", admin: "Admin", therapist: "Therapist", receptionist: "Reception" },
  patientStatus: { active: "Active", discharged: "Discharged", on_hold: "On Hold" },
  apptStatus: { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No Show" },
  dashboard: {
    title: "Dashboard", subtitle: "Clinic overview — live data from the system.",
    activePatients: "Active Patients", treatmentsThisWeek: "Treatments This Week",
    draftDocuments: "Draft Documents", teamMembers: "Team Members",
    recentTreatments: "Recent Treatments", viewAll: "All Patients →",
    noTreatments: "No treatments yet. Add your first patient to get started.",
  },
  patients: {
    title: "Patients", subtitle: "patients in clinic",
    importCrm: "Import from CRM", newPatient: "New Patient",
    searchPlaceholder: "Search by name, ID or phone…", columns: "Columns",
    firstName: "First Name", lastName: "Last Name", nationalId: "National ID", dob: "Date of Birth",
    kupah: "Health Fund", diagnosis: "Diagnosis", phone: "Phone", email: "Email",
    status: "Status", therapist: "Therapist",
    noPatientsYet: "No patients yet — add the first one.",
    noResults: "No results found.",
    bituachLeumi: "National Insurance", primaryTherapist: "Primary Therapist",
    savePatient: "Save Patient", newPatientTitle: "New Patient",
    saveFailed: "Failed to save patient. Check the details and try again.",
    nationalIdRequired: "National ID is required — it's used to verify patient identity on WhatsApp.",
  },
  schedule: {
    title: "Schedule",
    subtitle: "Book, track and complete appointments — click an empty slot to schedule.",
    newAppointment: "New Appointment", today: "Today", allStaff: "All Staff",
    therapistFilter: "Therapist", duration: "Duration (min)", notes: "Notes",
    appointmentDate: "Date & Time", occurred: "Completed", noShow: "No Show",
    cancelAppt: "Cancel Appointment", restoreScheduled: "Restore to Scheduled", deleteAppt: "Delete",
    setAppointment: "Schedule", selectPatient: "Please select a patient.",
    saveFailed: "Failed to save appointment — try again.",
  },
  scribe: {
    title: "AI Scribe",
    subtitle: "Record the session — praxisAI will transcribe and write the note.",
    patient: "Patient", microphone: "Microphone", defaultMic: "Default microphone",
    recording: "Recording", paused: "Paused", transcribing: "Transcribing…",
    generating: "AI is writing the note…", reviewReady: "Note ready for review",
    startRecording: "Ready to record?", stopRecording: "Stop — Generate Note",
    pause: "Pause", resume: "Resume Recording", generateNote: "Generate Note",
    saveRecord: "Save Record", newTreatment: "New Treatment", transcription: "Transcription",
    aiRecommendations: "AI Recommendations",
    aiNote: "Added by AI — not part of the clinical record based on the recording",
    commandMode: "Voice Command Mode", manualMode: "Manual Mode",
    vasLabel: "VAS — Pain Scale (0–10)", savedSuccess: "Record saved successfully",
    noPatientError: "Please select a patient before saving.", saveFailed: "Save failed — try again.",
    transcribeFailed: "Transcription failed — try again.", noteFailed: "Note generation failed.",
    waitingCommand: "Waiting for command…", micOpen: "Microphone open — waiting for start command",
  },
  chat: {
    title: "Clinical AI Chat",
    subtitle: "Ask clinical questions — protocols, diagnoses, exercises, documentation.",
    placeholder: "Ask a clinical question…", hint: "Enter to send · Shift+Enter for new line",
    errorMsg: "An error occurred — please try again.", clinicalAssistant: "Clinical AI assistant for",
    askAnything: "Ask any clinical question — I'm here to help.",
  },
  analytics: {
    title: "Analytics", subtitle: "Metrics and trends — last 6 months",
    filterByPatient: "Filter by patient", allClinic: "Entire clinic",
    treatmentsLast30: "Treatments in last 30 days", activePatients: "Active patients",
    documentsLast6m: "Documents generated (6m)", vasAvg: "Average",
    newPatientsMonth: "New patients this month", avgPerPatient: "Avg treatments per patient",
    peakDay: "Peak day in clinic", topTherapist: "Top therapist (6m)",
    treatmentsByWeek: "Treatments by week", treatmentTypes: "Treatment type distribution",
    byKupah: "Patients by health fund", romProgress: "Range of Motion (ROM)",
    noRom: "No ROM measurements for this patient.",
    noData: "No treatment data — charts will fill as you document.",
    managerDash: "Manager Dashboard", therapistComparison: "Therapist comparison — 6 months",
    improvement: "improvement", worsening: "worsening",
  },
  documents: {
    title: "Documents", subtitle: "AI-generated clinical documents",
    newDoc: "New Document", searchPlaceholder: "Search document…",
    draft: "Draft", final: "Final", noDocuments: "No documents yet.",
    aiGenerated: "AI", sign: "Sign", signed: "Signed",
  },
  inbox: {
    title: "Inbox", subtitle: "WhatsApp conversations with patients",
    noConversations: "No conversations yet.", bot: "Bot", human: "Human",
    takeOver: "Take over", returnToBot: "Return to bot",
    send: "Send", typePlaceholder: "Type a message…", inbound: "Inbound", outbound: "Outbound",
  },
  settings: {
    languageTitle: "Interface Language", languageSubtitle: "Choose the display language for the system",
  },
  login: {
    title: "Sign In", subtitle: "Welcome back — sign in to continue.",
    signInGoogle: "Sign in with Google", signingInGoogle: "Connecting...",
    email: "Email", password: "Password", signIn: "Sign In", signingIn: "Signing in...",
    inviteNote: "Received an invitation email? Click the link to set your password and sign in for the first time.",
    tagline: "Less paperwork.\nMore time to treat.",
    taglineSub: "Record the session — praxisAI writes the note, prepares the reports, and keeps you free for what truly matters.",
    expiredSession: "Session expired — please sign in again for security.",
    notInvitedError: "This address has not been invited to the system. Access is by invitation only — contact your clinic manager.",
    authError: "Sign in failed. Please try again.",
    wrongCredentials: "Incorrect credentials. Contact your clinic manager if you've forgotten your password.",
    orEmail: "or with Email",
  },
};

/* ─────────────────────────────────────────────────────────── */
/* Arabic                                                       */
/* ─────────────────────────────────────────────────────────── */

const ar: T = {
  nav: {
    dashboard: "لوحة التحكم", schedule: "جدول المواعيد", inbox: "صندوق الرسائل",
    patients: "المرضى", scribe: "توثيق AI", chat: "محادثة AI",
    analytics: "التحليلات", documents: "المستندات",
  },
  adminSection: { title: "الإدارة", users: "المستخدمون والصلاحيات", whatsapp: "ربط WhatsApp", billing: "الفواتير والاشتراك" },
  superAdminSection: { clinics: "العيادات", template: "نوع العيادة" },
  common: {
    save: "حفظ", saving: "جارٍ الحفظ...", cancel: "إلغاء", close: "إغلاق", delete: "حذف",
    edit: "تعديل", add: "إضافة", search: "بحث", loading: "جارٍ التحميل...", new: "جديد",
    yes: "نعم", no: "لا", back: "رجوع", signOut: "تسجيل الخروج", language: "اللغة",
    error: "خطأ", success: "نجاح", optional: "اختياري",
  },
  roles: { owner: "مالك", admin: "مدير", therapist: "معالج/ة", receptionist: "استقبال" },
  patientStatus: { active: "نشط", discharged: "خُرِّج", on_hold: "في الانتظار" },
  apptStatus: { scheduled: "مجدول", completed: "اكتمل", cancelled: "ملغى", no_show: "لم يحضر" },
  dashboard: {
    title: "لوحة التحكم", subtitle: "نظرة عامة على العيادة — بيانات حية.",
    activePatients: "المرضى النشطون", treatmentsThisWeek: "الجلسات هذا الأسبوع",
    draftDocuments: "مسودات المستندات", teamMembers: "أعضاء الفريق",
    recentTreatments: "الجلسات الأخيرة", viewAll: "كل المرضى ←",
    noTreatments: "لا توجد جلسات بعد. أضف أول مريض للبدء.",
  },
  patients: {
    title: "المرضى", subtitle: "مرضى في العيادة",
    importCrm: "استيراد من CRM", newPatient: "مريض جديد",
    searchPlaceholder: "ابحث بالاسم أو الهوية أو الهاتف…", columns: "الأعمدة",
    firstName: "الاسم الأول", lastName: "اسم العائلة", nationalId: "رقم الهوية", dob: "تاريخ الميلاد",
    kupah: "صندوق الصحة", diagnosis: "التشخيص", phone: "الهاتف", email: "البريد الإلكتروني",
    status: "الحالة", therapist: "المعالج/ة",
    noPatientsYet: "لا يوجد مرضى بعد — أضف الأول.",
    noResults: "لا توجد نتائج.",
    bituachLeumi: "تأمين وطني", primaryTherapist: "المعالج/ة المسؤول/ة",
    savePatient: "حفظ المريض", newPatientTitle: "مريض جديد",
    saveFailed: "فشل حفظ المريض. تحقق من البيانات وحاول مجدداً.",
    nationalIdRequired: "رقم الهوية مطلوب — يُستخدم للتحقق من هوية المريض عبر واتساب.",
  },
  schedule: {
    title: "جدول المواعيد",
    subtitle: "احجز وتابع واكمل المواعيد — انقر على خانة فارغة للحجز.",
    newAppointment: "موعد جديد", today: "اليوم", allStaff: "كل الفريق",
    therapistFilter: "المعالج/ة", duration: "المدة (دقيقة)", notes: "ملاحظات",
    appointmentDate: "التاريخ والوقت", occurred: "اكتمل", noShow: "لم يحضر",
    cancelAppt: "إلغاء الموعد", restoreScheduled: "إعادة إلى مجدول", deleteAppt: "حذف",
    setAppointment: "حجز", selectPatient: "يرجى اختيار مريض.",
    saveFailed: "فشل حفظ الموعد — حاول مجدداً.",
  },
  scribe: {
    title: "توثيق AI", subtitle: "سجّل الجلسة — praxisAI سيفرغ ويكتب الملاحظة.",
    patient: "المريض", microphone: "الميكروفون", defaultMic: "الميكروفون الافتراضي",
    recording: "جارٍ التسجيل", paused: "متوقف مؤقتاً", transcribing: "جارٍ التفريغ…",
    generating: "AI يكتب الملاحظة…", reviewReady: "الملاحظة جاهزة للمراجعة",
    startRecording: "مستعد للتسجيل؟", stopRecording: "إيقاف — إنشاء ملاحظة",
    pause: "إيقاف مؤقت", resume: "استمرار التسجيل", generateNote: "إنشاء ملاحظة",
    saveRecord: "حفظ السجل", newTreatment: "جلسة جديدة", transcription: "النص المفرغ",
    aiRecommendations: "توصيات AI", aiNote: "مضاف بواسطة AI — ليس جزءاً من السجل الطبي",
    commandMode: "وضع الأوامر الصوتية", manualMode: "الوضع اليدوي",
    vasLabel: "VAS — مقياس الألم (0–10)", savedSuccess: "تم حفظ السجل بنجاح",
    noPatientError: "يرجى اختيار مريض قبل الحفظ.", saveFailed: "فشل الحفظ — حاول مجدداً.",
    transcribeFailed: "فشل التفريغ — حاول مجدداً.", noteFailed: "فشل إنشاء الملاحظة.",
    waitingCommand: "في انتظار الأمر…", micOpen: "الميكروفون مفتوح — في انتظار أمر البدء",
  },
  chat: {
    title: "محادثة AI السريرية",
    subtitle: "اطرح أسئلة سريرية — بروتوكولات، تشخيصات، تمارين، توثيق.",
    placeholder: "اطرح سؤالاً سريرياً…", hint: "Enter للإرسال · Shift+Enter لسطر جديد",
    errorMsg: "حدث خطأ — حاول مرة أخرى.", clinicalAssistant: "مساعد AI السريري لـ",
    askAnything: "اطرح أي سؤال سريري — أنا هنا للمساعدة.",
  },
  analytics: {
    title: "التحليلات", subtitle: "المقاييس والاتجاهات — الأشهر الـ6 الماضية",
    filterByPatient: "تصفية حسب المريض", allClinic: "كل العيادة",
    treatmentsLast30: "الجلسات خلال 30 يومًا", activePatients: "المرضى النشطون",
    documentsLast6m: "المستندات المنشأة (6 أشهر)", vasAvg: "متوسط",
    newPatientsMonth: "مرضى جدد هذا الشهر", avgPerPatient: "متوسط الجلسات للمريض",
    peakDay: "أكثر يوم ازدحامًا", topTherapist: "الأكثر جلسات (6 أشهر)",
    treatmentsByWeek: "الجلسات حسب الأسبوع", treatmentTypes: "توزيع أنواع الجلسات",
    byKupah: "المرضى حسب صندوق الصحة", romProgress: "نطاق الحركة (ROM)",
    noRom: "لا توجد قياسات ROM لهذا المريض.",
    noData: "لا توجد بيانات — ستُملأ الرسوم البيانية عند التوثيق.",
    managerDash: "لوحة المدير", therapistComparison: "مقارنة المعالجين — 6 أشهر",
    improvement: "تحسن", worsening: "تدهور",
  },
  documents: {
    title: "المستندات", subtitle: "مستندات سريرية أنشأها AI",
    newDoc: "مستند جديد", searchPlaceholder: "بحث عن مستند…",
    draft: "مسودة", final: "نهائي", noDocuments: "لا توجد مستندات بعد.",
    aiGenerated: "AI", sign: "توقيع", signed: "موقّع",
  },
  inbox: {
    title: "صندوق الرسائل", subtitle: "محادثات WhatsApp مع المرضى",
    noConversations: "لا توجد محادثات بعد.", bot: "بوت", human: "بشري",
    takeOver: "تولي المحادثة", returnToBot: "إعادة للبوت",
    send: "إرسال", typePlaceholder: "اكتب رسالة…", inbound: "واردة", outbound: "صادرة",
  },
  settings: {
    languageTitle: "لغة الواجهة", languageSubtitle: "اختر لغة عرض النظام",
  },
  login: {
    title: "تسجيل الدخول", subtitle: "مرحباً بعودتك — سجّل الدخول للمتابعة.",
    signInGoogle: "الدخول بـ Google", signingInGoogle: "جارٍ الاتصال...",
    email: "البريد الإلكتروني", password: "كلمة المرور", signIn: "دخول", signingIn: "جارٍ الدخول...",
    inviteNote: "تلقيت بريد دعوة؟ انقر على الرابط في البريد لتعيين كلمة المرور والدخول لأول مرة.",
    tagline: "أقل أوراق.\nمزيد من الوقت للعلاج.",
    taglineSub: "سجّل الجلسة — praxisAI يكتب الملاحظة ويُعد التقارير ويتيح لك التركيز على ما يهم.",
    expiredSession: "انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً.",
    notInvitedError: "هذا العنوان غير مدعو للنظام. الدخول بالدعوة فقط — تواصل مع مدير العيادة.",
    authError: "فشل تسجيل الدخول. حاول مرة أخرى.",
    wrongCredentials: "بيانات الدخول غير صحيحة. تواصل مع مدير العيادة إن نسيت كلمة المرور.",
    orEmail: "أو بالبريد الإلكتروني",
  },
};

/* ─────────────────────────────────────────────────────────── */
/* Romanian                                                     */
/* ─────────────────────────────────────────────────────────── */

const ro: T = {
  nav: {
    dashboard: "Tablou de bord", schedule: "Programări", inbox: "Mesaje",
    patients: "Pacienți", scribe: "Documentare AI", chat: "Chat AI",
    analytics: "Analiză", documents: "Documente",
  },
  adminSection: { title: "Administrare", users: "Utilizatori și permisiuni", whatsapp: "Conectare WhatsApp", billing: "Facturare și abonament" },
  superAdminSection: { clinics: "Clinici", template: "Tip clinică" },
  common: {
    save: "Salvare", saving: "Se salvează...", cancel: "Anulare", close: "Închide", delete: "Șterge",
    edit: "Editare", add: "Adaugă", search: "Căutare", loading: "Se încarcă...", new: "Nou",
    yes: "Da", no: "Nu", back: "Înapoi", signOut: "Deconectare", language: "Limbă",
    error: "Eroare", success: "Succes", optional: "Opțional",
  },
  roles: { owner: "Proprietar", admin: "Administrator", therapist: "Terapeut", receptionist: "Recepție" },
  patientStatus: { active: "Activ", discharged: "Externat", on_hold: "În așteptare" },
  apptStatus: { scheduled: "Programat", completed: "Finalizat", cancelled: "Anulat", no_show: "Absent" },
  dashboard: {
    title: "Tablou de bord", subtitle: "Prezentare generală a clinicii — date în timp real.",
    activePatients: "Pacienți activi", treatmentsThisWeek: "Ședințe săptămâna aceasta",
    draftDocuments: "Documente ciornă", teamMembers: "Membrii echipei",
    recentTreatments: "Ședințe recente", viewAll: "Toți pacienții →",
    noTreatments: "Nicio ședință înregistrată. Adăugați primul pacient pentru a începe.",
  },
  patients: {
    title: "Pacienți", subtitle: "pacienți în clinică",
    importCrm: "Import din CRM", newPatient: "Pacient nou",
    searchPlaceholder: "Căutare după nume, CNP sau telefon…", columns: "Coloane",
    firstName: "Prenume", lastName: "Nume de familie", nationalId: "CNP", dob: "Data nașterii",
    kupah: "Fond de sănătate", diagnosis: "Diagnostic", phone: "Telefon", email: "Email",
    status: "Status", therapist: "Terapeut",
    noPatientsYet: "Niciun pacient — adăugați primul.",
    noResults: "Niciun rezultat găsit.",
    bituachLeumi: "Asigurare națională", primaryTherapist: "Terapeut principal",
    savePatient: "Salvare pacient", newPatientTitle: "Pacient nou",
    saveFailed: "Salvarea pacientului a eșuat. Verificați datele și încercați din nou.",
    nationalIdRequired: "CNP-ul este necesar — este utilizat pentru verificarea identității pacientului pe WhatsApp.",
  },
  schedule: {
    title: "Programări",
    subtitle: "Programați, urmăriți și finalizați ședințele — clic pe un slot liber pentru programare.",
    newAppointment: "Programare nouă", today: "Astăzi", allStaff: "Tot personalul",
    therapistFilter: "Terapeut", duration: "Durată (min)", notes: "Note",
    appointmentDate: "Dată și oră", occurred: "Finalizat", noShow: "Absent",
    cancelAppt: "Anulare programare", restoreScheduled: "Revenire la programat", deleteAppt: "Șterge",
    setAppointment: "Programare", selectPatient: "Selectați un pacient.",
    saveFailed: "Salvarea programării a eșuat — încercați din nou.",
  },
  scribe: {
    title: "AI Scribe", subtitle: "Înregistrați ședința — praxisAI va transcrie și scrie nota clinică.",
    patient: "Pacient", microphone: "Microfon", defaultMic: "Microfon implicit",
    recording: "Înregistrare", paused: "Pauză", transcribing: "Se transcrie…",
    generating: "AI scrie nota…", reviewReady: "Nota este gata pentru revizuire",
    startRecording: "Gata de înregistrare?", stopRecording: "Stop — Generare notă",
    pause: "Pauză", resume: "Reluare înregistrare", generateNote: "Generare notă",
    saveRecord: "Salvare înregistrare", newTreatment: "Ședință nouă", transcription: "Transcriere",
    aiRecommendations: "Recomandări AI", aiNote: "Adăugat de AI — nu face parte din dosarul clinic",
    commandMode: "Mod comandă vocală", manualMode: "Mod manual",
    vasLabel: "VAS — Scală durere (0–10)", savedSuccess: "Înregistrarea a fost salvată cu succes",
    noPatientError: "Selectați un pacient înainte de salvare.", saveFailed: "Salvarea a eșuat — încercați din nou.",
    transcribeFailed: "Transcrierea a eșuat — încercați din nou.", noteFailed: "Generarea notei a eșuat.",
    waitingCommand: "Aștept comanda…", micOpen: "Microfon activ — aștept comanda de start",
  },
  chat: {
    title: "Chat AI Clinic",
    subtitle: "Puneți întrebări clinice — protocoale, diagnostice, exerciții, documentare.",
    placeholder: "Puneți o întrebare clinică…", hint: "Enter pentru trimitere · Shift+Enter pentru linie nouă",
    errorMsg: "A apărut o eroare — încercați din nou.", clinicalAssistant: "Asistent AI clinic pentru",
    askAnything: "Puneți orice întrebare clinică — sunt aici să ajut.",
  },
  analytics: {
    title: "Analiză", subtitle: "Indicatori și tendințe — ultimele 6 luni",
    filterByPatient: "Filtrare după pacient", allClinic: "Toată clinica",
    treatmentsLast30: "Ședințe în ultimele 30 zile", activePatients: "Pacienți activi",
    documentsLast6m: "Documente generate (6L)", vasAvg: "Medie",
    newPatientsMonth: "Pacienți noi luna aceasta", avgPerPatient: "Medie ședințe per pacient",
    peakDay: "Ziua de vârf", topTherapist: "Terapeut de top (6L)",
    treatmentsByWeek: "Ședințe pe săptămână", treatmentTypes: "Distribuție tipuri de ședință",
    byKupah: "Pacienți după fond de sănătate", romProgress: "Amplitudine de mișcare (ROM)",
    noRom: "Nu există măsurători ROM pentru acest pacient.",
    noData: "Nu există date — graficele se vor completa pe măsură ce documentați.",
    managerDash: "Tablou de bord manager", therapistComparison: "Comparație terapeuți — 6 luni",
    improvement: "îmbunătățire", worsening: "înrăutățire",
  },
  documents: {
    title: "Documente", subtitle: "Documente clinice generate de AI",
    newDoc: "Document nou", searchPlaceholder: "Căutare document…",
    draft: "Ciornă", final: "Final", noDocuments: "Niciun document încă.",
    aiGenerated: "AI", sign: "Semnătură", signed: "Semnat",
  },
  inbox: {
    title: "Mesaje", subtitle: "Conversații WhatsApp cu pacienții",
    noConversations: "Nicio conversație încă.", bot: "Bot", human: "Uman",
    takeOver: "Preia conversația", returnToBot: "Înapoi la bot",
    send: "Trimite", typePlaceholder: "Scrieți un mesaj…", inbound: "Intrare", outbound: "Ieșire",
  },
  settings: {
    languageTitle: "Limba interfeței", languageSubtitle: "Alegeți limba de afișare a sistemului",
  },
  login: {
    title: "Autentificare", subtitle: "Bine ați revenit — autentificați-vă pentru a continua.",
    signInGoogle: "Autentificare cu Google", signingInGoogle: "Se conectează...",
    email: "Email", password: "Parolă", signIn: "Autentificare", signingIn: "Se autentifică...",
    inviteNote: "Ați primit un email de invitație? Faceți clic pe link pentru a seta parola și a vă autentifica.",
    tagline: "Mai puțină birocrație.\nMai mult timp pentru tratament.",
    taglineSub: "Înregistrați ședința — praxisAI scrie nota, pregătește rapoartele și vă lasă liberi pentru ceea ce contează.",
    expiredSession: "Sesiunea a expirat — reconectați-vă pentru securitate.",
    notInvitedError: "Această adresă nu a fost invitată. Accesul este numai prin invitație — contactați administratorul clinicii.",
    authError: "Autentificarea a eșuat. Încercați din nou.",
    wrongCredentials: "Date incorecte. Contactați administratorul clinicii dacă ați uitat parola.",
    orEmail: "sau cu Email",
  },
};

export const translations: Record<Lang, T> = { he, en, ar, ro };
export type TranslationKeys = T;
