import type { InvokeParams, InvokeResult } from "../invoke";

// Stub — implement when switching provider.
// Set clinics.settings.ai_provider = "openai" to activate.
export async function invokeOpenAI(_params: InvokeParams): Promise<InvokeResult> {
  throw new Error(
    "OpenAI provider not yet implemented. Fill in this file with the OpenAI chat completions API call."
  );
}
