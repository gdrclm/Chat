(function () {
'use strict';
const settings = document.querySelector('#settings');
const chat = document.querySelector('#chat');
const list = document.querySelector('#messages');
const status = document.querySelector('#status');
const field = document.querySelector('#message');
const send = document.querySelector('#send');
const engine = globalThis.StoryEngine;
const key = 'between-lines-offline-v2';
let busy = false;
let state = { config: Object.fromEntries(new FormData(settings)), messages: [], memory: engine.fresh() };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && saved.config && Array.isArray(saved.messages)) {
    state.config = { ...state.config, ...saved.config };
    if (saved.memory && Number.isInteger(saved.memory.turn) && saved.memory.facts && saved.memory.seen && Array.isArray(saved.memory.inventory)) state.memory = engine.restore(state.config, saved.memory);
    state.messages = saved.messages.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
  }
} catch { status.textContent = 'Не удалось прочитать сохранение. Можно начать новую игру.'; }
state.memory = engine.restore(state.config, state.memory);
for (const [name, value] of Object.entries(state.config)) if (settings.elements.namedItem(name)) settings.elements.namedItem(name).value = value;
function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); }
  catch { status.textContent = 'Браузер не смог сохранить игру. Текущий диалог доступен до закрытия страницы.'; }
}
function render() {
  list.replaceChildren();
  if (!state.messages.length) {
    const intro = document.createElement('div'); intro.className = 'intro';
    const title = document.createElement('h3'); title.textContent = 'Каждая история начинается со слова.';
    const text = document.createElement('p'); text.textContent = 'Откройте «Настройки», задайте мир и персонажа, затем напишите первое действие. Пишите своими словами и объединяйте действия: «Осматриваюсь, затем беру письмо и читаю его». Можно шутить, договариваться, отказываться и менять планы. В «Опорах истории» задаются ваши предметы, цели и правила мира.';
    intro.append(title, text); list.append(intro);
  }
  for (const message of state.messages) {
    const item = document.createElement('article'); item.className = message.role;
    const label = document.createElement('small'); label.textContent = message.role === 'user' ? 'ВЫ' : 'РАССКАЗЧИК';
    const text = document.createElement('p'); text.textContent = message.content;
    item.append(label, text); list.append(item);
  }
  const profile = engine.profile(state.config);
  document.querySelector('#badge').textContent = '● Локально · 3.0';
  const title = profile.title || 'Ваша история';
  document.querySelector('#story-title').textContent = title[0].toUpperCase() + title.slice(1);
  document.querySelector('#memory').textContent = `${state.memory.place} · Доверие: ${state.memory.trust} · Риск: ${state.memory.clocks.danger}/6 · Вещи: ${state.memory.inventory.join(', ') || 'нет'}`;
  list.scrollTop = list.scrollHeight;
  document.querySelector('#remembered-goal').textContent = `Цель героя: ${state.memory.facts.goal || 'пока не названа'}. Цель персонажа: ${profile.motive}.`;
  const journal = document.querySelector('#journal'); journal.replaceChildren();
  for (const event of state.memory.journal.filter(e => e.kind !== 'turn').slice(-14)) {
    const row = document.createElement('li'); row.textContent = event.text; journal.append(row);
  }
  const threads = document.querySelector('#threads'); threads.replaceChildren();
  for (const thread of state.memory.threads.filter(t => t.status === 'open').slice(-6)) {
    const row = document.createElement('li'); row.textContent = thread.text; threads.append(row);
  }
}
settings.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const config = Object.fromEntries(new FormData(settings));
    const changed = JSON.stringify(config) !== JSON.stringify(state.config);
    state.memory = engine.reframe(state.memory, state.config, config);
    state.config = config;
    if (changed && state.messages.length) {
      const p = engine.profile(config);
      state.messages.push({ role: 'assistant', content: `Вводные обновлены. Место: ${state.memory.place}. Персонаж: ${p.name}. Переписка сохранена; дальнейшие события учитывают новые условия.` });
    }
    status.textContent = 'Вводные применены. История продолжается.'; save(); render(); showSettings(false);
  } catch (error) { status.textContent = 'Не удалось применить вводные: ' + error.message; showSettings(false); }
});
document.querySelector('#reset').addEventListener('click', () => {
  if (busy || !confirm('Удалить диалог и начать новую историю?')) return;
  state.messages = []; state.memory = engine.restore(state.config, engine.fresh()); status.textContent = ''; save(); render();
});
chat.addEventListener('submit', async event => {
  event.preventDefault();
  const text = field.value.trim(); if (busy) return;
  if (!text) { status.textContent = 'Напишите сообщение.'; return; }
  busy = true; send.disabled = true; settings.querySelector('button').disabled = true;
  try {
    state.messages.push({ role: 'user', content: text }); field.value = '';
    status.textContent = 'Персонаж обдумывает ответ…';
    render();
    const result = engine.reply(state.config, state.memory, text);
    state.memory = result.memory;
    const answer = result.text;
    state.messages.push({ role: 'assistant', content: answer }); status.textContent = ''; save();
  } catch (error) {
    state.messages.pop(); field.value = text; status.textContent = `${error.message} Сообщение возвращено в поле ввода — попробуйте снова.`; save();
  } finally { busy = false; send.disabled = false; settings.querySelector('button').disabled = false; render(); }
});
field.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send.click(); } });
render();
status.textContent = '';

document.querySelector('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'story-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.querySelector('#import').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Сохранение слишком большое.');
    const data = JSON.parse(await file.text());
    const m = data.memory;
    if (!data.config || !['world','character','player'].every(k => typeof data.config[k] === 'string') || !Array.isArray(data.messages) || !data.messages.every(v => ['user','assistant'].includes(v.role) && typeof v.content === 'string') || !m || !['turn','trust','tension','stage'].every(k => Number.isFinite(m[k])) || !Array.isArray(m.inventory) || !m.inventory.every(v => typeof v === 'string') || !m.facts || !m.seen) throw new Error('Неверный формат сохранения.');
    if (!confirm('Заменить текущую историю загруженной?')) return;
    const importedConfig = {world:data.config.world,character:data.config.character,player:data.config.player,canon:typeof data.config.canon==='string'?data.config.canon:''};
    state = { ...data, config: importedConfig, memory: engine.restore(importedConfig, data.memory) };
    for (const name of ['world','character','player','canon']) settings.elements.namedItem(name).value = state.config[name] || '';
    status.textContent = 'История загружена.'; save(); render();
  } catch (error) { status.textContent = error.message; }
  finally { event.target.value = ''; }
});

function showSettings(open) {
  document.querySelector('#settings-page').hidden = !open;
  document.querySelector('#chat-page').hidden = open;
  (open ? document.querySelector('#close-settings') : document.querySelector('#open-settings')).focus();
}
document.querySelector('#open-settings').addEventListener('click', () => showSettings(true));
document.querySelector('#close-settings').addEventListener('click', () => showSettings(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') showSettings(false); });
function resizeViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--app-height', `${viewport ? viewport.height : window.innerHeight}px`);
  document.documentElement.style.setProperty('--app-top', `${viewport ? viewport.offsetTop : 0}px`);
  list.scrollTop = list.scrollHeight;
}
window.addEventListener('resize', resizeViewport);
if (window.visualViewport) { window.visualViewport.addEventListener('resize', resizeViewport); window.visualViewport.addEventListener('scroll', resizeViewport); }
resizeViewport();

})();
