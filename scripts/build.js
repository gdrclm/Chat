import { readFile, writeFile } from 'node:fs/promises';
const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const css = await read('style.css');
let html = await read('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
for (const name of ['spatial.js', 'narrator.js', 'messages.js', 'dialogue.js', 'developer.js', 'social.js', 'conversation-topics.js', 'npc-personality.js', 'conversation-memory.js', 'npc-biography.js', 'conversation-engine.js', 'action-catalog.js', 'rpg-core.js', 'physical-system.js', 'investigation-system.js', 'equipment-crafting.js', 'action-resolver.js', 'goals-story.js', 'npc-agency.js', 'economy-system.js', 'society-system.js', 'life-combat.js', 'genre-system.js', 'extended-actions.js', 'rpg-engine.js', 'semantic.js', 'scenes.js', 'simulation.js', 'engine.js', 'story-presets.js', 'app.js']) {
  const code = (await read(name)).replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script defer src="${name}"></script>`, () => `<script>${code}</script>`);
}
// Inline scripts execute after the document has been parsed.
const scripts = [...html.matchAll(/<script>[\s\S]*?<\/script>/g)].map(m => m[0]).join('\n');
html = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace('</body>', () => scripts + '\n</body>');
await writeFile(new URL('../play.html', import.meta.url), html);
console.log('Created play.html');
