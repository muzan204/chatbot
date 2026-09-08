// Apenas campos controlados: nunca serialize mensagens, erros externos ou credenciais.
export const log = (level, event, fields = {}) =>
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      event,
      ...Object.fromEntries(
        Object.entries(fields).filter(([k]) =>
          ["command", "code", "attempt", "count"].includes(k),
        ),
      ),
    }),
  );
