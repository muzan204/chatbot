import { registerBasic } from "./basic.js";
import { registerUtilities } from "./utilities.js";
import { registerGroups } from "./groups.js";
import { registerFun } from "./fun.js";
import { askAI } from "../services/ai.js";
import { sticker } from "../services/stickers.js";
import { UserError } from "../utils/safety.js";
export const commands = new Map();
const add = (names, category, run, flags = {}) => {
  const aliases = names.split(" ");
  const cmd = { name: aliases[0], category, run, ...flags };
  for (const name of aliases) commands.set(name, cmd);
};
registerBasic(add, commands);
registerUtilities(add);
registerGroups(add);
registerFun(add);
add(
  "ia ai pergunta",
  "🤖 INTELIGÊNCIA ARTIFICIAL",
  async (c) => {
    if (c.isGroup && !c.group.ai)
      throw new UserError(
        "A IA está desativada neste grupo. Um administrador pode ativá-la com iagrupo on.",
      );
    c.requireText("ia sua pergunta");
    await c.reply(await askAI(c.text));
  },
  { expensive: true },
);
add(
  "sticker s",
  "🖼️ FIGURINHAS",
  async (c) => c.send({ sticker: await sticker(c.quoted || c.content) }),
  { expensive: true },
);
