import { UserError } from "../utils/safety.js";
export async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("upstream");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1000000) throw new Error("size");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new UserError(
      "O serviço externo não respondeu. Tente novamente mais tarde.",
    );
  }
}
