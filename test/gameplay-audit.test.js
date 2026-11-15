import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,E} from './rpg-fixture.mjs';
import '../story-presets.js';
test('opening describes every preset without advancing time, consuming resources or starting dialogue',()=>{
 for(const config of globalThis.StoryPresets){const m=E.restore(config,E.fresh()),before=structuredClone(m);const o=E.opening(config,m);
 assert.match(o.text,/Вы находитесь/);assert.match(o.text,/Видно:|Видимых предметов/);assert.match(o.text,/Рядом/);assert.match(o.text,/переход|Пути/);
 assert.equal(o.memory.turn,before.turn);assert.deepEqual(o.memory.world.player,before.world.player);assert.deepEqual(o.memory.world.rpg.clock,before.world.rpg.clock);assert.equal(o.memory.world.activeNpcId,before.world.activeNpcId);assert.deepEqual(m,before);
 }
});
test('suggestions exist before typing and never reveal hidden or closed-container contents',()=>{
 const f=fixture();const hidden=f.item('секретный жетон',{},f.m.place,{known:false,hidden:true});
 const box=f.item('закрытая коробка',{},f.m.place,{kind:'barrier',opened:false});const inside=f.item('скрытая монета',{},f.m.place,{containerId:box.id});
 assert.ok(E.searchActions(f.m,'').length);assert.ok(E.searchActions(f.m,'').length<=6);
 assert.equal(E.searchActions(f.m,hidden.label).length,0);assert.equal(E.searchActions(f.m,inside.label).length,0);
});
test('failed unknown intent retains a concrete obstacle and known recovery commands',()=>{
 const f=fixture();const r=f.run('Телепатически перемещаю несуществующую гору');assert.ok(['refused','clarification'].includes(r.outcome.status));assert.match(r.text,/Можно попробовать/);assert.ok(!r.results.some(v=>v.performed));assert.ok(r.messages.some(m=>m.trigger==='recovery'));
});
for(const text of ['Подхватываю палку','Прихватываю палку','Подбираю палку'])test('natural intent uses actual accessible world state: '+text,()=>{
 const f=fixture();const item=f.item('палка',{},f.m.place);f.pass(text);assert.equal(f.entity(item).location,'inventory');
});
test('concise return survey reports actual changes instead of repeating a full scene',()=>{
 const f=fixture();f.pass('Осматриваюсь');f.run('Что изменилось?');assert.match(f.last.text,/После прошлого осмотра/);assert.doesNotMatch(f.last.text,/Вы находитесь в локации/);
});
test('unfinished intent survives save and resumes without replaying the first step',()=>{
 const f=fixture();const stool=f.item('табурет',{functions:['seat'],height:.5,mass:8},f.m.place);f.run('Сажусь и осматриваюсь');assert.ok(f.m.world.player.pendingAction);f.save();f.pass('табурет');assert.equal(f.m.world.player.body.seatId,stool.id);assert.equal(f.m.world.player.pendingAction,undefined);
});
test('returning to a surveyed location exposes visible consequences without another survey',()=>{
 const f=fixture();f.run('Выхожу','Иду в город','Иду в мастерскую','Осматриваюсь','Незаметно беру молоток мастера','Иду в город','Возвращаюсь');assert.equal(f.m.place,'мастерская');assert.match(f.last.text,/После вашего отсутствия:.*молоток/);
});
test('ordinary conversation can prompt a remembered personal reply without granting secrets',()=>{
 const f=fixture();const n=f.actor();n.personality.curiosity=1;n.personality.sociability=1;n.personality.impulsivity=1;
 f.run('Привет','Меня зовут Алексей','Чай или кофе?');const pending=f.actor().conversation.pendingNpcQuestion;
 // Initiative has a cooldown; after a few everyday subjects it becomes available.
 if(!pending?.type.startsWith('everyday:'))f.run('Что любите есть?','Как отдыхаете?');
 const question=f.actor().conversation.pendingNpcQuestion;assert.ok(question?.type.startsWith('everyday:'));
 f.run('Я предпочитаю тишину');assert.equal(f.last.results[0].code,'conversation_answer_remembered');assert.ok(f.actor().memory.heardNotes.includes('Я предпочитаю тишину'));assert.equal(f.actor().secretRevealed,false);
});
