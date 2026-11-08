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

const E=globalThis.StoryEngine,S=globalThis.StorySemantic;
const config={world:'Ночной город, где воспоминания продаются в стеклянных флаконах. Я прихожу в лавку.',character:'Мира — хозяйка лавки.',player:'Путник с компасом'};
const fresh=()=>E.restore(config,E.fresh());
const ctx=S.context(fresh());
const play=(c,...commands)=>commands.reduce((r,text)=>E.reply(c,r.memory,text),{memory:E.fresh()});
const find=(m,label)=>m.entities.find(e=>e.label===label);
const physical=m=>JSON.stringify({place:m.place,inventory:m.inventory,entities:m.entities.map(e=>[e.id,e.location,e.opened,e.locked,e.destroyed,e.containerId]),stage:m.stage,clocks:m.clocks,money:m.world.player.money});

// Independent, hand-written language fixtures. Expectations do not come from the resolver's dictionary.
const paraphrases={
 MOVE:[
  'Выйти на улицу','Выхожу на улицу','Выйду на улицу','Вышел на улицу','Вышла на улицу',
  'Идти на улицу','Иду на улицу','Пойти на улицу','Пойду на улицу','Пойдем на улицу',
  'Направиться на улицу','Направляюсь на улицу','Направлюсь на улицу','Отправиться на улицу','Отправляюсь на улицу',
  'Отправлюсь на улицу','Перейти на улицу','Перехожу на улицу','Перейду на улицу','Пройти на улицу'
 ],
 INSPECT:[
  'Осмотреться','Осматриваюсь','Осмотрюсь','Оглядеться','Оглядываюсь','Огляжусь','Озираюсь','Оглянуться',
  'Посмотреть вокруг','Смотрю вокруг','Посмотрю вокруг','Поглядеть вокруг','Глянуть вокруг',
  'Изучить обстановку','Изучаю обстановку','Исследовать помещение','Исследую помещение',
  'Осмотреть помещение','Осматриваю комнату','Оглядеть место'
 ],
 TAKE:[
  'Взять ключ','Беру ключ','Возьму ключ','Возьми ключ','Взял ключ','Взяла ключ',
  'Забрать ключ','Забираю ключ','Заберу ключ','Забрал ключ','Подобрать ключ','Подбираю ключ',
  'Подберу ключ','Поднять ключ','Поднимаю ключ','Достать ключ','Достаю ключ','Вытащить ключ','Вытаскиваю ключ','Прихватить ключ'
 ],
 OPEN:[
  'Открыть ларец','Открываю ларец','Открою ларец','Открой ларец','Открыл ларец','Открыла ларец',
  'Отпереть ларец','Отпираю ларец','Отопру ларец','Отпер ларец',
  'Распахнуть ларец','Распахиваю ларец','Распахну ларец','Распахнул ларец',
  'Приоткрыть ларец','Приоткрываю ларец','Приоткрою ларец','Приоткрыла ларец',
  'Снять крышку с ларца','Снимаю крышку с ларца'
 ],
 USE:[
  'Использовать компас','Использую компас','Использовал компас','Использовала компас',
  'Применить компас','Применяю компас','Применю компас','Применил компас','Применила компас',
  'Воспользоваться компасом','Пользуюсь компасом','Воспользуюсь компасом','Воспользовался компасом','Воспользовалась компасом',
  'Задействовать компас','Задействую компас','Задействовал компас','Задействовала компас',
  'Применить этот компас','Использовать мой компас'
 ],
 TALK:[
  'Поговорить с Мирой','Говорю с Мирой','Поговорю с Мирой','Поговорил с Мирой','Поговорила с Мирой',
  'Побеседовать с Мирой','Беседую с Мирой','Побеседую с Мирой','Побеседовал с Мирой','Побеседовала с Мирой',
  'Пообщаться с Мирой','Общаюсь с Мирой','Пообщаюсь с Мирой','Поболтать с Мирой','Болтаю с Мирой','Поболтаю с Мирой',
  'Обратиться к Мире','Обращаюсь к Мире','Обращусь к Мире','Завести разговор с Мирой'
 ],
 SEARCH:[
  'Обыскать ларец','Обыскиваю ларец','Обыщу ларец','Обыскал ларец','Обыскала ларец',
  'Поискать в ларце','Ищу в ларце','Поищу в ларце','Искал в ларце','Искала в ларце',
  'Обшарить ларец','Обшариваю ларец','Обшарю ларец','Заглянуть внутрь ларца','Заглядываю внутрь ларца',
  'Загляну внутрь ларца','Заглянул внутрь ларца','Заглянула внутрь ларца',
  'Проверить содержимое ларца','Проверяю содержимое ларца'
 ],
 GIVE:[
  'Отдать компас','Отдаю компас','Отдам компас','Отдал компас','Отдала компас',
  'Передать компас','Передаю компас','Передам компас','Передал компас','Передала компас',
  'Вручить компас','Вручаю компас','Вручу компас','Вручил компас','Вручила компас',
  'Подарить компас','Дарю компас','Подарю компас','Подарил компас','Подарила компас'
 ],
 REPAIR:[
  'Починить механизм','Чиню механизм','Починю механизм','Починил механизм','Починила механизм','Чинить механизм',
  'Отремонтировать механизм','Ремонтирую механизм','Отремонтирую механизм','Отремонтировал механизм','Отремонтировала механизм',
  'Исправить механизм','Исправляю механизм','Исправлю механизм','Исправил механизм','Исправила механизм',
  'Восстановить работоспособность механизма','Восстанавливаю работоспособность механизма',
  'Восстановлю работоспособность механизма','Восстановил работоспособность механизма'
 ]
};
const wrappers=[s=>s,s=>'Пожалуйста, '+s.toLowerCase(),s=>'Сейчас '+s.toLowerCase(),s=>'Осторожно '+s.toLowerCase()];
for(const [intent,phrases]of Object.entries(paraphrases))for(const phrase of phrases)for(const wrap of wrappers){
 const input=wrap(phrase);
 test('equivalence '+intent+': '+input,()=>{
  const plan=S.resolve(input,ctx);assert.equal(plan.steps.length,1,input);const action=S.bind(plan.steps[0],ctx.memory);
  assert.equal(action.intent,intent,input);assert.equal(action.mode,'execute',input);assert.equal(action.dependsOnPrevious,false);
  if(intent==='MOVE')assert.equal(action.destinationId,ctx.memory.world.outdoorId,input);
  else if(intent==='INSPECT'){assert.equal(action.target,'current_location');assert.equal(action.method,'survey');}
  else if(intent==='TALK')assert.equal(action.recipientId,ctx.memory.world.primaryNpcId,input);
  else assert.ok(action.targetId,input+': missing concrete target');
 });
}

const locked={world:'Комната с дверью. Магии нет.',character:'Мира — путешественница.',player:'Гость',canon:'Место: комната\nПредметы: ключ, дверь, письмо, стол\nПреграда: дверь\nИнструмент: ключ\nЛокации: комната, улица, город\nПереходы: комната <-> улица [дверь]; улица <-> город'};
const available=E.restore(locked,E.fresh());
const openForms=['Открыть дверь','Открываю дверь','Открою дверь','Открой дверь','Открыл дверь','Открыла дверь'];
const moveForms=paraphrases.MOVE;
const takeForms=paraphrases.TAKE.filter(t=>!/^Доста|^Вытащ|^Вытаски/.test(t));
for(const text of moveForms)test('world equivalence MOVE: '+text,()=>{const r=E.reply(config,fresh(),text);assert.equal(r.outcome.status,'success');assert.equal(r.memory.place,'улица');});
for(const text of takeForms)test('world equivalence TAKE: '+text,()=>{const r=E.reply(locked,available,text);assert.equal(r.outcome.status,'success');assert.deepEqual(r.memory.inventory,['ключ']);});
for(const text of openForms)test('world equivalence OPEN: '+text,()=>{const m=E.reply(locked,available,'Взять ключ').memory;const r=E.reply(locked,m,text);assert.equal(find(r.memory,'дверь').opened,true);assert.equal(r.memory.place,'комната');});
for(const text of paraphrases.GIVE)test('world equivalence GIVE: '+text,()=>{const r=E.reply(config,fresh(),text);assert.equal(find(r.memory,'компас').location,r.memory.world.primaryNpcId);assert.ok(!r.memory.inventory.includes('компас'));});
for(const text of paraphrases.INSPECT)test('world equivalence INSPECT: '+text,()=>{const r=E.reply(config,fresh(),text);assert.ok(r.memory.world.loops.exploration.observed.includes(r.memory.world.player.location));assert.equal(r.memory.stage,0);});

const actionPhrases=['открыть дверь','выйти на улицу','взять ключ','отдать письмо','использовать ключ','обыскать стол','починить дверь'];
const passiveModes=[
 ['question',s=>'Можно '+s+'?'],['question',s=>'Могу ли я '+s+'?'],
 ['intention',s=>'Хочу '+s],['intention',s=>'Я собираюсь '+s],['intention',s=>'Планирую '+s],['intention',s=>'Мне нужно '+s],
 ['hypothetical',s=>'Если бы я решил '+s],['hypothetical',s=>'Я думаю, что можно '+s],
 ['negated',s=>'Я не буду '+s],['negated',s=>'Не хочу '+s]
];
for(const action of actionPhrases)for(const [mode,wrap]of passiveModes){
 const text=wrap(action);
 test('nonexecution '+mode+': '+text,()=>{
  const plan=E.resolve(locked,available,text);assert.equal(plan.steps[0].mode,mode,text);
  const result=E.reply(locked,available,text);assert.equal(physical(result.memory),physical(available),text);assert.equal(result.results[0].performed,false);
 });
}
for(const text of ['Я вышел бы на улицу','Я открыла бы дверь','Взял бы ключ','Вышла бы на улицу','Хочу открыть дверь и выйти на улицу','Можно взять ключ и открыть дверь?','Я говорю: «Открываю дверь и выхожу»','Я не открываю дверь и не выхожу'])test('scoped mode prevents physical actions: '+text,()=>{const r=E.reply(locked,available,text);assert.equal(physical(r.memory),physical(available));});
test('an indicative second/third-person form is a report even with the subject omitted',()=>{
 const m=E.reply(locked,available,'Беру ключ').memory;
 for(const text of ['Открывает дверь','Открывают дверь','Ты открываешь дверь']){const r=E.reply(locked,m,text);assert.equal(r.semantic.steps[0].intent,'OPEN');assert.equal(r.semantic.steps[0].mode,'report');assert.equal(physical(r.memory),physical(m));}
});

test('the requested JSON plan contains ordered slots and a dependency',()=>{
 const plan=E.resolve(config,fresh(),'Выйти на улицу, затем осмотреться');
 assert.equal(plan.mode,'execute');assert.deepEqual(plan.steps.map(s=>[s.intent,s.destination,s.target,s.dependsOnPrevious]),[['MOVE','улица',null,false],['INSPECT',null,'current_location',true]]);
});
test('leaving a named current location and plural movement use the same real exit',()=>{
 for(const text of ['Покинуть лавку','Покидаю лавку','Мы выйдем на улицу','Мы вышли на улицу']){const r=E.reply(config,fresh(),text);assert.equal(r.outcome.status,'success',text);assert.equal(r.memory.place,'улица');}
});
test('an implicit open asks which barrier when no focus selects one',()=>{
 const c={...locked,canon:locked.canon.replace('Предметы: ключ, дверь, письмо, стол','Предметы: ключ, дверь, письмо, стол, ларец')};const r=play(c,'Открыть');assert.equal(r.outcome.status,'clarification');assert.equal(find(r.memory,'дверь').opened,false);assert.equal(find(r.memory,'ларец').opened,false);
});
test('audit: the second step observes the actual destination after an infinitive move',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу и осмотреться');
 assert.equal(r.memory.place,'улица');assert.equal(r.results.length,2);assert.ok(r.memory.world.loops.exploration.observed.includes(r.memory.world.player.location));assert.match(r.text,/водосток/);assert.doesNotMatch(r.text,/письмо уже открывали/);
});
test('audit: the chest stays in the shop after a move, and examining it is refused',()=>{
 const r=E.reply(config,fresh(),'Выйти на улицу и осмотреть ларец');assert.equal(r.memory.place,'улица');assert.equal(r.results[1].status,'refused');assert.equal(find(r.memory,'ларец').opened,false);
});
test('a locked door stops every dependent step without moving or observing the street',()=>{
 const r=E.reply(locked,available,'Открыть дверь и пройти, затем осмотреться');
 assert.equal(r.memory.place,'комната');assert.equal(r.results.length,3);assert.equal(r.results[0].status,'refused');assert.ok(r.results.slice(1).every(r=>r.skipped&&r.code==='dependency_failed'));assert.equal(r.memory.world.loops.exploration.observed.length,0);
});
test('a successful key/open/pass sequence shares state and resolves the exit through that door',()=>{
 const r=E.reply(locked,available,'Взять ключ, затем открыть дверь и пройти');assert.equal(r.memory.place,'улица');assert.equal(r.results.length,3);assert.ok(r.results.every(r=>r.status==='success'));assert.equal(find(r.memory,'дверь').opened,true);
});
test('an explicit tool remains a method instead of replacing the direct object',()=>{
 const m=E.reply(locked,available,'Беру ключ').memory;
 for(const text of ['Открыть дверь с помощью ключа','Открыть дверь ключом','Дверь открыть ключом','Ключом открыть дверь']){const r=E.reply(locked,m,text);assert.equal(r.outcome.status,'success',text);assert.equal(find(r.memory,'дверь').opened,true);assert.equal(r.analysis[0].targetId,find(m,'дверь').id);assert.equal(r.analysis[0].semantic.toolId,find(m,'ключ').id);}
});
test('a different available key is not silently substituted for an explicitly unavailable tool',()=>{
 const m=E.reply(locked,available,'Беру ключ').memory;const r=E.reply(locked,m,'Открыть дверь с помощью отмычки');assert.equal(r.outcome.status,'clarification');assert.equal(find(r.memory,'дверь').opened,false);
});
test('a tool clarification preserves the original target and dependent plan',()=>{
 let r=play(locked,'Беру ключ','Открыть дверь с помощью отмычки и выйти на улицу');assert.equal(r.memory.world.player.pendingAction.slot,'tool');assert.equal(r.results[1].skipped,true);
 r=E.reply(locked,r.memory,'ключ');assert.equal(r.outcome.status,'success');assert.equal(r.memory.place,'улица');assert.equal(r.analysis[0].targetId,find(r.memory,'дверь').id);assert.equal(r.analysis[0].semantic.toolId,find(r.memory,'ключ').id);
});
test('unknown first physical action stops a dependent look; a separate sentence remains independent',()=>{
 const r=E.reply(config,fresh(),'Перепрыгнуть на Марс и осмотреться. Беру компас');assert.equal(r.results[1].skipped,true);assert.equal(r.results[2].status,'success');assert.equal(r.memory.world.loops.exploration.observed.length,0);
});
test('an unsupported physical predicate is named and preserved without pretending to perform it',()=>{
 const r=E.reply(config,fresh(),'Квантовать на Марс');assert.equal(r.results[0].code,'unsupported_action');assert.equal(r.results[0].performed,false);assert.match(r.text,/квантовать/);assert.ok(r.memory.threads.some(t=>t.text.includes('Квантовать на Марс')));assert.equal(r.memory.place,'лавка');
});
test('negation plus contrast runs the alternative action, not the denied one',()=>{
 const r=E.reply(locked,available,'Не беру ключ, а осматриваюсь');assert.deepEqual(r.memory.inventory,[]);assert.ok(r.memory.world.loops.exploration.observed.includes(r.memory.world.player.location));
});
test('questions to an NPC remain one dialogue act, not a nested move',()=>{
 const plan=E.resolve(config,fresh(),'Спросить Миру, можно ли выйти');assert.equal(plan.steps.length,1);assert.equal(plan.steps[0].intent,'TALK');
 const r=E.reply(config,fresh(),'Спросить Миру, можно ли выйти');assert.equal(r.memory.place,'лавка');
});
test('a coordinated action inside an NPC question remains part of the question',()=>{
 const text='Спросить Миру, можно ли выйти на улицу и осмотреться';const plan=E.resolve(config,fresh(),text);assert.equal(plan.steps.length,1);assert.equal(plan.steps[0].intent,'TALK');const r=E.reply(config,fresh(),text);assert.equal(r.memory.place,'лавка');assert.equal(r.memory.world.loops.exploration.observed.length,0);
});
test('an NPC request uses that NPC access, not the player key',()=>{
 const m=E.reply(locked,available,'Беру ключ').memory;const r=E.reply(locked,m,'Попрошу Миру открыть дверь');assert.equal(r.semantic.steps[0].mode,'request');assert.equal(r.analysis[0].actor,r.memory.world.primaryNpcId);assert.equal(r.outcome.status,'refused');assert.equal(find(r.memory,'дверь').opened,false);
});
test('a requested NPC can use its own explicitly named key',()=>{
 const c={...locked,canon:locked.canon+'\nВещи персонажа: ключ'};const r=play(c,'Попрошу Миру открыть дверь с помощью ключа');assert.equal(r.outcome.status,'success');assert.equal(find(r.memory,'дверь').opened,true);assert.equal(r.memory.place,'комната');
});
test('clarifying an NPC request preserves the requested actor role',()=>{
 let r=E.reply(config,fresh(),'Попрошу Бориса открыть ларец');assert.equal(r.memory.world.player.pendingAction.slot,'actor');r=E.reply(config,r.memory,'Миру');assert.equal(r.outcome.status,'success');assert.equal(r.analysis[0].actor,r.memory.world.primaryNpcId);assert.equal(find(r.memory,'ларец').opened,true);
});
test('an owner can carry out a request to open without moving the player',()=>{
 const r=E.reply(config,fresh(),'Попрошу Миру открыть ларец');assert.equal(r.analysis[0].actor,r.memory.world.primaryNpcId);assert.equal(find(r.memory,'ларец').opened,true);assert.equal(r.memory.place,'лавка');
});
test('dependent actions requested from an NPC retain their actor',()=>{
 const r=E.reply(config,fresh(),'Прошу Миру открыть ларец и выйти на улицу');assert.equal(r.results.length,2);assert.ok(r.analysis.every(a=>a.actor===r.memory.world.primaryNpcId));assert.equal(r.memory.place,'лавка');assert.equal(r.memory.world.npcs[r.memory.world.primaryNpcId].location,r.memory.world.outdoorId);
});
test('quoted speech reaches the dialogue memory without becoming a physical act',()=>{
 const r=E.reply(locked,available,'Я говорю: «Открываю дверь и выхожу»');assert.equal(r.outcome.status,'success');assert.equal(physical(r.memory),physical(available));assert.equal(r.analysis[0].semantic.recipient,null);
});
test('a clarification preserves the missing destination and the dependent inspection across a save',()=>{
 const c={...config,canon:'Локации: лавка, улица, сад\nПереходы: лавка <-> улица; лавка <-> сад'};
 let r=play(c,'Пойду и осмотрюсь');assert.equal(r.results[0].status,'clarification');assert.equal(r.results[1].skipped,true);assert.equal(r.memory.world.player.pendingAction.step.intent,'MOVE');
 r=E.reply(c,E.restore(c,JSON.parse(JSON.stringify(r.memory))),'улица');assert.equal(r.memory.place,'улица');assert.equal(r.semantic.resumed,true);assert.ok(r.memory.world.loops.exploration.observed.includes(r.memory.world.player.location));
});
test('a new explicit command cancels a pending clarification',()=>{
 let r=E.reply(config,fresh(),'Пойду');assert.ok(r.memory.world.player.pendingAction);r=E.reply(config,r.memory,'Осмотреться');assert.equal(r.memory.world.player.pendingAction,undefined);assert.equal(r.memory.place,'лавка');
});
test('source-before-verb and source-after-object resolve the same physical item on an authored surface',()=>{
 const c={...locked,canon:locked.canon+'\nНа поверхности: стол | ключ'};const m=E.restore(c,E.fresh());
 for(const text of ['Взять ключ со стола','Со стола забрать ключ','Ключ со стола взять']){const r=E.reply(c,m,text);assert.equal(r.outcome.status,'success',text);assert.deepEqual(r.memory.inventory,['ключ']);assert.equal(find(r.memory,'ключ').supportId,undefined);}
});
test('a named incorrect source is not silently discarded',()=>{
 const r=E.reply(locked,available,'Взять ключ со стола');assert.equal(r.outcome.status,'clarification');assert.deepEqual(r.memory.inventory,[]);
});
test('a carried object and an NPC-owned object have different preconditions',()=>{
 const c={...locked,canon:locked.canon+'\nВещи персонажа: книга'};
 const r=play(c,'Беру книгу у Миры');assert.equal(r.outcome.status,'refused');assert.deepEqual(r.memory.inventory,[]);
 const m=E.reply(locked,available,'Взять ключ').memory;assert.equal(E.reply(locked,m,'Подобрать ключ').outcome.status,'success');
});
test('background prose does not create a loose memory vial; the real vial is contained and hidden',()=>{
 const m=fresh(),vial=m.entities.find(e=>/флакон/.test(e.label));assert.ok(vial.containerId);assert.equal(vial.known,false);assert.equal(vial.hidden,true);assert.equal(vial.containerId,find(m,'ларец').id);assert.ok(!m.entities.some(e=>e.source==='world'));
 const r=E.reply(config,m,'Осмотреться');assert.doesNotMatch(r.text.replace(config.world,''),/флакон/);assert.equal(r.memory.entities.find(e=>e.id===vial.id).known,false);
});
test('migration removes an untouched prose-generated vial and restores the authored container relation',()=>{
 const old=fresh();delete old.contentsVersion;old.entities=old.entities.filter(e=>e.source!=='container-content');old.entities.push({id:'old-vial',label:'флакон',location:'лавка',source:'world',known:true,opened:false,destroyed:false});
 const restored=E.restore(config,JSON.parse(JSON.stringify(old)));assert.ok(!restored.entities.some(e=>e.id==='old-vial'));const vial=restored.entities.find(e=>/флакон/.test(e.label));assert.equal(vial.containerId,find(restored,'ларец').id);assert.equal(vial.hidden,true);
});
for(const input of ['Осмотреть флакон внутри закрытого ларца','Достать флакон из ларца','Взять флакон','Использовать флакон'])test('closed contents cannot be accessed: '+input,()=>{const m=fresh(),r=E.reply(config,m,input);assert.equal(r.outcome.status,'refused');assert.equal(physical(r.memory),physical(m));assert.doesNotMatch(r.text,/Правду можно сохранить/);});
test('opening, inspecting, taking, closing and reopening preserve physical containment without respawns',()=>{
 const r=play(config,'Осмотреться','Взять ключ','Открыть ларец','Достать флакон из ларца','Закрыть ларец','Открыть ларец');const vials=r.memory.entities.filter(e=>/флакон/.test(e.label));assert.equal(vials.length,1);assert.equal(vials[0].location,'inventory');assert.equal(vials[0].containerId,undefined);
});
test('closing a container hides remaining contents even after they were previously seen',()=>{
 const r=play(config,'Осмотреться','Взять ключ','Открыть ларец','Закрыть ларец','Осмотреться');assert.doesNotMatch(r.text,/Видно:[^\n]*флакон|«флакон/);const take=E.reply(config,r.memory,'Взять флакон');assert.equal(take.outcome.status,'refused');
});
test('a reopened container describes remaining physical contents instead of repeating the initial revelation',()=>{
 const r=play(config,'Осмотреться','Взять ключ','Открыть ларец','Взять флакон','Закрыть ларец','Открыть ларец');assert.doesNotMatch(r.text,/Внутри — флакон|«флакон/);assert.match(r.text,/записка/);const examine=E.reply(config,r.memory,'Осмотреть ларец');assert.doesNotMatch(examine.text,/флакон/);
});
test('container contents move with the container, never remain as loose items at the old place',()=>{
 const r=play(config,'Беру ларец','Выхожу','Кладу ларец');const chest=find(r.memory,'ларец');const vial=r.memory.entities.find(e=>/флакон/.test(e.label));assert.equal(chest.location,'улица');assert.equal(vial.location,'улица');assert.equal(vial.containerId,chest.id);assert.equal(vial.hidden,true);
});
test('explicit custom contents are inaccessible until their own container opens',()=>{
 const c={...locked,canon:locked.canon+'\nСодержимое: дверь | записка'};let r=play(c,'Взять записку');assert.equal(r.outcome.status,'refused');r=E.reply(c,r.memory,'Взять ключ и открыть дверь, затем взять записку');assert.equal(find(r.memory,'записка').location,'inventory');
});
test('unlocking, opening slightly and opening wide retain distinct causal meanings',()=>{
 let r=E.reply(locked,available,'Беру ключ');r=E.reply(locked,r.memory,'Отпереть дверь');assert.equal(find(r.memory,'дверь').locked,false);assert.equal(find(r.memory,'дверь').opened,false);
 r=E.reply(locked,r.memory,'Приоткрыть дверь');assert.equal(find(r.memory,'дверь').openingDegree,'slightly');const blocked=E.reply(locked,r.memory,'Иду на улицу');assert.equal(blocked.outcome.status,'refused');
 r=E.reply(locked,r.memory,'Распахнуть дверь и выйти на улицу');assert.equal(r.memory.place,'улица');assert.equal(find(r.memory,'дверь').openingDegree,'open');
});
test('the pronoun after unlocking refers to the door instead of the previously held key',()=>{
 const r=play(locked,'Взять ключ','Отпереть дверь','Распахнуть её и выйти на улицу');assert.equal(r.outcome.status,'success');assert.equal(r.memory.place,'улица');
});
test('a slightly opened chest does not expose its complete contents',()=>{
 const r=play(config,'Осмотреться','Взять ключ','Приоткрыть ларец','Осмотреть флакон');assert.equal(r.outcome.status,'refused');assert.equal(r.memory.entities.find(e=>/флакон/.test(e.label)).known,false);
});
test('stealing preserves a distinct variant instead of losing the qualifier',()=>{
 const a=E.resolve(locked,available,'Незаметно украсть ключ').steps[0],b=E.resolve(locked,available,'Взять ключ').steps[0];assert.equal(a.intent,b.intent);assert.equal(a.variant,'steal');assert.ok(a.manner.includes('скрытно'));assert.equal(b.variant,'take');
});
test('repair synonyms ask for a meaningful next step instead of instantly fixing the device',()=>{
 const m=play(config,'Выйти','Иду в город','Иду в мастерскую').memory;
 for(const text of paraphrases.REPAIR){const r=E.reply(config,m,text);assert.equal(r.outcome.status,'clarification',text);assert.equal(r.memory.entities.find(e=>e.localKey==='mechanism').condition,'broken');assert.match(r.text,/изучите механизм/);}
});
const negativePhrases=[
 'На табличке написано выйти на улицу','Надпись гласит: открыть дверь','Я слышал слово «взять ключ»','В книге написано «открой дверь»','В книге говорится открыть дверь','На табличке указано взять ключ',
 'Он хочет открыть дверь','Она планирует взять ключ','Они вышли на улицу','Мира открывает дверь','Я открываю рот','Поднимаю бровь',
 'Выйти из себя','Взять слово','Я не хочу брать ключ','Я не стану открывать дверь','Хочу узнать, кто открыл дверь',
 'Мне нужен способ открыть дверь','Я спрашиваю: «Можно выйти?»','Я говорю: «Беру ключ»','Спрашиваю Миру, можно ли открыть дверь',
 'Хочу поговорить о том, как открыть дверь','Прости','Не открывать дверь','Может быть, открыть дверь?','Если я выйду, что будет?'
];
for(const text of negativePhrases)test('no false physical action: '+text,()=>{const r=E.reply(locked,available,text);assert.equal(physical(r.memory),physical(available),text);});
for(const [text,intent]of [['Выйтти на улицу','MOVE'],['Открть дверь','OPEN'],['Осматрваюсь','INSPECT'],['Забртать ключ','TAKE']])test('bounded spelling correction: '+text,()=>{const r=E.resolve(locked,available,text);assert.equal(r.steps[0].intent,intent);});

test('repeated natural room observations use the same history and do not farm discoveries',()=>{
 let r=E.reply(config,fresh(),'Оглядеться');const discoveries=r.memory.world.loops.exploration.discoveries.length;
 for(const text of paraphrases.INSPECT)r=E.reply(config,r.memory,text);
 assert.equal(r.memory.world.loops.exploration.discoveries.length,discoveries);assert.equal(r.memory.stage,0);assert.equal(r.outcome.information.novel,false);
});
