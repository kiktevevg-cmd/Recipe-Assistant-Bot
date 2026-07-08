import OpenAI from "openai";

const apiKey = process.env["GROQ_API_KEY"];
if (!apiKey) {
  throw new Error("GROQ_API_KEY environment variable is required.");
}

// Groq is OpenAI-compatible — use the openai package with Groq's base URL
const groq = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
});

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(messages: Message[]): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? "Не удалось получить ответ.";
}
