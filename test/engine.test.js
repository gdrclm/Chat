import test from 'node:test';
import assert from 'node:assert/strict';
import '../spatial.js';
import '../narrator.js';
import '../semantic.js';
import '../scenes.js';
import '../simulation.js';
import '../engine.js';
const {fresh,reply}=globalThis.StoryEngine;
const config={world:'Космическая станция',character:'Лея — добрая механик',player:'Пилот'};
test('remembers name and goal, without mutating previous state',()=>{
 const start=fresh(); let r=reply(config,start,'Меня зовут Алекс');
 assert.equal(start.turn,0); assert.equal(r.memory.facts.name,'Алекс');
 r=reply(config,r.memory,'Хочу найти команду');
 r=reply(config,r.memory,'Помнишь меня?');
 assert.match(r.text,/Алекс/);assert.match(r.text,/найти команду/);
});
test('quest requires discovery and tool, then stays completed',()=>{
 let r=reply(config,fresh(),'Открываю шлюз'); assert.equal(r.memory.stage,0);
 r=reply(config,r.memory,'Осматриваюсь'); assert.equal(r.memory.stage,0);assert.ok(r.memory.world.loops.exploration.observed.length);
 r=reply(config,r.memory,'Беру карту'); assert.equal(r.memory.stage,2);
 assert.deepEqual(r.memory.inventory,['карта доступа']);
 r=reply(config,r.memory,'Открываю шлюз'); assert.equal(r.memory.stage,3); assert.match(r.text,/Шлюз открывается/);
 r=reply(config,r.memory,'Осматриваюсь'); assert.equal(r.memory.stage,3);
});
test('threats, apology and refusal have consequences',()=>{
 let r=reply(config,fresh(),'Ударю тебя');assert.ok(r.memory.tension>0);
 r=reply(config,r.memory,'Извини');assert.equal(r.memory.tension,1);assert.equal(r.memory.world.npcs[r.memory.world.primaryNpcId].grievances[0].resolved,false);
 r=reply(config,r.memory,'Не хочу идти');assert.equal(r.memory.lastIntent,'refuse');
});
test('genre and personality follow supplied inputs',()=>{
 const r=reply(config,fresh(),'Привет');assert.match(r.text,/Лея/);assert.match(r.text,/участие/);assert.match(r.text,/Космическая станция/);
 assert.match(reply({...config,world:'Школа'},fresh(),'Осматриваюсь').text,/записка/);
});
