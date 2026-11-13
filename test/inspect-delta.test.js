import test from 'node:test';
import assert from 'node:assert/strict';
for (const f of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine']) await import('../'+f+'.js');

const E=globalThis.StoryEngine;
const config={world:'Ночной город, где воспоминания продаются в стеклянных флаконах.',character:'Мира — хозяйка лавки воспоминаний',player:'Путник с компасом',canon:'Место: лавка\nПредметы: запечатанное письмо, серебряный ключ, ларец'};
const fresh=()=>E.restore(config,E.fresh());
const step=(m,input)=>E.reply(config,m,input);
const place=m=>m.world.locations.find(v=>v.id===m.world.player.location);

test('initial inspection is anchored in the current place, not only world lore',()=>{
 const result=step(fresh(),'Осматриваюсь');
 assert.match(result.text,/место «лавка»/);
 assert.match(result.text,/запечатанное письмо/);
 assert.equal(result.results[0].code,'scene_observed');
 assert.equal(result.outcome.information.novel,true);
});

test('second inspection remains a complete scene overview without claiming progress',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const second=step(first.memory,'Осматриваюсь');
 assert.equal(second.results[0].code,'already_observed');
 assert.equal(second.outcome.information.novel,false);
 assert.doesNotMatch(second.text,/Ночной город|После прошлого осмотра/);
 assert.match(second.text,/локации «лавка»/);
 assert.match(second.text,/Видно:.*запечатанное письмо/);
 assert.match(second.text,/Рядом:.*Мира/);
 assert.match(second.text,/Пути из локации:.*улица.*сад/);
 assert.equal(second.memory.clocks.discovery,first.memory.clocks.discovery);
});

test('after taking a visible object, the inspection names what disappeared',()=>{
 let result=step(fresh(),'Осматриваюсь');
 result=step(result.memory,'Беру серебряный ключ');
 result=step(result.memory,'Осматриваюсь');
 assert.equal(result.results[0].code,'scene_observed');
 assert.equal(result.outcome.information.novel,true);
 assert.match(result.text,/серебряный ключ.*не находится на прежнем месте/);
 assert.doesNotMatch(result.text,/Ночной город|обстановка изменилась/);
 assert.match(result.text,/Видно: «запечатанное письмо», «ларец»/);
 assert.match(result.text,/Пути из локации:.*улица.*сад/);
});

test('opening a known container reports the concrete change once',()=>{
 let result=step(fresh(),'Осматриваюсь');
 result=step(result.memory,'Открываю ларец');
 const next=step(result.memory,'Осматриваюсь');
 assert.match(next.text,/Содержимое объекта «ларец» теперь доступно/);
 assert.doesNotMatch(next.text,/Ночной город/);
 assert.match(next.text,/Видно:.*ларец/);
 assert.match(next.text,/Пути из локации:.*улица/);
 const again=step(next.memory,'Осматриваюсь');
 assert.equal(again.results[0].code,'already_observed');
 assert.match(again.text,/Видно:.*ларец/);
 assert.match(again.text,/Пути из локации:.*улица/);
 assert.equal(again.outcome.information.novel,false);
});

test('newly exposed objects are listed once after a barrier breaks',()=>{
 const c={world:'Ночной город, где воспоминания продаются в стеклянных флаконах. Я прихожу в закрытую лавку за своим прошлым.',character:'Мира — хозяйка лавки',player:'Путник с компасом'};
 const baseline=E.reply(c,null,'Осматриваюсь');
 const changed=E.reply(c,baseline.memory,'Ломаю ларец, затем осмотреться');
 assert.match(changed.text,/После прошлого осмотра:/);
 assert.match(changed.text,/флакон/);
 assert.ok(changed.narrative.some(block=>block.kind==='change'));
});

test('irrelevant scene revision must not masquerade as an observable change',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const saved=structuredClone(first.memory);
 place(saved).scene.revision+=100;
 const result=step(saved,'Осматриваюсь');
 assert.equal(result.results[0].code,'already_observed');
 assert.match(result.text,/Пути из локации:/);
 assert.doesNotMatch(result.text,/После прошлого осмотра:/);
});

test('old saves without a visual snapshot do not falsely announce changes',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const saved=structuredClone(first.memory);
 delete place(saved).scene.lastSurveySnapshot;
 const result=step(saved,'Осматриваюсь');
 assert.equal(result.results[0].code,'already_observed');
 assert.equal(result.outcome.information.novel,false);
});

test('listening after an inspection is not mistaken for a changed view',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const heard=step(first.memory,'Слушаю');
 assert.doesNotMatch(heard.text,/обстановка изменилась|После прошлого осмотра/);
 const again=step(heard.memory,'Осматриваюсь');
 assert.equal(again.results[0].code,'already_observed');
});

test('scene overview follows actual connected locations after movement',()=>{
 let r=step(fresh(),'Выхожу на улицу');
 r=step(r.memory,'Осматриваюсь');
 assert.match(r.text,/локации «улица»/);
 assert.match(r.text,/Видно:.*фонарь.*решётка водостока/);
 assert.match(r.text,/Пути из локации:.*лавка.*город/);
 assert.doesNotMatch(r.text,/Пути из локации:.*мастерская/);
 r=step(r.memory,'Иду в город');
 r=step(r.memory,'Иду в мастерскую');
 r=step(r.memory,'Осматриваюсь');
 assert.match(r.text,/локации «мастерская»/);
 assert.match(r.text,/Видно:.*механизм/);
 assert.match(r.text,/Рядом:.*Илья/);
 assert.match(r.text,/Пути из локации: «город»/);
});

test('survey lists all available interactables rather than first five',()=>{
 let r=step(fresh(),'Выхожу на улицу');
 r=step(r.memory,'Иду в город');
 r=step(r.memory,'Иду в мастерскую');
 r=step(r.memory,'Осматриваюсь');
 assert.match(r.text,/молоток мастера/);
 assert.match(r.text,/ящик с инструментами/);
 assert.match(r.text,/дверца кладовой/);
 assert.match(r.text,/личный ящик мастера/);
});

test('route changes are reflected in repeated overview without inventing exits',()=>{
 let first=step(fresh(),'Осматриваюсь');
 const w=first.memory.world;
 const exit=w.edges.find(e=>e.from===w.player.location);
 const destination=w.locations.find(l=>l.id===exit.to);
 const gate=first.memory.entities.find(e=>e.kind==='barrier'&&e.location===first.memory.place);
 assert.ok(gate);
 gate.locked=true;gate.opened=false;exit.barrierId=gate.id;
 const blocked=step(first.memory,'Осматриваюсь');
 assert.match(blocked.text,/Пути из локации:.*проход закрыт/);
 assert.match(blocked.text,/После прошлого осмотра:.*закрыт/);
 gate.opened=true;
 const open=step(blocked.memory,'Осматриваюсь');
 assert.match(open.text,/Пути из локации:/);
 assert.match(open.text,/Проход в «.*» теперь открыт/);
});

test('the changed view never reveals hidden container contents prematurely',()=>{
 const c={...config,canon:'Место: лавка\nПредметы: ларец\nСодержимое ларца: флакон с воспоминанием'};
 const once=E.reply(c,null,'Осматриваюсь');
 const next=E.reply(c,once.memory,'Осматриваюсь');
 assert.doesNotMatch(once.text+/ /+next.text,/Видно:[^\n]*флакон|Теперь заметен объект «флакон/);
});
