import { UserError } from "../utils/safety.js";
export function registerGroups(add) {
  const cat = "👥 GRUPOS",
    admin = "🛡️ ADMINISTRAÇÃO";
  const group = { group: true },
    manage = { group: true, admin: true },
    action = { ...manage, botAdmin: true };
  add(
    "grupo",
    cat,
    (c) =>
      c.reply(
        `👥 ${c.metadata.subject}\n${c.metadata.participants.length} participantes\nAnti-link: ${c.group.antilink}\nBoas-vindas: ${c.group.welcome}\nXP: ${c.group.xp}\nIA: ${c.group.ai}\nPrefixo: ${c.prefix}`,
      ),
    group,
  );
  add(
    "regras",
    cat,
    async (c) => {
      if (c.text) {
        if (!c.isAdmin)
          throw new UserError("Somente administradores podem alterar regras.");
        c.group.rules = c.text;
        await c.repo.save();
      }
      await c.reply(c.group.rules);
    },
    group,
  );
  add(
    "admins",
    cat,
    (c) => {
      const ids = c.metadata.participants
        .filter((p) => p.admin)
        .map((p) => p.id);
      return c.reply(ids.map((id) => "@" + id.split("@")[0]).join("\n"), ids);
    },
    group,
  );
  add(
    "abrir fechar",
    admin,
    async (c) => {
      await c.sock.groupSettingUpdate(
        c.chat,
        c.command === "abrir" ? "not_announcement" : "announcement",
      );
      await c.reply(c.command === "abrir" ? "Grupo aberto." : "Grupo fechado.");
    },
    action,
  );
  add(
    "linkgrupo",
    cat,
    async (c) =>
      c.reply(
        `https://chat.whatsapp.com/${await c.sock.groupInviteCode(c.chat)}`,
      ),
    action,
  );
  add(
    "marcar marcartodos",
    cat,
    async (c) => {
      const ids = c.metadata.participants.map((p) => p.id);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await c.reply(
          (c.text || "🌙 Atenção, grupo!") +
            "\n" +
            batch.map((id) => "@" + id.split("@")[0]).join(" "),
          batch,
        );
      }
    },
    manage,
  );
  for (const [name, key] of Object.entries({
    antilink: "antilink",
    welcome: "welcome",
    despedida: "goodbye",
    xp: "xp",
    iagrupo: "ai",
  }))
    add(
      name,
      admin,
      async (c) => {
        if (!["on", "off"].includes(c.text))
          throw new UserError(`Use ${c.prefix}${name} on ou off.`);
        if (name === "antilink" && c.text === "on" && !c.botAdmin)
          throw new UserError("Preciso ser administrador para apagar links.");
        c.group[key] = c.text === "on";
        await c.repo.save();
        await c.reply(`${name}: ${c.text}`);
      },
      manage,
    );
  add(
    "prefixo",
    admin,
    async (c) => {
      if (!/^\S{1,5}$/u.test(c.text))
        throw new UserError("Informe de 1 a 5 caracteres sem espaços.");
      c.group.prefix = c.text;
      await c.repo.save();
      await c.reply(`Prefixo alterado para ${c.text}`);
    },
    manage,
  );
  const operations = {
    ban: "remove",
    kick: "remove",
    promover: "promote",
    rebaixar: "demote",
  };
  for (const [name, operation] of Object.entries(operations))
    add(
      name,
      admin,
      async (c) => {
        const target = c.target();
        if (
          target.id === c.selfId ||
          target.id === c.sender ||
          target.admin === "superadmin"
        )
          throw new UserError(
            "Não posso executar essa ação sobre esse participante.",
          );
        const result = await c.sock.groupParticipantsUpdate(
          c.chat,
          [target.id],
          operation,
        );
        if (result.some((r) => String(r.status) !== "200"))
          throw new UserError(
            "O WhatsApp não permitiu a alteração. Verifique as permissões.",
          );
        await c.reply("Participante atualizado.");
      },
      action,
    );
  add(
    "mute unmute",
    admin,
    async (c) => {
      const target = c.target();
      if (target.admin || target.id === c.selfId)
        throw new UserError(
          "Não é possível silenciar administradores ou o bot.",
        );
      if (c.command === "mute") {
        const minutes = Number(c.args.find((a) => /^\d+$/.test(a)) || 10);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
          throw new UserError("Duração: de 1 a 1440 minutos.");
        c.group.muted[target.id] = Date.now() + minutes * 60000;
      } else delete c.group.muted[target.id];
      await c.repo.save();
      await c.reply(
        c.command === "mute"
          ? "Mute ativo: as mensagens serão apagadas."
          : "Mute removido.",
      );
    },
    action,
  );
  add(
    "advertir avisos limparavisos",
    admin,
    async (c) => {
      const target = c.target();
      if (c.command === "advertir") {
        const list = (c.group.warnings[target.id] ||= []);
        if (list.length >= 100)
          throw new UserError(
            "Limite de 100 avisos. Limpe os avisos antes de continuar.",
          );
        list.push({
          at: new Date().toISOString(),
          reason:
            c.args
              .filter((a) => !a.startsWith("@"))
              .join(" ")
              .slice(0, 300) || "Sem motivo informado",
        });
      }
      if (c.command === "limparavisos") delete c.group.warnings[target.id];
      await c.repo.save();
      const list = c.group.warnings[target.id] || [];
      await c.reply(
        `Advertências: ${list.length}\n${list
          .slice(-5)
          .map((w) => `${w.at.slice(0, 10)}: ${w.reason}`)
          .join("\n")}`,
      );
    },
    manage,
  );
}
