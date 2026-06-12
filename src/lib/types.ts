export type MemberRole = "owner" | "admin" | "therapist" | "receptionist";
export type MemberStatus = "active" | "disabled";

export interface Clinic { id: string; name: string; slug: string | null; logo_url: string | null; }
export interface Profile { id: string; full_name: string; phone: string | null; avatar_url: string | null; }

export interface Membership {
  id: string; clinic_id: string; user_id: string;
  role: MemberRole; status: MemberStatus; created_at: string;
  clinics?: Clinic; profiles?: Profile;
}

export interface Patient {
  id: string; clinic_id: string; first_name: string; last_name: string;
  national_id: string | null; dob: string | null; phone: string | null; email: string | null;
  kupah: string | null; diagnosis: string | null; bituach_leumi_case: boolean;
  primary_therapist_id: string | null; status: "active" | "discharged" | "on_hold"; created_at: string;
}

export type TreatmentNoteSection = { key: string; label: string; letter: string; content: string };
export type TreatmentNote = { template_id: string; template_name: string; sections: TreatmentNoteSection[] };

export interface Treatment {
  id: string; clinic_id: string; patient_id: string; therapist_id: string | null;
  treated_at: string; type: string; subjective: string | null; objective: string | null;
  assessment: string | null; plan: string | null; vas: number | null;
  note: TreatmentNote | null; template_id: string | null;
}

export interface Doc {
  id: string; clinic_id: string; patient_id: string | null; type: string;
  title: string; content: string; status: "draft" | "final"; created_at: string;
}

export const ROLE_HE: Record<MemberRole, string> = {
  owner: "בעלים", admin: "מנהל", therapist: "מטפל/ת", receptionist: "קבלה",
};
export const DOC_TYPE_HE: Record<string, string> = {
  bituach_leumi: "מכתב לביטוח לאומי",
  referral: "הפניה לאורתופד",
  status_report: "דו\u05f4ח התקדמות",
  discharge_summary: "סיכום שחרור",
  insurance: "תביעת ביטוח",
  sick_leave: "אישור מחלה",
};
export const TREATMENT_TYPE_HE: Record<string, string> = {
  initial_eval: "הערכה ראשונית", follow_up: "טיפול המשך", discharge: "שחרור",
  telehealth: "טיפול מרחוק", home_visit: "ביקור בית",
};
