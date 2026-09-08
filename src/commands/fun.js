import { randomInt } from "node:crypto";
import { UserError } from "../utils/safety.js";
const quizzes = new Map();
export function registerFun(add) {
  const cat = "🎮 DIVERSÃO",
    pick = (a) => a[randomInt(a.length)];
  add("dado", cat, (c) => c.reply(`🎲 ${randomInt(1, 7)}`));
  add("moeda", cat, (c) => c.reply(pick(["🪙 Cara", "🪙 Coroa"])));
  add("numero", cat, (c) => {
    const min = Number(c.args[0] || 1),
      max = Number(c.args[1] || 100);
    if (
      !Number.isSafeInteger(min) ||
      !Number.isSafeInteger(max) ||
      min > max ||
      Math.abs(min) > 1e9 ||
      Math.abs(max) > 1e9
    )
      throw new UserError(
        "Use: numero mínimo máximo (entre -1 bilhão e 1 bilhão).",
      );
    return c.reply(String(randomInt(min, max + 1)));
  });
  add("ship", cat, (c) => {
    c.requireText("ship nome e nome");
    return c.reply(
      `💜 ${c.text.slice(0, 150)}: ${randomInt(0, 101)}% de afinidade! Apenas uma brincadeira.`,
    );
  });
  const lists = {
    piada: [
      "O que o zero disse ao oito? Belo cinto!",
      "Por que o livro de matemática ficou triste? Tinha muitos problemas.",
    ],
    verdade: [
      "Qual pequena conquista deixou você feliz esta semana?",
      "Qual hobby você gostaria de aprender?",
    ],
    desafio: [
      "Compartilhe uma música que deixa você feliz.",
      "Elogie uma qualidade de alguém do grupo.",
    ],
  };
  for (const [name, items] of Object.entries(lists))
    add(name, cat, (c) => c.reply(pick(items)));
  add("quiz", cat, (c) => {
    const key = c.chat + ":" + c.sender,
      now = Date.now();
    for (const [k, v] of quizzes) if (v.until < now) quizzes.delete(k);
    if (c.text) {
      const q = quizzes.get(key);
      if (!q)
        throw new UserError(
          "Inicie com quiz. Você terá 60 segundos para responder.",
        );
      quizzes.delete(key);
      return c.reply(
        c.text.toLowerCase() === q.answer
          ? "✅ Acertou!"
          : `Resposta: ${q.answer}`,
      );
    }
    if (quizzes.size >= 1000)
      throw new UserError("Há muitos jogos ativos. Tente mais tarde.");
    const q = pick([
      { text: "Quanto é 7 × 8?", answer: "56" },
      {
        text: "Qual planeta é conhecido como planeta vermelho?",
        answer: "marte",
      },
      { text: "Quantos lados tem um hexágono?", answer: "6" },
    ]);
    quizzes.set(key, { ...q, until: now + 60000 });
    return c.reply(
      `🎮 ${q.text}\nResponda: ${c.prefix}quiz resposta (60 segundos)`,
    );
  });
}
