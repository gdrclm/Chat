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
const outcomeLabels={success:'Успех',partial_success:'Частичный успех',refused:'Отказ',clarification:'Нужно уточнение'};
const intentLabels={claim:'сообщить версию',plant_evidence:'подбросить улику',request_plan:'предложить план',carry:'перенести',hide_item:'спрятать предмет',defer:'отложить действие',craft_gift:'сделать подарок',give:'передать предмет',move:'перейти',return:'вернуться',open:'открыть',close:'закрыть',take:'взять',inspect:'осмотреть',agree:'согласиться',help:'попросить помощи',apology:'извиниться',insult:'оскорбить',greet:'поздороваться',find_job:'найти работу',work:'выполнить работу',collect_pay:'получить плату',deliver_job:'доставить посылку',explore:'исследовать',buy:'купить',select_npc:'обратиться к персонажу',magic:'магия',use:'использовать',destroy:'сломать',drop:'оставить предмет',goal:'обозначить цель',question:'задать вопрос',remember:'вспомнить',custom:'уточнить замысел'};
let busy = false;
let state = { config: Object.fromEntries(new FormData(settings)), messages: [], memory: engine.fresh() };
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && saved.config && Array.isArray(saved.messages)) {
    state.config = { ...state.config, ...saved.config };
    if (saved.memory && Number.isInteger(saved.memory.turn) && saved.memory.facts && saved.memory.seen && Array.isArray(saved.memory.inventory)) state.memory = engine.restore(state.config, saved.memory);
    state.messages = saved.messages.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string');
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
    const text = document.createElement('p'); text.textContent = 'Задайте мир в настройках автора или начните с лавки. Слова могут быть ложью; вещи меняются от действий. Например: «Осматриваюсь», «Прошу Миру вынести ларец наружу и открыть позже». Кнопка «Мир» показывает выходы, людей и дела.';
    intro.append(title, text); list.append(intro);
  }
  for (const message of state.messages) {
    const item = document.createElement('article'); item.className = message.role;
    const label = document.createElement('small'); label.textContent = message.role === 'user' ? 'ВЫ' : 'РАССКАЗЧИК';
    const text = document.createElement('p'); text.textContent = message.content;
    item.append(label, text);
    if(message.outcome?.status) {
      const result = document.createElement('small');result.className='outcome-label';result.dataset.status=message.outcome.status;
      result.textContent=outcomeLabels[message.outcome.status]||'Результат';item.append(result);
      if(message.outcome.steps?.length) {
        const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Замысел и результат';details.append(summary);
        for(const step of message.outcome.steps) {
          const row=document.createElement('p');row.className='action-detail';
          row.textContent=`${outcomeLabels[step.status]||'Результат'} · ${intentLabels[step.intent]||'действие'}${step.target?' — '+step.target:''}. Цель: ${step.goal||'не указана'}. Способ: ${intentLabels[step.method]||step.method||'не уточнён'}. Ожидается: ${step.expectedEffect||'не уточнено'}.`;
          details.append(row);
        }item.append(details);
      }
    }
    list.append(item);
  }
  const profile = engine.profile(state.config);
  document.querySelector('#badge').textContent = '● Локально · 4.0';
  const currentNpc=state.memory.world.npcs[state.memory.world.activeNpcId];
  const title = state.memory.place || profile.title || 'Ваша история';
  document.querySelector('#story-title').textContent = title[0].toUpperCase() + title.slice(1);
  document.querySelector('#memory').textContent = `${currentNpc?.name||'Нет собеседника'} · Доверие: ${currentNpc?.trust??'—'} · Монеты: ${state.memory.world.player.money} · Вещи: ${state.memory.inventory.join(', ') || 'нет'}`;
  list.scrollTop = list.scrollHeight;
  document.querySelector('#remembered-goal').textContent = `Цель героя: ${state.memory.facts.goal || 'пока не названа'}. Цель собеседника: ${currentNpc?.motive||'рядом никого' }.`;
  const journal = document.querySelector('#journal'); journal.replaceChildren();
  for (const event of state.memory.journal.filter(e => e.kind !== 'turn').slice(-14)) {
    const row = document.createElement('li'); row.textContent = event.text; journal.append(row);
  }
  renderWorld();
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
    state.messages.push({ role: 'assistant', content: answer, outcome: { status:result.outcome.status, steps:result.results.map(r=>({status:r.status,intent:r.action.intent,target:r.action.targetLabel,goal:r.action.goal,method:r.action.method,expectedEffect:r.action.expectedEffect})) } }); status.textContent = ''; save();
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

function showPage(page) {
  for(const name of ['settings','world','chat'])document.querySelector('#'+name+'-page').hidden=name!==page;
  const focus=page==='settings'?'#close-settings':page==='world'?'#close-world':'#open-settings';document.querySelector(focus).focus();
}
function showSettings(open) { showPage(open?'settings':'chat'); }
document.querySelector('#open-settings').addEventListener('click', () => showSettings(true));
document.querySelector('#close-settings').addEventListener('click', () => showSettings(false));
document.querySelector('#open-world').addEventListener('click',()=>showPage('world'));
document.querySelector('#close-world').addEventListener('click',()=>showPage('chat'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') showPage('chat'); });
function issueCommand(command) {
  const draft=field.value;showPage('chat');field.value=command;send.click();field.value=draft;
}
function renderWorld() {
  const memory=state.memory,world=memory.world,map=engine.map(memory);
  document.querySelector('#map-title').textContent='Место: '+memory.place;
  const exits=document.querySelector('#map-exits');exits.replaceChildren();
  for(const exit of map.exits) {const b=document.createElement('button');b.type='button';b.textContent=exit.name+(exit.blocked?' · заперто':' →');b.disabled=exit.blocked;b.addEventListener('click',()=>issueCommand('Иду в '+exit.name));exits.append(b);}
  const people=document.querySelector('#nearby-people');people.replaceChildren();
  for(const person of Object.values(world.npcs).filter(n=>n.location===world.player.location)){const b=document.createElement('button');b.type='button';b.textContent=person.name;b.addEventListener('click',()=>issueCommand('Говорю с '+person.name));people.append(b);}
  const workLabels={idle:'Работа пока не выбрана',offered:'Есть предложение работы',accepted:'Работа принята',completed:'Работа завершена, можно забрать плату',paid:'За работу получена плата'};
  document.querySelector('#world-work').textContent=`${workLabels[world.loops.work.status]||'Работа'} · Монеты: ${world.player.money} · Знакомства: ${world.loops.social.contacts.length}`;
  const tasks=document.querySelector('#deferred-actions');tasks.replaceChildren();
  for(const task of world.deferred.filter(t=>t.status==='pending')){const row=document.createElement('li');const actor=world.npcs[task.actor]?.name||'Вы';const target=memory.entities.find(e=>e.id===task.targetId)?.label||'предмет';row.textContent=`${actor}: открыть «${target}» ${task.trigger==='manual'?'по отдельному сигналу':'по возвращении'}, если условия позволят.`;tasks.append(row);}
  const conflicts=document.querySelector('#relationship-records');conflicts.replaceChildren();
  const beliefs=document.querySelector('#belief-records');beliefs.replaceChildren();
  for(const n of Object.values(world.npcs)) {
    for(const g of n.grievances){const row=document.createElement('li');row.textContent=`${n.name}: ${g.reason} · ${g.resolved?'примирение состоялось':`нужны извинение${g.apology?' (получено)':''} и значимый поступок: ${g.requiredItem||n.motive}${g.reparation?' (получено)':''}`}`;conflicts.append(row);}
    for(const belief of Object.values(n.beliefs).filter(b=>!b.key.startsWith('entity:'))){const row=document.createElement('li');row.textContent=`${n.name}: ${belief.text} · уверенность ${Math.round(belief.confidence*100)}%`;beliefs.append(row);}
  }
}
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
