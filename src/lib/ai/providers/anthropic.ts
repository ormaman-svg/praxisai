import type { InvokeParams, InvokeResult } from "../invoke";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function headers() {
  return {
    "x-api-key": process.env.CL_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

export async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages,
  };

  if (params.tools?.length) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  const res = await fetch(API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);

  const data = await res.json();

  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  const toolCalls = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "tool_use")
    .map((b: { id: string; name: string; input: Record<string, unknown> }) => ({
      id: b.id,
      name: b.name,
      input: b.input,
    }));

  return {
    text,
    toolCalls,
    stopReason: data.stop_reason === "tool_use" ? "tool_use" : data.stop_reason === "max_tokens" ? "max_tokens" : "end_turn",
  };
}

export async function invokeAnthropicStream(params: Omit<InvokeParams, "tools">): Promise<ReadableStream> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 1024,
      stream: true,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic stream error ${res.status}`);

  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          break;
        }
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "content_block_delta") {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ delta: { text: parsed.delta?.text ?? "" } })}\n\n`
                )
              );
            }
          } catch {}
        }
      }
    },
  });
}
