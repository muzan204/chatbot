import { request as httpRequest } from "./http.js";
import { UserError } from "../utils/safety.js";
const providers = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};
const request = (url, options) =>
  httpRequest(url, {
    ...options,
    signal: AbortSignal.timeout(
      Math.max(
        1000,
        Math.min(120000, Number(process.env.AI_TIMEOUT_MS) || 30000),
      ),
    ),
  });
export async function askAI(prompt) {
  const provider = process.env.AI_PROVIDER?.toLowerCase(),
    key = process.env.AI_API_KEY,
    model = process.env.AI_MODEL;
  if (!provider || !model || (provider !== "ollama" && !key))
    throw new UserError(
      "🌙 A IA está desativada. O responsável pode configurar o provedor no .env.",
    );
  let answer;
  if (provider === "gemini") {
    const data = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      },
    );
    answer = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("");
  } else if (provider === "ollama") {
    if (!process.env.AI_BASE_URL)
      throw new UserError("Configure AI_BASE_URL para o Ollama.");
    const data = await request(
      `${process.env.AI_BASE_URL.replace(/\/$/, "")}/api/chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{ role: "user", content: prompt }],
          options: { num_predict: 1000 },
        }),
      },
    );
    answer = data.message?.content;
  } else {
    if (!providers[provider])
      throw new UserError("Provedor de IA não reconhecido.");
    const data = await request(`${providers[provider]}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        ...(provider === "openai"
          ? { max_completion_tokens: 1000 }
          : { max_tokens: 1000 }),
        messages: [
          {
            role: "system",
            content:
              "Você é OS NOTURNOS. Responda em português de forma breve e adequada para todas as idades.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    answer = data.choices?.[0]?.message?.content;
  }
  if (!answer) throw new UserError("A IA não retornou uma resposta.");
  return answer.slice(0, 3500);
}
