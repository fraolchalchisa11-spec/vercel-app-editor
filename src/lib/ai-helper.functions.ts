import { createServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AskInput = {
  messages: ChatMessage[];
  subject?: string | null;
};

const SYSTEM_PROMPT =
  "You are the BTR study helper for Ethiopian university freshman and exit-exam students. " +
  "Explain clearly and briefly (under 180 words unless the student asks for more), " +
  "use simple English, short steps and small examples. If a question is outside studying, " +
  "politely steer back to study help.";

export const askStudyHelper = createServerFn({ method: "POST" })
  .validator((input: AskInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI helper is not configured yet.");

    const history = (data?.messages ?? []).slice(-12).filter((m) => m?.content?.trim());
    if (history.length === 0) return { text: "" };

    const contextLine = data?.subject
      ? `The student is currently reading notes for the subject: ${data.subject}.`
      : "";

    const input = [
      { role: "developer", content: [{ type: "input_text", text: `${SYSTEM_PROMPT}\n${contextLine}` }] },
      ...history.map((m) => ({
        role: m.role,
        content: [
          m.role === "assistant"
            ? { type: "output_text", text: m.content }
            : { type: "input_text", text: m.content },
        ],
      })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("The helper is busy right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("The AI helper has run out of credits. Please add credits to keep using it.");
      throw new Error(`AI helper failed (${res.status}). ${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.completed" && !text && event.response?.output_text) {
            text = event.response.output_text;
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }

    return { text: text.trim() };
  });
