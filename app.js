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
    if (saved.memory && Number.isInteger(saved.memory.turn) && saved.memory.facts && saved.memory.seen && Array.isArray(saved.memory.inventory)) state.memory = saved.memory;
    state.messages = saved.messages.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
  }
} catch { status.textContent = 'Не удалось прочитать сохранение. Можно начать новую игру.'; }
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
    const text = document.createElement('p'); text.textContent = 'Откройте «Настройки», задайте мир и персонажа, затем напишите первое действие. Например: «Я стучу в дверь лавки». Персонаж реагирует на вопросы, поступки, угрозы и поддержку. Осматривайтесь, собирайте предметы и открывайте новые сцены.';
    intro.append(title, text); list.append(intro);
  }
  for (const message of state.messages) {
    const item = document.createElement('article'); item.className = message.role;
    const label = document.createElement('small'); label.textContent = message.role === 'user' ? 'ВЫ' : 'РАССКАЗЧИК';
    const text = document.createElement('p'); text.textContent = message.content;
    item.append(label, text); list.append(item);
  }
  document.querySelector('#badge').textContent = '● Офлайн';
  document.querySelector('#memory').textContent = `Доверие: ${state.memory.trust} · Напряжение: ${state.memory.tension} · Находки: ${state.memory.inventory.join(', ') || 'нет'}`;
  list.scrollTop = list.scrollHeight;
}
settings.addEventListener('submit', event => {
  event.preventDefault(); const config = Object.fromEntries(new FormData(settings));
  if (config.world !== state.config.world || config.character !== state.config.character || config.player !== state.config.player) {
    if (state.messages.length && !confirm('Изменение вводных начнёт новую историю. Продолжить?')) return;
    state.messages = []; state.memory = engine.fresh();
  }
  state.config = config;
  status.textContent = 'Вводные сохранены.'; save(); render(); showSettings(false);
});
document.querySelector('#reset').addEventListener('click', () => {
  if (busy || !confirm('Удалить диалог и начать новую историю?')) return;
  state.messages = []; state.memory = engine.fresh(); status.textContent = ''; save(); render();
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
    state = data;
    for (const name of ['world','character','player']) settings.elements.namedItem(name).value = state.config[name];
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
