import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function walk(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) await walk(p);
    else if (p.endsWith(".js")) {
      const r = spawnSync(process.execPath, ["--check", p], {
        stdio: "inherit",
      });
      if (r.status !== 0) process.exit(1);
    }
  }
}
await walk("src");
await walk("test");
console.log("Sintaxe validada.");
