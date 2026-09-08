export function registerBasic(add, registry) {
  add("menu ajuda", "👤 USUÁRIO", async (c) => {
    const categories = [
      "👤 USUÁRIO",
      "🛠️ UTILIDADES",
      "🎮 DIVERSÃO",
      "🤖 INTELIGÊNCIA ARTIFICIAL",
      "🖼️ FIGURINHAS",
      "👥 GRUPOS",
      "🛡️ ADMINISTRAÇÃO",
      "📊 INFORMAÇÕES",
    ];
    const lines = categories.map(
      (cat) =>
        `┃ ${cat}\n┃ ${[...new Set([...registry.values()].filter((x) => x.category === cat).map((x) => c.prefix + x.name))].join(" · ")}`,
    );
    await c.reply(
      `╭━━━〔 🌙 ${c.config.name} 〕━━━╮\n┃\n${lines.join("\n┃\n")}\n┃\n╰━━━━━━━━━━━━━━━━━━━━╯\nUse ${c.prefix}ajuda e consulte o README para os argumentos.`,
    );
  });
  add("ping", "📊 INFORMAÇÕES", (c) =>
    c.reply(`🏓 Pong! Processamento: ${Date.now() - c.started} ms.`),
  );
  add("bot info", "📊 INFORMAÇÕES", (c) =>
    c.reply(
      `🌙 ${c.config.name}\nBot modular para grupos e conversas privadas.\nPrefixo: ${c.prefix}`,
    ),
  );
  add("criador", "📊 INFORMAÇÕES", (c) =>
    c.reply(
      `${process.env.CREATOR_NAME || "Equipe OS NOTURNOS"}${process.env.CREATOR_CONTACT ? "\n" + process.env.CREATOR_CONTACT : ""}`,
    ),
  );
  add("status uptime", "📊 INFORMAÇÕES", (c) =>
    c.reply(
      `🌙 Conectado\nTempo ativo: ${Math.floor(process.uptime())} segundos.`,
    ),
  );
  add("perfil", "👤 USUÁRIO", (c) =>
    c.reply(
      `👤 ${c.displayName}\nMensagens registradas: ${c.repo.user(c.sender).messages}`,
    ),
  );
  add(
    "nivel rank",
    "👤 USUÁRIO",
    (c) => {
      const u = c.group.users[c.sender] || { xp: 0, messages: 0 };
      return c.reply(
        `Nível ${Math.floor(Math.sqrt(u.xp / 100))} · ${u.xp} XP\n${u.messages} mensagens${c.group.xp ? "" : "\nXP desativado neste grupo."}`,
      );
    },
    { group: true },
  );
  add(
    "ranking",
    "👤 USUÁRIO",
    (c) => {
      const rows = Object.entries(c.group.users)
        .sort((a, b) => b[1].xp - a[1].xp)
        .slice(0, 10);
      return c.reply(
        rows
          .map(([id, u], i) => `${i + 1}. @${id.split("@")[0]} — ${u.xp} XP`)
          .join("\n") || "Ranking vazio.",
        rows.map(([id]) => id),
      );
    },
    { group: true },
  );
}
