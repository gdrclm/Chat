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
import '../semantic.js';
import '../scenes.js';
import '../simulation.js';
import '../engine.js';
const E=globalThis.StoryEngine;
const config={world:'Ночной город, где воспоминания продаются в стеклянных флаконах. Я прихожу в закрытую лавку за своим прошлым.',character:'Мира — хозяйка лавки.',player:'Путник с компасом'};
const fresh=()=>E.restore(config,E.fresh());
const play=(c,...commands)=>commands.reduce((r,text)=>E.reply(c,r.memory,text),{memory:E.fresh()});
const street=()=>play(config,'Выйти на улицу').memory;
const actor=(s,name='Мира')=>Object.values(s.world.npcs).find(n=>n.name===name);
const layout=s=>JSON.stringify({place:s.place,location:s.world.player.location,inventory:s.inventory,locations:s.world.locations.map(l=>[l.id,l.visits,l.scene.revision]),edges:s.world.edges,entities:s.entities.map(e=>[e.id,e.location,e.opened,e.locked,e.hidden,e.known,e.destroyed]),stage:s.stage,clocks:s.clocks,money:s.world.player.money,npcs:Object.values(s.world.npcs).map(n=>[n.id,n.location])});

const greetings=['Поприветствовать','Приветствовать','Приветствую','Поприветствую','Поприветствуй','Поприветствуйте','Поприветствовал','Поприветствовала','Поздороваться','Здороваться','Здороваюсь','Поздороваюсь','Поздоровайся','Поздоровайтесь','Поздоровался','Поздоровалась','Привет','Здравствуй','Здравствуйте','Добрый день','Добрый вечер','Доброе утро'];
for(const phrase of greetings)for(const prefix of ['','Пожалуйста, ','Сейчас '])test('GREET morphology: '+prefix+phrase,()=>{
 const m=fresh(),r=E.reply(config,m,prefix+phrase);assert.equal(r.semantic.steps[0].intent,'GREET');assert.equal(r.analysis[0].actor,'player');assert.equal(r.analysis[0].recipientId,m.world.primaryNpcId);assert.equal(r.outcome.status,'success');assert.match(r.text,/Здравствуйте|Продолжим|Снова здравствуйте/);assert.equal(layout(r.memory),layout(m));assert.equal(actor(r.memory).seen.greet,1);assert.doesNotMatch(r.text,/не распоз|не удалось|настройк|автор/);
});
for(const phrase of ['Поприветствовать Миру','Поздороваться с Мирой','Здравствуй, Мира','Приветствую Миру','Добрый вечер, Мира'])test('GREET named recipient: '+phrase,()=>{
 const r=E.reply(config,fresh(),phrase);assert.equal(r.results.length,1);assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].actor,'player');assert.equal(r.analysis[0].recipientId,r.memory.world.primaryNpcId);
});
for(const phrase of ['Мира, поздоровайся','Мира, поприветствуй меня','Прошу Миру поздороваться','Попрошу Миру поприветствовать меня','Поздоровайся, Мира','Поприветствуй меня, Мира'])test('GREET requested NPC actor: '+phrase,()=>{
 const m=fresh(),r=E.reply(config,m,phrase);const n=actor(r.memory);assert.equal(r.results.length,1);assert.equal(r.semantic.steps[0].mode,'request');assert.equal(r.analysis[0].actor,n.id);assert.equal(r.analysis[0].recipientId,'player');assert.equal(r.outcome.status,'success');assert.equal(n.seen.greet,undefined);assert.equal(n.memory.outgoingGreetings.player,1);assert.equal(n.trust,0);assert.equal(layout(r.memory),layout(m));assert.ok(r.messages.some(m=>m.speaker.type==='npc'&&m.speaker.name==='Мира'&&/Здравствуйте/.test(m.text)));
});
test('a fronted greeting recipient is not mistaken for the actor or the active interlocutor',()=>{
 const c={...config,canon:'Персонаж: Илья | лавка | изучить письмо | книга'};const m=play(c,'Говорю с Ильёй').memory;
 for(const text of ['С Мирой поздороваться','Миру поприветствовать']){const r=E.reply(c,m,text);assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].actor,'player');assert.equal(r.analysis[0].recipientId,actor(r.memory).id);assert.equal(actor(r.memory).seen.greet,1);assert.equal(actor(r.memory,'Илья').seen.greet,undefined);}
});
for(const text of ['Мира, не поздоровайся','Мира, можно поздороваться?','Мира, поздоровалась бы'])test('addressing an NPC preserves a nonexecuting nested mode: '+text,()=>{
 const m=fresh(),r=E.reply(config,m,text);assert.equal(layout(r.memory),layout(m));assert.equal(actor(r.memory).memory.outgoingGreetings,undefined);assert.equal(actor(r.memory).seen.greet,undefined);assert.equal(r.results[0].performed,false);
});
test('GREET resolves the requested actor independently of an already selected recipient',()=>{
 const c={...config,canon:'Персонаж: Илья | лавка | изучить письмо | книга'};
 const m=play(c,'Говорю с Ильёй').memory;const r=E.reply(c,m,'Мира, поприветствуй Илью');const mira=actor(r.memory),ilya=actor(r.memory,'Илья');assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].actor,mira.id);assert.equal(r.analysis[0].recipientId,ilya.id);assert.equal(mira.memory.outgoingGreetings[ilya.id],1);assert.equal(mira.seen.greet,undefined);assert.equal(ilya.seen.greet,undefined);
});
test('GREET repetitions do not farm trust or borrow another NPC reaction counter',()=>{
 const c={...config,canon:'Персонаж: Илья | лавка | изучить письмо | книга'};let r=play(c,...Array(10).fill('Поздороваться с Мирой'));assert.equal(actor(r.memory).trust,1);assert.equal(actor(r.memory).seen.greet,10);r=E.reply(c,r.memory,'Поприветствовать Илью');assert.equal(actor(r.memory,'Илья').trust,1);assert.equal(actor(r.memory,'Илья').seen.greet,1);assert.equal(actor(r.memory).seen.greet,10);
});
test('GREET does not erase a conflict or grant cooperation by repetition',()=>{
 const m=play(config,'Ты идиот').memory;const r=E.reply(config,m,'Поздороваться');assert.equal(actor(r.memory).trust,actor(m).trust);assert.ok(actor(r.memory).grievances.some(g=>!g.resolved));assert.match(r.text,/ссор/);
});
for(const phrase of ['Поздороваться','Поприветствовать Миру','Мира, поздоровайся'])test('GREET requires co-location: '+phrase,()=>{
 const m=street(),r=E.reply(config,m,phrase);assert.equal(r.outcome.status,'refused');assert.equal(layout(r.memory),layout(m));assert.equal(actor(r.memory).seen.greet,undefined);
});
for(const phrase of ['Хочу поздороваться','Можно поприветствовать Миру?','Не буду здороваться','Я поздоровался бы','Мира здоровается'])test('GREET nonexecuting modes: '+phrase,()=>{
 const m=fresh(),r=E.reply(config,m,phrase);assert.equal(layout(r.memory),layout(m));assert.equal(actor(r.memory).seen.greet,undefined);assert.equal(actor(r.memory).trust,0);assert.equal(r.results[0].performed,false);
});

const approaches=['Подойти к стене','Подхожу к стене','Подойду к стене','Подойди к стене','Подойдите к стене','Подошёл к стене','Подошла к стене','Подходить к стене','Приблизиться к стене','Приближаюсь к стене','Приближусь к стене','Приблизься к стене','Иду к стене','Пойду к стене','Направляюсь к стене'];
for(const phrase of approaches)test('APPROACH local frame: '+phrase,()=>{
 const m=fresh(),r=E.reply(config,m,phrase);assert.equal(r.semantic.steps[0].intent,'APPROACH');assert.equal(r.analysis[0].scope,'local');assert.equal(r.outcome.status,'success');assert.equal(layout(r.memory),layout(m));assert.equal(r.memory.world.player.position.locationId,m.world.player.location);assert.equal(r.memory.world.player.attention.part,'wall');assert.equal(r.memory.world.player.attention.parentId,m.world.startId);assert.equal(r.memory.entities.length,m.entities.length);assert.equal(r.memory.world.locations.length,m.world.locations.length);assert.doesNotMatch(r.text,/Вы переходите|Куда идти|обстановка изменилась/);
});
for(const suffix of ['изучить','изучать','внимательно осмотреть её','осмотреть его','рассмотреть','исследовать'])test('APPROACH inherits a feature target: '+suffix,()=>{
 const m=street(),r=E.reply(config,m,'Подойти к стене лавки и '+suffix);assert.equal(r.results.length,2);assert.ok(r.results.every(r=>r.status==='success'));assert.equal(layout(r.memory),layout(m));const first=r.analysis[0].semantic.targetRef,second=r.analysis[1].semantic.targetRef;assert.equal(first.id,second.id);assert.equal(second.surface,'exterior');assert.equal(r.memory.place,'улица');assert.doesNotMatch(r.text,/Вы переходите|Место: лавка|письмо уже открывали|печати|обстановка изменилась/);
});
test('a facade is a wall of the shop, not an alias of the shop location',()=>{
 const m=street(),plan=E.resolve(config,m,'Подойти к стене лавки и изучить');assert.equal(plan.steps[0].target,'стена');assert.equal(plan.steps[0].parent,'лавки');assert.equal(plan.steps[0].relation,'part_of');assert.equal(plan.steps[0].scope,'local');const r=E.reply(config,m,'Подойти к стене лавки');assert.equal(r.analysis[0].semantic.targetRef.parentId,m.world.startId);assert.equal(r.memory.place,'улица');
});
test('a subsequent explicit entry remains an actual graph transition',()=>{
 const m=play(config,'Выйти','Подойти к стене лавки').memory,r=E.reply(config,m,'Войти в лавку');assert.equal(r.memory.place,'лавка');assert.equal(r.analysis[0].semantic.intent,'MOVE');assert.equal(r.analysis[0].semantic.scope,'world');assert.equal(r.memory.world.player.position,undefined);assert.equal(r.memory.world.player.attention,undefined);
});
test('APPROACH a real lamp selects the lamp and its existing clue without a graph transition',()=>{
 const m=street(),r=E.reply(config,m,'Подойти к фонарю и осмотреть его');const lamp=r.memory.entities.find(e=>e.localKey==='lamp');assert.ok(r.results.every(r=>r.status==='success'));assert.equal(r.memory.place,'улица');assert.equal(r.analysis[0].targetId,lamp.id);assert.equal(r.analysis[1].targetId,lamp.id);assert.equal(r.memory.world.player.research.knowledge['street.mark'].sourceId,lamp.id);assert.equal(r.memory.world.locations.find(l=>l.id===m.world.player.location).visits,m.world.locations.find(l=>l.id===m.world.player.location).visits);assert.doesNotMatch(r.text,/Вы переходите/);
});
test('APPROACH cannot reveal or reach a hidden object by naming it',()=>{
 const m=street(),r=E.reply(config,m,'Подойти к мотку проволоки и изучить');assert.equal(r.results[0].status,'refused');assert.equal(r.results[1].skipped,true);assert.equal(layout(r.memory),layout(m));
});
test('APPROACH a remote workshop tool does not move the player there',()=>{
 const m=street(),r=E.reply(config,m,'Подойти к верстаку и изучить');assert.equal(r.results[0].status,'refused');assert.equal(r.results[1].skipped,true);assert.equal(layout(r.memory),layout(m));
});
for(const phrase of ['Подойти к стене лунной башни','Иду к стене неизвестной лавки','Подойти к хрустальному глобусу'])test('unknown local targets do not become a location: '+phrase,()=>{
 const m=street(),r=E.reply(config,m,phrase);assert.ok(['refused','clarification'].includes(r.outcome.status));assert.equal(layout(r.memory),layout(m));assert.doesNotMatch(r.text,/Вы переходите/);
});
test('a missing owner clarification preserves the part and dependent observation',()=>{
 let r=E.reply(config,street(),'Подойти к стене лунной башни и изучить');assert.equal(r.memory.world.player.pendingAction.slot,'parent');r=E.reply(config,JSON.parse(JSON.stringify(r.memory)),'лавки');assert.equal(r.outcome.status,'success');assert.equal(r.memory.place,'улица');assert.equal(r.analysis[0].semantic.targetRef.id,r.analysis[1].semantic.targetRef.id);
});
test('a position change does not change the room fingerprint or produce a physical-change announcement',()=>{
 const first=play(config,'Осмотреться');const m=first.memory;const loc=m.world.locations.find(l=>l.id===m.world.player.location);let r=E.reply(config,m,'Подойти к стене и изучить');assert.equal(r.memory.world.locations.find(l=>l.id===loc.id).scene.lastObservedState,loc.scene.lastObservedState);r=E.reply(config,r.memory,'Оглядеться');assert.equal(r.results[0].code,'already_observed');assert.doesNotMatch(r.text,/обстановка изменилась/);assert.equal(r.memory.clocks.discovery,0);
});
test('repeating a local approach and observation does not farm discoveries or events',()=>{
 let r=play(config,'Подойти к стене и изучить');const approaches=r.memory.world.events.filter(e=>e.type==='local_approach').length;
 for(let i=0;i<8;i++)r=E.reply(config,r.memory,'Подойти к стене и изучить');assert.equal(r.memory.world.events.filter(e=>e.type==='local_approach').length,approaches);assert.equal(r.memory.world.loops.exploration.discoveries.length,0);assert.equal(r.memory.clocks.discovery,0);assert.equal(r.memory.stage,0);assert.equal(r.results[1].information.novel,false);assert.ok(r.text.length<450);
});
test('a saved local focus is restored and can be inspected after reload',()=>{
 const m=play(config,'Выйти','Подойти к стене лавки').memory;const loaded=E.restore(config,JSON.parse(JSON.stringify(m))),r=E.reply(config,loaded,'Изучить');assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].semantic.targetRef.id,m.world.player.attention.id);assert.equal(r.memory.place,'улица');
});
test('a requested NPC approach changes that NPC position, not the player position',()=>{
 const m=fresh(),r=E.reply(config,m,'Мира, подойди к стене');assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].actor,m.world.primaryNpcId);assert.equal(r.memory.world.player.position,undefined);assert.ok(actor(r.memory).position);assert.equal(layout(r.memory),layout(m));
});

const furnished={world:'Комната в лавке. Я вхожу в лавку.',character:'Мира — сторож.',player:'Гость',canon:'Место: лавка\nПредметы: сундук, дверь, стол, шкаф, окно, лестница\nЛокации: лавка, улица\nПереходы: лавка <-> улица'};
for(const [phrase,part,parent]of [['крышке сундука','lid','сундук'],['ручке двери','handle','дверь'],['ручке шкафа','handle','шкаф'],['ножке стола','leg','стол'],['поверхности окна','surface','окно'],['поверхности лестницы','surface','лестница']])test('part ownership: '+phrase,()=>{
 const m=E.restore(furnished,E.fresh()),r=E.reply(furnished,m,'Подойти к '+phrase+' и изучить');assert.equal(r.outcome.status,'success');assert.equal(layout(r.memory),layout(m));const ref=r.analysis[1].semantic.targetRef;assert.equal(ref.part,part);assert.equal(ref.parentId,m.entities.find(e=>e.label===parent).id);assert.equal(r.memory.entities.length,m.entities.length);assert.equal(r.memory.world.locations.length,m.world.locations.length);assert.doesNotMatch(r.text,/Вы переходите|письмо|печати|флакон/);
});
test('a lid is an actionable part of its own container, including a following pronoun',()=>{
 const r=play(furnished,'Подойти к крышке сундука и открыть её');assert.equal(r.outcome.status,'success');assert.equal(r.memory.entities.find(e=>e.label==='сундук').opened,true);assert.equal(r.memory.entities.find(e=>e.label==='шкаф').opened,false);assert.equal(r.memory.place,'лавка');
});
test('a real authored wall keeps its authored description instead of using a generic feature',()=>{
 const c={...furnished,canon:furnished.canon+'\nПредметы: каменная стена'};const m=E.restore(c,E.fresh());const wall=m.entities.find(e=>e.label==='каменная стена');wall.description='На камне высечена схема вентиляции.';const r=E.reply(c,m,'Подойти к стене и изучить');assert.equal(r.outcome.status,'success');assert.match(r.text,/схема вентиляции/);assert.equal(r.analysis[1].targetId,wall.id);
});
test('a wall mentioned as the hero starting position is not a carried possession',()=>{
 const c={...config,player:'Путник у стены с компасом'};const m=E.restore(c,E.fresh());assert.deepEqual(m.inventory,['компас']);assert.ok(!m.entities.some(e=>e.label==='стена'&&e.location==='inventory'));assert.equal(E.reply(c,m,'Подойти к стене').outcome.status,'success');
});
test('a part of an absent object cannot be borrowed from a similarly named location',()=>{
 const m=street(),r=E.reply(config,m,'Подойти к ручке двери несуществующего дома и изучить');assert.ok(['refused','clarification'].includes(r.results[0].status));assert.equal(r.results[1].skipped,true);assert.equal(layout(r.memory),layout(m));
});

test('move and survey compose exactly one location description while preserving both action results',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу и осмотреться'),id=r.memory.world.player.location;assert.equal(r.results.length,2);assert.ok(r.results.every(r=>r.status==='success'));assert.equal(r.narrative.filter(b=>b.kind==='location'&&b.locationId===id).length,1);assert.equal((r.text.match(/Узкая улица соединяет/g)||[]).length,1);assert.equal((r.text.match(/Видно:/g)||[]).length,1);
});
test('a named-location survey also replaces the preceding arrival description',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу и осмотреть улицу');assert.equal((r.text.match(/Узкая улица соединяет/g)||[]).length,1);assert.equal(r.narrative.filter(block=>block.kind==='location').length,1);
});
test('a single move retains its entry description when no following survey supplies it',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу');assert.equal((r.text.match(/Узкая улица соединяет/g)||[]).length,1);assert.ok(r.narrative.some(b=>b.kind==='location'&&b.phase==='arrival'));
});
test('a blocked observation does not suppress a successful entry description',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу и осмотреть ларец');assert.equal(r.results[1].status,'refused');assert.match(r.text,/Узкая улица соединяет/);
});
test('newly revealed objects survive composition after a transition',()=>{
 const r=play(config,'Выйти','Иду в город и осматриваюсь');assert.equal((r.text.match(/У городского перекрёстка/g)||[]).length,1);assert.match(r.text,/чистый лист бумаги/);assert.ok(r.narrative.some(b=>b.kind==='findings'));assert.ok(r.memory.entities.find(e=>e.localKey==='sheet').known);
});
test('a repeat visit does not replay the author first-person introduction or create a scene event',()=>{
 const first=play(config,'Осмотреться','Выйти');const before=first.memory.world.events.filter(e=>e.type==='knowledge_learned').length;
 const r=E.reply(config,first.memory,'Вернуться в лавку');assert.equal(r.memory.place,'лавка');assert.doesNotMatch(r.text,/Я прихожу|за своим прошлым/);assert.equal(r.memory.world.events.filter(e=>e.type==='knowledge_learned').length,before);assert.equal(r.memory.stage,first.memory.stage);
});
test('a physical destruction still refreshes the scene and is not hidden by narrative deduplication',()=>{
 const m=play(config,'Осмотреться').memory;const r=E.reply(config,m,'Ломаю ларец, затем осмотреться');assert.ok(r.memory.entities.find(e=>e.label==='ларец').destroyed);assert.match(r.text,/обстановка изменилась/);assert.match(r.text,/флакон/);assert.ok(r.narrative.some(b=>b.kind==='change'));
});
test('two observations separated by a physical action retain their distinct results',()=>{
 const r=E.reply(config,fresh(),'Осмотреться, затем ломаю ларец, затем осмотреться');assert.equal(r.results.length,3);assert.equal(r.results[0].status,'success');assert.equal(r.results[1].status,'partial_success');assert.equal(r.results[1].completed,true);assert.equal(r.results[2].status,'success');assert.ok(r.narrative.some(b=>b.kind==='change'));assert.match(r.text,/флакон/);
});
test('migration separates an old first-person scene description without resetting played state',()=>{
 const m=play(config,'Поприветствовать Миру','Выйти','Подойти к стене лавки').memory;delete m.world.spatialVersion;for(const loc of m.world.locations){delete loc.scene.background;if(loc.id===m.world.startId)loc.scene.description=config.world;}
 const restored=E.restore(config,JSON.parse(JSON.stringify(m)));assert.equal(restored.place,m.place);assert.equal(actor(restored).trust,actor(m).trust);assert.deepEqual(restored.inventory,m.inventory);assert.doesNotMatch(restored.world.locations.find(l=>l.id===restored.world.startId).scene.description,/Я прихожу/);assert.equal(E.reply(config,restored,'Изучить').outcome.status,'success');
});
