import { cookies } from "next/headers";

export const ACTIVE_CLINIC_COOKIE = "praxis_active_clinic";

export function getActiveClinicId(): string | null {
  return cookies().get(ACTIVE_CLINIC_COOKIE)?.value ?? null;
}
