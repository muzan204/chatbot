import QRCode from "qrcode";
import { calculate } from "../utils/calculator.js";
import { UserError } from "../utils/safety.js";
import { request } from "../services/http.js";
export function registerUtilities(add) {
  const cat = "🛠️ UTILIDADES";
  add("calculadora", cat, (c) => c.reply(String(calculate(c.text))));
  add("data hora", cat, (c) =>
    c.reply(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: c.config.timezone,
      }).format(new Date()),
    ),
  );
  add("qr", cat, async (c) => {
    c.requireText("qr texto ou link");
    await c.send({
      image: await QRCode.toBuffer(c.text.slice(0, 1500)),
      caption: "Seu QR Code 🌙",
    });
  });
  add("link", cat, (c) => {
    const n = c.text.replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(n))
      throw new UserError("Use: link número com código do país e DDD.");
    return c.reply(`https://wa.me/${n}`);
  });
  add("cep", cat, async (c) => {
    const cep = c.text.replace(/\D/g, "");
    if (!/^\d{8}$/.test(cep))
      throw new UserError("Informe um CEP com 8 dígitos.");
    const d = await request(`https://viacep.com.br/ws/${cep}/json/`);
    await c.reply(
      d.erro
        ? "CEP não encontrado."
        : `${d.logradouro}\n${d.bairro}\n${d.localidade} / ${d.uf}\nCEP ${d.cep}`,
    );
  });
  add("clima", cat, async (c) => {
    c.requireText("clima cidade");
    if (!process.env.WEATHER_API_KEY)
      throw new UserError("Clima desativado. Configure WEATHER_API_KEY.");
    const q = new URLSearchParams({
      q: c.text,
      appid: process.env.WEATHER_API_KEY,
      units: "metric",
      lang: "pt_br",
    });
    const d = await request(
      `https://api.openweathermap.org/data/2.5/weather?${q}`,
    );
    await c.reply(
      `🌤️ ${d.name}: ${d.main.temp} °C\n${d.weather[0].description}\nUmidade: ${d.main.humidity}%`,
    );
  });
  add("traduzir", cat, async (c) => {
    const [target, ...words] = c.args;
    if (!/^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(target || "") || !words.length)
      throw new UserError("Use: traduzir en texto");
    if (!process.env.TRANSLATE_URL)
      throw new UserError("Tradução desativada. Configure TRANSLATE_URL.");
    const d = await request(
      process.env.TRANSLATE_URL.replace(/\/$/, "") + "/translate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          q: words.join(" "),
          source: "auto",
          target,
          api_key: process.env.TRANSLATE_API_KEY || undefined,
        }),
      },
    );
    await c.reply(d.translatedText || "Sem tradução.");
  });
  add("encurtar", cat, async (c) => {
    let url;
    try {
      url = new URL(c.text);
    } catch {
      throw new UserError("Informe uma URL completa com https://.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new UserError("URL inválida.");
    if (!process.env.SHORTENER_API_KEY)
      throw new UserError(
        "Encurtador desativado. Configure SHORTENER_API_KEY.",
      );
    const d = await request("https://api.tinyurl.com/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.SHORTENER_API_KEY}`,
      },
      body: JSON.stringify({ url: url.href }),
    });
    await c.reply(d.data?.tiny_url || "Não foi possível encurtar.");
  });
}
