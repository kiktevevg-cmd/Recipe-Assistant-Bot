import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env["GEMINI_API_KEY"];
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required.");
}

const genAI = new GoogleGenerativeAI(apiKey);
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(messages: Message[]): Promise<string> {
  // Extract system prompt (first message with role "system")
  const systemMsg = messages.find((m) => m.role === "system");
  const systemInstruction = systemMsg?.content ?? "";

  // Convert remaining messages to Gemini format
  const history = messages
    .filter((m) => m.role !== "system")
    .slice(0, -1) // all except the last (current user message)
    .map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

  const lastUserMessage = messages.filter((m) => m.role !== "system").at(-1);
  if (!lastUserMessage) return "Не удалось получить ответ.";

  const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction,
  });

  const chatSession = geminiModel.startChat({ history });
  const result = await chatSession.sendMessage(lastUserMessage.content);
  return result.response.text();
}
