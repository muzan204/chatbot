import { copyFile, readFile, writeFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
for (const name of ['README.md', 'VALIDACAO.md', 'DISCLOUD.md'])
  await copyFile(name, `public/downloads/${name}`);
const file = 'public/index.html';
const html = await readFile(file, 'utf8');
await writeFile(file, html.replace(/V\d+\.\d+\.\d+/g, `V${version}`));
console.log('Versão e documentação pública sincronizadas.');
