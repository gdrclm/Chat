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

test('second inspection without changes does not repeat scene or claim progress',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const second=step(first.memory,'Осматриваюсь');
 assert.equal(second.results[0].code,'already_observed');
 assert.equal(second.outcome.information.novel,false);
 assert.doesNotMatch(second.text,/Ночной город|С прошлого осмотра обстановка изменилась/);
 assert.equal(second.memory.clocks.discovery,first.memory.clocks.discovery);
});

test('after taking a visible object, the inspection names what disappeared',()=>{
 let result=step(fresh(),'Осматриваюсь');
 result=step(result.memory,'Беру серебряный ключ');
 result=step(result.memory,'Осматриваюсь');
 assert.equal(result.results[0].code,'scene_observed');
 assert.equal(result.outcome.information.novel,true);
 assert.match(result.text,/серебряный ключ.*не находится на прежнем месте/);
 assert.doesNotMatch(result.text,/Ночной город|Видно:|обстановка изменилась/);
});

test('opening a known container reports the concrete change once',()=>{
 let result=step(fresh(),'Осматриваюсь');
 result=step(result.memory,'Открываю ларец');
 const next=step(result.memory,'Осматриваюсь');
 assert.match(next.text,/Содержимое объекта «ларец» теперь доступно/);
 assert.doesNotMatch(next.text,/Ночной город|Видно:/);
 const again=step(next.memory,'Осматриваюсь');
 assert.equal(again.results[0].code,'already_observed');
 assert.equal(again.outcome.information.novel,false);
});

test('irrelevant scene revision must not masquerade as an observable change',()=>{
 const first=step(fresh(),'Осматриваюсь');
 const saved=structuredClone(first.memory);
 place(saved).scene.revision+=100;
 const result=step(saved,'Осматриваюсь');
 assert.equal(result.results[0].code,'already_observed');
 assert.doesNotMatch(result.text,/изменил/);
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

test('the changed view never reveals hidden container contents prematurely',()=>{
 const c={...config,canon:'Место: лавка\nПредметы: ларец\nСодержимое ларца: флакон с воспоминанием'};
 const once=E.reply(c,null,'Осматриваюсь');
 const next=E.reply(c,once.memory,'Осматриваюсь');
 assert.doesNotMatch(once.text+/ /+next.text,/Видно:[^\n]*флакон|Теперь заметен объект «флакон/);
});
