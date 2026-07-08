import OpenAI from "openai";

const apiKey = process.env["OPENAI_API_KEY"];
if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required.");
}

export const openai = new OpenAI({ apiKey });

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(messages: Message[]): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? "Не удалось получить ответ.";
}
