import { normalizePhone } from "@/lib/whatsapp/normalize";
import { toChatId } from "@/lib/whatsapp/evolution-api";

// Resolves the routable WhatsApp target for a conversation. When a patient is
// linked we send to their real phone. Otherwise we send to the stored
// wa_contact as-is — including @lid JIDs, which Evolution 2.3.x can route to
// directly (older versions could not, which is why a patient phone is preferred).
export function resolveSendTarget(
  waContact: string,
  patientPhone: string | null | undefined
): { target: string | null; error: string | null } {
  if (patientPhone) return { target: toChatId(normalizePhone(patientPhone)), error: null };
  return { target: waContact, error: null };
}

// Pulls the linked patient's phone from a Supabase embedded relation, which can
// arrive as an object or a single-element array depending on the query.
export function patientPhoneFromRel(rel: unknown): string | null {
  if (!rel) return null;
  const p = Array.isArray(rel) ? rel[0] : rel;
  return (p as { phone?: string | null } | undefined)?.phone ?? null;
}
