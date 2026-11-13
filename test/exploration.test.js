import test from 'node:test';
import assert from 'node:assert/strict';
import '../spatial.js';
import '../narrator.js';
import '../messages.js';
import '../dialogue.js';
import '../developer.js';
import '../social.js';
import '../conversation-topics.js';
import '../npc-personality.js';
import '../conversation-memory.js';
import '../npc-biography.js';
import '../conversation-engine.js';
import '../action-catalog.js';
import '../rpg-core.js';
import '../physical-system.js';
import '../investigation-system.js';
import '../equipment-crafting.js';
import '../action-resolver.js';
import '../goals-story.js';
import '../npc-agency.js';
import '../economy-system.js';
import '../society-system.js';
import '../life-combat.js';
import '../genre-system.js';
import '../extended-actions.js';
import '../rpg-engine.js';
import '../semantic.js';
import '../scenes.js';
import '../simulation.js';
import '../engine.js';
const E=globalThis.StoryEngine;
const config={world:'Магическая лавка воспоминаний.',character:'Мира — хозяйка лавки.',player:'Путник с компасом'};
const play=(c,...texts)=>texts.reduce((r,text)=>E.reply(c,r.memory,text),{memory:E.fresh()});
const city=()=>play(config,'Осматриваюсь','Беру письмо','Открываю письмо','Выхожу','Иду в город').memory;
const workshop=()=>E.reply(config,city(),'Иду в мастерскую').memory;
const local=(s,key)=>s.entities.find(e=>e.localKey===key&&e.location===s.place);

test('audit A1/A6: examining the city after the shop never rediscovers the shop letter',()=>{
 const r=E.reply(config,city(),'Осматриваюсь');assert.doesNotMatch(r.text,/внутренней стороне|письмо уже открывали/);assert.match(r.text,/доске объявлений/);
 const knowledge=Object.values(r.memory.world.player.research.knowledge);assert.ok(knowledge.some(k=>k.sourceId===r.memory.entities.find(e=>e.label==='запечатанное письмо').id));
});
test('audit A2/D31: workshop is a local scene, distinct from city and the main clue',()=>{
 const r=E.reply(config,workshop(),'Осмотреть мастерскую');assert.match(r.text,/верстак|механизм/);assert.doesNotMatch(r.text,/печати|запечатанное письмо/);assert.ok(local(r.memory,'mechanism'));
});
test('audit A3: inspect and explore share the same observation history',()=>{
 const m=E.reply(config,city(),'Осматриваюсь').memory;const r=E.reply(config,m,'Исследую город');assert.equal(r.results[0].code,'already_observed');assert.equal(r.outcome.information.novel,false);
});
test('audit A4/A8: a repeated look does not create a new discovery or progress',()=>{
 const first=E.reply(config,city(),'Осмотреть город');let r=first;
 for(let i=0;i<10;i++)r=E.reply(config,r.memory,'Осматриваюсь');
 assert.equal(r.memory.clocks.discovery,first.memory.clocks.discovery);assert.equal(r.memory.world.loops.exploration.discoveries.length,first.memory.world.loops.exploration.discoveries.length);assert.match(r.text,/Видно:/);assert.match(r.text,/Пути из локации:/);
});
test('audit A5: an empty room has no invented footprints, clues or mystery progress',()=>{
 const c={world:'Пустая комната. Здесь нет предметов.',character:'Лис — тихий гость',player:'Путник'};
 const r=play(c,'Осматриваюсь');assert.doesNotMatch(r.text,/следы|печать|письмо|ключ/);assert.equal(r.memory.stage,0);assert.equal(r.memory.clocks.discovery,0);assert.equal(r.memory.world.loops.exploration.discoveries.length,0);
});
test('audit A7: general room observation alone does not advance the main plot',()=>{
 const r=play(config,'Осматриваюсь');assert.equal(r.memory.stage,0);assert.equal(r.memory.clocks.discovery,0);
});
test('audit A8: reading one clue five times, including close/reopen, grants its knowledge once',()=>{
 let r=play(config,'Беру письмо','Открываю письмо');const value=r.memory.clocks.discovery;
 for(let i=0;i<5;i++)r=E.reply(config,r.memory,'Читаю письмо');
 r=E.reply(config,r.memory,'Закрываю письмо');r=E.reply(config,r.memory,'Открываю письмо');
 assert.equal(r.memory.clocks.discovery,value);assert.equal(Object.keys(r.memory.world.player.research.knowledge).filter(k=>k.startsWith('main.clue:')).length,1);
});
test('audit A9: naming a hidden object does not bypass its discovery condition',()=>{
 const m=play(config,'Выхожу').memory;const wire=local(m,'wire');assert.equal(wire.hidden,true);
 const r=E.reply(config,m,'Осматриваю моток проволоки');assert.equal(r.outcome.status,'refused');assert.equal(local(r.memory,'wire').hidden,true);assert.doesNotMatch(r.text,/короткий, но целый/);
});
test('audit A10: listening and examination produce different grounded observations',()=>{
 const listen=E.reply(config,workshop(),'Слушаю дверцу кладовой');assert.match(listen.text,/звякнуть|дребезж/);
 const examine=E.reply(config,listen.memory,'Осматриваю дверцу кладовой');assert.match(examine.text,/прикрыта|заготовки/);assert.notEqual(listen.text,examine.text);
});
test('audit B11/B12: a named remote location is not replaced by the current room',()=>{
 const r=E.reply(config,workshop(),'Исследую город');assert.equal(r.outcome.status,'refused');assert.equal(r.memory.world.loops.exploration.observed.includes(r.memory.world.locations.find(l=>l.name==='город').id),false);
});
test('audit B11: an unknown target is not guessed from the previous focus',()=>{
 const m=E.reply(config,workshop(),'Осматриваю механизм').memory;const r=E.reply(config,m,'Осматриваю хрустальный шар возле верстака');assert.equal(r.outcome.status,'clarification');assert.doesNotMatch(r.text,/шестерня смещается/);
});
test('audit B13: the bench, tools and storage have different information and sources',()=>{
 const m=workshop();const results=['Осматриваю верстак','Осматриваю инструменты','Осматриваю кладовую'].map(t=>E.reply(config,m,t));
 assert.equal(new Set(results.map(r=>r.results[0].information.sourceId)).size,3);assert.equal(new Set(results.map(r=>r.text)).size,3);
});
test('audit B14: moving an actual loose grate exposes the authored resource',()=>{
 const r=play(config,'Выхожу','Осматриваю решётку','Приподнимаю решётку','Беру проволоку');assert.ok(r.memory.inventory.includes('моток проволоки'));assert.equal(local(r.memory,'drain').moved,true);assert.equal(r.memory.stage,0);
});
test('audit B17: writing creates a real readable object that an NPC can inspect',()=>{
 const r=play(config,'Выхожу','Иду в город','Осматриваюсь','Беру бумагу','Пишу путь к мастерской','Иду в мастерскую','Показываю запись');
 const note=r.memory.entities.find(e=>e.writtenText==='путь к мастерской');assert.ok(note);assert.equal(note.location,'inventory');assert.match(r.text,/путь к мастерской/);assert.ok(Object.values(r.memory.world.npcs).find(n=>n.name==='Илья').researchKnowledge);
});
test('audit C21: entry, observation and understanding are separate states',()=>{
 const m=workshop(),id=m.world.player.location;
 assert.ok(m.world.loops.exploration.visited.includes(id));assert.ok(!m.world.loops.exploration.observed.includes(id));assert.ok(!m.world.loops.exploration.understood.includes(id));
 const observed=E.reply(config,m,'Осматриваюсь').memory;assert.ok(observed.world.loops.exploration.observed.includes(id));assert.ok(!observed.world.loops.exploration.understood.includes(id));
 const studied=E.reply(config,observed,'Осматриваю механизм').memory;assert.ok(studied.world.loops.exploration.understood.includes(id));
});
test('audit D33: noticing NPCs does not automatically create social acquaintances',()=>{
 const r=E.reply(config,workshop(),'Осматриваюсь');const person=Object.values(r.memory.world.npcs).find(n=>n.name==='Илья');assert.ok(r.memory.world.loops.social.noticed.includes(person.id));assert.ok(!r.memory.world.loops.social.contacts.includes(person.id));
});
test('audit D34/D35: a stranger does not learn the hero shop clue through a generic question',()=>{
 const m=workshop();for(const t of ['Что ты знаешь о письме?','Зачем это всё?','Расскажи об улике']){const r=E.reply(config,m,t);assert.doesNotMatch(r.text,/внутренней стороне|письмо уже открывали/);}
});
test('audit D36: custom or space settings do not receive default terrestrial townspeople',()=>{
 const r=play({world:'Орбитальная станция',character:'Система — помощник',player:'Пилот'},'Осматриваюсь');assert.ok(!Object.values(r.memory.world.npcs).some(n=>['Илья','Ника','Лея'].includes(n.name)));assert.ok(!r.memory.world.locations.some(l=>l.name==='город'));
});
test('audit D37: repeating "work" does not repair a physical mechanism',()=>{
 const r=play(config,'Выхожу','Иду в город','Иду в мастерскую','Ищу работу','Да','Работаю','Работаю');assert.equal(r.outcome.status,'clarification');assert.equal(local(r.memory,'mechanism').condition,'broken');assert.equal(r.memory.world.loops.work.status,'accepted');
});
test('audit B20: a changed physical scene yields new information on a return',()=>{
 const first=E.reply(config,workshop(),'Осматриваюсь');const moved=E.reply(config,first.memory,'Беру повреждённый механизм');
 // Fixed infrastructure is not silently looted.
 assert.equal(moved.outcome.status,'refused');
 const changed=E.reply(config,first.memory,'Ломаю механизм');const next=E.reply(config,changed.memory,'Осматриваюсь');assert.notEqual(next.text,first.text);assert.equal(next.outcome.information.novel,true);
});

test('audit A6: a custom container without authored contents never spawns a genre-specific clue',()=>{
 const c={...config,canon:'Предметы: запертый шкаф\nПреграда: запертый шкаф'};const r=play(c,'Ломаю шкаф');assert.doesNotMatch(r.text,/воспоминание|фотография|письмо|след недавнего/);
});
test('audit B16/C23/C27: a learned sign explanation enables a real route in another location',()=>{
 const r=play(config,'Выхожу','Иду в город','Изучаю знак','Иду в мастерскую','Что означает знак?','Иду в город','Иду на улицу','Осматриваю фонарь');
 const from=r.memory.world.locations.find(l=>l.name==='улица'),to=r.memory.world.locations.find(l=>l.name==='мастерская');assert.ok(r.memory.world.edges.some(e=>e.from===from.id&&e.to===to.id));assert.ok(r.memory.world.player.research.knowledge['route.guild']);assert.match(r.text,/служебный проход/);
});
test('audit B18/C25/C26/D38: thirty exploratory turns connect places, knowledge, repair, permission and trade',()=>{
 const commands=['Выхожу','Осматриваю решётку','Приподнимаю решётку','Беру проволоку','Иду в город','Изучаю знак','Иду в мастерскую','Осмотреть мастерскую','Что означает знак?','Ищу работу','Да','Осматриваю механизм','Проверяю хватает ли деталей','Изготавливаю штифт','Устанавливаю штифт','Проверяю ход механизма','Забираю плату','Иду в город','Иду на рынок','Осмотреть рынок','Показываю рекомендацию','Покупаю молоток','Иду в город','Иду на площадь','Осмотреть площадь','Иду в город','Иду на улицу','Осматриваю фонарь','Иду в мастерскую','Осмотреть мастерскую'];
 let r={memory:E.fresh()};const log=[];for(const text of commands){r=E.reply(config,r.memory,text);log.push([text,r.outcome.status,r.text]);assert.ok(!['refused','clarification'].includes(r.outcome.status),JSON.stringify(log.at(-1)));}
 assert.equal(commands.length,30);assert.equal(local(r.memory,'mechanism').condition,'repaired');assert.equal(r.memory.world.loops.work.status,'paid');assert.equal(r.memory.world.player.money,1);assert.ok(r.memory.inventory.includes('молоток'));assert.ok(r.memory.world.player.research.skills['pin-making']);assert.ok(r.memory.world.player.research.knowledge['route.guild']);assert.match(r.text,/работает собранный механизм/);assert.doesNotMatch(r.text,/повреждённый механизм|печати/);
 const noChange=E.reply(config,r.memory,'Осмотреть мастерскую');assert.equal(noChange.outcome.information.novel,false);assert.equal(noChange.results[0].code,'already_observed');
});

test('audit A10/B20: changing the observation method does not invent a changed scene',()=>{
 const m=E.reply(config,workshop(),'Осматриваюсь').memory;const r=E.reply(config,m,'Слушаю мастерскую');assert.doesNotMatch(r.text,/обстановка изменилась/);assert.match(r.text,/звякнуть|дребезж/);
});
test('audit D32: public equipment and private objects receive distinct owner reactions',()=>{
 const m=workshop();const publicLook=E.reply(config,m,'Осматриваю верстак');assert.equal(publicLook.messages.filter(m=>m.speaker.type==='npc').length,0);assert.equal(publicLook.memory.world.activeNpcId,null);
 const privateLook=E.reply(config,m,'Осматриваю личный ящик');assert.equal(privateLook.outcome.status,'refused');assert.match(privateLook.text,/личные вещи/);assert.equal(privateLook.outcome.information.discoveries.length,0);
});
test('audit C28: properties remember tested methods and key functionality learned through actual use',()=>{
 let r=play(config,'Осматриваюсь','Беру ключ','Осматриваю ключ');const key=r.memory.entities.find(e=>e.label==='серебряный ключ');
 assert.deepEqual(r.memory.world.player.research.properties[key.id].unlocks,[]);
 r=E.reply(config,r.memory,'Открываю ларец');const properties=r.memory.world.player.research.properties[key.id];assert.ok(properties.unlocks.includes(r.memory.entities.find(e=>e.label==='ларец').id));assert.ok(properties.testedMethods.includes('use'));assert.equal(properties.material,'серебро');
});

test('audit migration: a completed 4.0 repair remains physically complete after scene initialization',()=>{
 let m=workshop();const owner=Object.values(m.world.npcs).find(n=>n.name==='Илья');m.world.loops.work={type:'repair',status:'paid',employer:owner.id,progress:2,serial:1,paid:true};
 m.entities=m.entities.filter(e=>e.source!=='local-scene');delete m.world.sceneVersion;delete m.world.player.research;for(const n of m.world.locations)delete n.scene;
 const restored=E.restore(config,m);const r=E.reply(config,restored,'Осмотреть мастерскую');assert.equal(local(r.memory,'mechanism').condition,'repaired');assert.match(r.text,/работает собранный механизм/);assert.equal(r.memory.world.loops.work.status,'paid');
});

test('audit D31/C26: only an equipment owner grants its use and only a merchant grants a discount',()=>{
 const m=play(config,'Выхожу','Иду в город','Иду на площадь').memory;
 const permission=E.reply(config,m,'Можно пользоваться верстаком?');assert.deepEqual(permission.memory.world.player.permissions||{},{});
 const repaired=play(config,'Выхожу','Осматриваю решётку','Приподнимаю решётку','Беру проволоку','Иду в город','Иду в мастерскую','Ищу работу','Да','Осматриваю механизм','Проверяю хватает ли деталей','Изготавливаю штифт','Устанавливаю штифт','Проверяю ход механизма');
 const shown=E.reply(config,repaired.memory,'Показываю рекомендацию');assert.deepEqual(shown.memory.world.player.discounts||{},{});assert.match(shown.text,/продавцом на рынке/);
});

test('audit D37/D40: every new maintenance contract requires its own cleaning and calibration',()=>{
 let r=play(config,'Выхожу','Осматриваю решётку','Приподнимаю решётку','Беру проволоку','Иду в город','Иду в мастерскую','Ищу работу','Да','Осматриваю механизм','Проверяю хватает ли деталей','Изготавливаю штифт','Устанавливаю штифт','Проверяю ход механизма','Забираю плату','Ищу работу','Да','Очищаю механизм','Калибрую механизм','Забираю плату','Ищу работу','Да','Калибрую механизм');
 assert.equal(r.outcome.status,'clarification');assert.equal(r.memory.world.loops.work.status,'accepted');assert.equal(r.memory.world.player.money,6);
 r=E.reply(config,r.memory,'Устанавливаю штифт');assert.equal(r.outcome.status,'refused');assert.equal(local(r.memory,'mechanism').condition,'repaired');
});
