import { readFile, writeFile } from 'node:fs/promises';
const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const css = await read('style.css');
let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
for (const name of ['scenes.js', 'simulation.js', 'engine.js', 'app.js']) {
  const code = (await read(name)).replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script defer src="${name}"></script>`, () => `<script>${code}</script>`);
}
// Inline scripts execute after the document has been parsed.
const scripts = [...html.matchAll(/<script>[\s\S]*?<\/script>/g)].map(m => m[0]).join('\n');
html = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace('</body>', () => scripts + '\n</body>');
await writeFile(new URL('../play.html', import.meta.url), html);
console.log('Created play.html');
