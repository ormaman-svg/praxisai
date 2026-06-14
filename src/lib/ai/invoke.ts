// Provider-agnostic AI invocation layer.
// To swap providers: set clinics.settings.ai_provider = "openai" and implement providers/openai.ts.
// All product code calls invoke() — never imports Anthropic/OpenAI directly.

export type Message = { role: "user" | "assistant"; content: string };

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON Schema
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type InvokeResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
};

export type InvokeParams = {
  system: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  provider?: "anthropic" | "openai"; // defaults to "anthropic"
};

export async function invoke(params: InvokeParams): Promise<InvokeResult> {
  const provider = params.provider ?? "anthropic";

  if (provider === "anthropic") {
    const { invokeAnthropic } = await import("./providers/anthropic");
    return invokeAnthropic(params);
  }

  if (provider === "openai") {
    const { invokeOpenAI } = await import("./providers/openai");
    return invokeOpenAI(params);
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

// Streaming variant — only supported by anthropic for now.
// Returns a ReadableStream of SSE chunks: `data: {"delta":{"text":"..."}}\n\n`
export async function invokeStream(params: Omit<InvokeParams, "tools">): Promise<ReadableStream> {
  const { invokeAnthropicStream } = await import("./providers/anthropic");
  return invokeAnthropicStream(params);
}
