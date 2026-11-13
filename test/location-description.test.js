import test from 'node:test';
import assert from 'node:assert/strict';
for(const file of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine']) await import('../'+file+'.js');

const E=globalThis.StoryEngine;
const config={world:'Ночной город, где воспоминания продаются в стеклянных флаконах. Я прихожу в закрытую лавку за прошлым.',character:'Мира — хозяйка лавки.',player:'Путник с компасом'};
const root=s=>s.world.locations.find(place=>place.id===s.world.startId);
const go=(memory,command,cfg=config)=>E.reply(cfg,memory,command);

test('location description describes the shop, never the world premise',()=>{
 const first=go(null,'Осматриваюсь');
 assert.match(first.text,/Внутри лавки полумрак и теснота/);
 assert.doesNotMatch(root(first.memory).scene.description,/Ночной город|Я прихожу/);
 const repeated=go(first.memory,'Осматриваюсь');
 assert.equal(repeated.results[0].code,'already_observed');
 assert.match(repeated.text,/Внутри лавки полумрак и теснота/);
 assert.doesNotMatch(repeated.text,/Ночной город|Я прихожу/);
});

test('nearby local scenes have distinct descriptions including the garden',()=>{
 const initial=go(null,'Осматриваюсь');
 const outdoors=go(initial.memory,'Иду на улицу');
 const outside=go(outdoors.memory,'Осматриваюсь');
 assert.match(outside.text,/Узкая улица соединяет лавку с городом/);
 assert.doesNotMatch(outside.text,/Внутри лавки полумрак/);
 const city=go(outside.memory,'Иду в город');
 const cityLook=go(city.memory,'Осматриваюсь');
 assert.match(cityLook.text,/У городского перекрёстка/);
 assert.doesNotMatch(cityLook.text,/Ночной город, где воспоминания/);
 const garden=go(go(cityLook.memory,'Иду в улицу').memory,'Иду в лавку'); // Return through actual street.
 const gardenArrival=go(garden.memory,'Иду в сад');
 const gardenLook=go(gardenArrival.memory,'Осматриваюсь');
 assert.match(gardenLook.text,/Сад отделён от зданий/);
 assert.doesNotMatch(gardenLook.text,/У городского перекрёстка|Внутри лавки полумрак/);
});

test('author may set independent description per location',()=>{
 const c={...config,canon:'Описание локации: лавка | В воздухе пахнет сургучом. Прилавок освещён свечой.\nОписание локации: сад | Над дорожкой висит лёгкий туман.'};
 let r=go(null,'Осматриваюсь',c);
 assert.match(r.text,/В воздухе пахнет сургучом/);
 assert.doesNotMatch(r.text,/Над дорожкой висит лёгкий туман/);
 r=go(r.memory,'Иду в сад',c);
 r=go(r.memory,'Осматриваюсь',c);
 assert.match(r.text,/Над дорожкой висит лёгкий туман/);
 assert.doesNotMatch(r.text,/В воздухе пахнет сургучом/);
});

test('old saved world description is migrated without resetting gameplay progress',()=>{
 const first=go(null,'Осматриваюсь');
 const saved=structuredClone(first.memory);
 const before=saved.turn;
 root(saved).scene.description=config.world;
 root(saved).scene.descriptionSource=undefined;
 const restored=E.restore(config,saved);
 assert.match(root(restored).scene.description,/Внутри лавки/);
 assert.doesNotMatch(root(restored).scene.description,/Ночной город/);
 assert.equal(restored.turn,before);
 assert.deepEqual(restored.world.loops.exploration.visited,saved.world.loops.exploration.visited);
});

test('first-person cleaned legacy introduction is not a local scene',()=>{
 const memory=go(null,'Осматриваюсь').memory;
 root(memory).scene.description=globalThis.StoryNarrator.locationDescription(config.world,'лавка');
 root(memory).scene.descriptionSource=undefined;
 const restored=E.restore(config,memory);
 assert.match(root(restored).scene.description,/Внутри лавки/);
 assert.doesNotMatch(root(restored).scene.description,/Ночной город/);
});

test('non-inherited custom room text is preserved on reload',()=>{
 const state=go(null,'Осматриваюсь').memory;
 root(state).scene.description='Старая древесина едва слышно поскрипывает.';
 root(state).scene.descriptionSource='author';
 const loaded=E.restore(config,state);
 assert.equal(root(loaded).scene.description,'Старая древесина едва слышно поскрипывает.');
});

test('preset starting places never reuse general world premise',()=>{
 for(const preset of globalThis.StoryPresets){
   const result=go(null,'Осматриваюсь',preset);
   const local=root(result.memory).scene.description;
   assert.notEqual(local,preset.world);
   assert.doesNotMatch(local,/^Место: /);
   assert.ok(local.length>25);
 }
});
