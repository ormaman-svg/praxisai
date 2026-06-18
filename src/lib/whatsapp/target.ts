import { normalizePhone } from "@/lib/whatsapp/normalize";
import { toChatId } from "@/lib/whatsapp/evolution-api";

// Resolves the routable WhatsApp target for a conversation. The stored
// wa_contact may be an @lid JID (an internal id, not a phone number); when a
// patient is linked we always send to their real phone instead.
export function resolveSendTarget(
  waContact: string,
  patientPhone: string | null | undefined
): { target: string | null; error: string | null } {
  if (patientPhone) return { target: toChatId(normalizePhone(patientPhone)), error: null };
  if (waContact.endsWith("@lid")) {
    return { target: null, error: "אין מספר טלפון לפונה זה. הוסיפו אותו כמטופל עם מספר תקין." };
  }
  return { target: waContact, error: null };
}

// Pulls the linked patient's phone from a Supabase embedded relation, which can
// arrive as an object or a single-element array depending on the query.
export function patientPhoneFromRel(rel: unknown): string | null {
  if (!rel) return null;
  const p = Array.isArray(rel) ? rel[0] : rel;
  return (p as { phone?: string | null } | undefined)?.phone ?? null;
}
