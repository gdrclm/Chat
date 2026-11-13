import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const f of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine'])await import('../'+f+'.js');

const E=globalThis.StoryEngine;
const config={world:'Город. В лавке продают воспоминания в стеклянных флаконах.',character:'Мира — хозяйка лавки воспоминаний. Сдержанная и наблюдательная, с сухим юмором.',player:'Путник',canon:''};
const fresh=()=>E.restore(config,E.fresh());
const step=(m,text)=>E.reply(config,m,text);
const view=(m,q)=>E.searchActions(m,q,6);

test('large static action catalog is absent from the player UI',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="actions-page"|id="action-catalog"|id="suggested-actions"|id="conversation-topics"/);
  assert.match(html,/id="command-suggestions"/);
  assert.match(html,/aria-autocomplete="list"/);
});

test('search returns context-only actions, without altering the game world',()=>{
  const m=fresh(),before=JSON.stringify(m);
  assert.ok(view(m,'откры').some(o=>o.kind==='open'&&/ларец/.test(o.command)));
  assert.equal(view(m,'несуществующий предмет').length,0);
  assert.equal(view(m,'Мира').length,0,'undiscovered characters must not be exposed');
  assert.equal(JSON.stringify(m),before,'search must be read-only');
});

test('a discovered character can be addressed by name alone',()=>{
  const m=step(fresh(),'Осматриваюсь').memory;
  assert.ok(view(m,'Мира').some(o=>o.command==='Говорю с Мира'));
  const turn=step(m,'Мира');
  assert.equal(turn.semantic.steps[0].raw,'Говорю с Мира');
  assert.equal(turn.results[0].code,'npc_selected');
});

test('known nouns expand to safe examination instead of physical interaction',()=>{
  let m=step(fresh(),'Выхожу на улицу').memory;
  m=step(m,'Осматриваюсь').memory;
  assert.ok(view(m,'фонарь').some(o=>o.kind==='inspect'&&/фонарь/.test(o.label)));
  const result=step(m,'фонарь');
  assert.equal(result.semantic.steps[0].intent,'INSPECT');
  assert.match(result.semantic.steps[0].raw,/Осматриваю уличный фонарь/);
  assert.equal(result.results[0].code,'object_studied');
  assert.ok(view(result.memory,'откры').every(o=>!/ларец/.test(o.command)),'remote objects should not appear');
});

test('a single location name selects a known route',()=>{
  const m=step(fresh(),'Выхожу на улицу').memory;
  assert.equal(E.resolve(config,m,'город').steps[0].intent,'MOVE');
  assert.match(E.resolve(config,m,'город').steps[0].raw,/Иду в город/);
});

test('a single conversational keyword expands only when it identifies one topic',()=>{
  let m=step(fresh(),'Осматриваюсь').memory;
  m=step(m,'Мира').memory;
  assert.equal(E.resolve(config,m,'кофе').steps[0].raw,'Что пьёте по утрам?');
  assert.equal(E.resolve(config,m,'музыка').steps[0].raw,'Какая музыка вам нравится?');
});

test('work keyword is expanded but plans, questions and negations keep their meaning',()=>{
  const m=fresh();
  assert.equal(E.resolve(config,m,'работа').steps[0].raw,'Ищу работу');
  assert.equal(E.resolve(config,m,'Можно открыть ларец?').steps[0].mode,'question');
  assert.equal(E.resolve(config,m,'Не открываю ларец').steps[0].mode,'negated');
  assert.equal(E.resolve(config,m,'Хочу открыть ларец').steps[0].mode,'intention');
});

test('results are bounded and always include complete draft commands',()=>{
  const m=step(fresh(),'Осматриваюсь').memory;
  const options=view(m,'спросить');
  assert.ok(options.length<=6);
  for(const o of options){assert.equal(typeof o.command,'string');assert.ok(o.command.length>1);assert.ok(o.label);}
});
