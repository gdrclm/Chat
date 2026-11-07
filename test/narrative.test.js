import test from 'node:test';
import assert from 'node:assert/strict';
import '../scenes.js';
import '../simulation.js';
import '../engine.js';
const E=globalThis.StoryEngine;
const base={world:'Магическая лавка воспоминаний.',character:'Мира — сдержанная, с сухим юмором. Хочет защитить сестру.',player:'Путник с компасом'};
const kitchen={world:'Обычная кухня. Магии нет.',character:'Анна — добрая хозяйка. Хочет приготовить ужин.',player:'Имя: Алекс',canon:'Предметы: ложка, чашка, стол, закрытый шкаф\nСекрет: ужин готовится для старого друга'};
const play=(config,...texts)=>texts.reduce((r,t)=>E.reply(config,r.memory,t),{memory:E.fresh()});
const item=(memory,label)=>memory.entities.find(e=>e.label.includes(label));
const prepared=()=>play(base,'Осматриваюсь').memory;

test('one message can introduce a name, a goal, and an action',()=>{
 const r=play(base,'Меня зовут Лиса. Хочу вернуть брата. Осматриваюсь');
 assert.equal(r.memory.facts.name,'Лиса');assert.equal(r.memory.facts.goal,'вернуть брата');assert.equal(r.memory.stage,0);assert.ok(r.memory.world.loops.exploration.observed.length);
});
test('compound actions resolve pronouns against the item just taken',()=>{
 const r=E.reply(base,prepared(),'Беру письмо и открываю его');
 assert.equal(item(r.memory,'письмо').opened,true);assert.ok(r.memory.inventory.includes('запечатанное письмо'));assert.equal(item(r.memory,'ларец').opened,false);
});
test('negation and a contrasting action are separate',()=>{
 const r=E.reply(base,prepared(),'Не беру ключ, а танцую чечётку');
 assert.ok(!r.memory.inventory.includes('серебряный ключ'));assert.equal(r.memory.lastIntent,'perform');assert.ok(r.memory.facts.performance.includes('чечётку'));
});
test('negated violence does not harm trust or cause a conflict',()=>{
 const r=play(base,'Я не буду тебя бить');
 assert.equal(r.memory.trust,0);assert.equal(r.memory.tension,0);assert.equal(r.memory.clocks.danger,0);
});
test('hypothetical destruction changes neither possessions nor the object',()=>{
 const m=play(base,'Беру письмо').memory;
 const r=E.reply(base,m,'А что если я сожгу письмо?');
 assert.deepEqual(r.memory.inventory,m.inventory);assert.equal(item(r.memory,'письмо').destroyed,false);assert.equal(r.memory.clocks.danger,0);
});
test('quoted action remains speech, not a physical act',()=>{
 const r=E.reply(base,prepared(),'Я говорю: «Я открываю ларец»');
 assert.equal(item(r.memory,'ларец').opened,false);assert.equal(r.memory.lastIntent,'talk');
});
test('a plan phrased as a desire does not perform the act',()=>{
 const r=E.reply(base,prepared(),'Хочу открыть ларец');assert.equal(item(r.memory,'ларец').opened,false);assert.equal(r.memory.lastIntent,'goal');
});
test('thinking about an action is not performing it',()=>{
 const r=E.reply(base,prepared(),'Я думаю, что можно взять ключ');assert.ok(!r.memory.inventory.includes('серебряный ключ'));
});
test('a question does not learn a speculative player name',()=>{
 const r=play(base,'Как думаешь, меня зовут Вася?');assert.equal(r.memory.facts.name,undefined);
});
test('an object named in a custom scene is taken instead of the default key',()=>{
 const r=play(kitchen,'Беру ложку');assert.deepEqual(r.memory.inventory,['ложка']);assert.equal(item(r.memory,'ключ'),undefined);
});
test('an author supplied scene does not inherit an unrelated mystery',()=>{
 const r=play(kitchen,'Осматриваюсь');assert.doesNotMatch(r.text,/печать|ларец|взлом|дело|след: письмо/);assert.equal(r.memory.facts.clue,undefined);
});
test('several named possessions can be taken in one clause',()=>{
 const r=play(kitchen,'Беру ложку и чашку');assert.deepEqual(r.memory.inventory,['ложка','чашка']);
});
test('correction "not X but Y" picks the corrected object only',()=>{
 const r=play(kitchen,'Беру не чашку, а ложку');assert.deepEqual(r.memory.inventory,['ложка']);
});
test('one letter typo in a common action still works',()=>{
 const r=play(kitchen,'Осматрваюсь');assert.equal(r.memory.lastIntent,'inspect');assert.match(r.text,/ложка/);
});
test('lost items do not respawn or unlock a barrier',()=>{
 const r=play(base,'Осматриваюсь','Беру ключ','Бросаю его в окно','Открываю ларец');
 assert.ok(!r.memory.inventory.includes('серебряный ключ'));assert.equal(item(r.memory,'ключ').location,'lost');assert.equal(item(r.memory,'ларец').opened,false);
});
test('the direct object is not confused with the destination',()=>{
 const config={...kitchen,canon:'Предметы: окно, ключ'};
 const r=play(config,'Беру ключ','Бросаю ключ в окно');assert.equal(item(r.memory,'ключ').location,'lost');assert.equal(item(r.memory,'окно').location,r.memory.place);
});
test('a dropped object can be recovered where it was left',()=>{
 const r=play(kitchen,'Беру ложку','Кладу ложку на стол','Беру ложку');assert.deepEqual(r.memory.inventory,['ложка']);
});
test('gift changes ownership and remains remembered',()=>{
 const r=play(base,'Отдаю компас','Помнишь меня?');assert.ok(!r.memory.inventory.includes('компас'));assert.equal(item(r.memory,'компас').location,r.memory.world.primaryNpcId);assert.match(r.text,/компас/);
});
test('improvised bypass has a cost and uses the named obstacle',()=>{
 const r=play({...base,player:base.player+' с ножом'},'Использую нож чтобы поддеть запор ларца');assert.equal(item(r.memory,'ларец').opened,true);assert.ok(r.memory.clocks.danger>0);
});
test('an unrelated door must not secretly open the chest',()=>{
 const r=play({...base,player:base.player+' с верёвкой'},'Использую верёвку чтобы обойти дверь');assert.equal(item(r.memory,'ларец').opened,false);
});
test('opening a nonexistent object does not open the nearest barrier',()=>{
 const r=play(base,'Открываю окно');assert.equal(item(r.memory,'ларец').opened,false);
});
test('force is an alternate route with a persistent cost',()=>{
 const r=play(base,'Ломаю ларец');assert.equal(item(r.memory,'ларец').opened,true);assert.ok(r.memory.clocks.danger>=2);assert.ok(r.memory.journal.some(e=>e.kind==='cost'));
});
test('attack on furniture is not rewritten as attacking the character',()=>{
 const r=play(kitchen,'Бью по столу');assert.equal(r.memory.trust,0);assert.match(r.text,/не нападение на собеседника/);assert.ok(r.memory.clocks.danger>0);
});
test('questions do not perform combat',()=>{
 const r=play(base,'Что будет, если я ударю тебя?');assert.equal(r.memory.trust,0);assert.equal(r.memory.tension,0);
});
test('nonmagical canon constrains a transformation',()=>{
 const r=play(kitchen,'Беру ложку','Превращаю ложку в дракона');assert.equal(item(r.memory,'ложка').destroyed,false);assert.equal(item(r.memory,'дракона'),undefined);assert.match(r.text,/магия не установлена/);
});
test('a magical transformation consumes the old form and preserves the new form',()=>{
 const config={...base,canon:'Предметы: ложка'};
 const r=play(config,'Беру ложку','Превращаю ложку в дракона');assert.ok(!r.memory.inventory.includes('ложка'));assert.ok(r.memory.inventory.includes('дракона'));assert.equal(item(r.memory,'ложка').destroyed,true);
});
test('a player statement cannot override the author magic rule',()=>{
 const config={...base,canon:'Предметы: ложка'};
 const r=play(config,'Беру ложку','Запомни: магии нет','Превращаю ложку в дракона');assert.equal(item(r.memory,'ложка').destroyed,true);assert.equal(E.profile(r.memory.world.authorCanon).magic,true);
});
test('new objects authored in settings can then be used in play',()=>{
 const updated={...kitchen,canon:kitchen.canon.replace('ложка, чашка','ложка, чашка, камертон')};
 const memory=E.reframe(E.restore(kitchen,E.fresh()),kitchen,updated);
 const r=E.reply(updated,memory,'Беру камертон');assert.ok(r.memory.inventory.includes('камертон'));
});
test('leaving and returning preserves spatial ownership',()=>{
 const r=play(kitchen,'Беру ложку','Иду в сад','Осматриваюсь','Возвращаюсь');assert.equal(r.memory.place,'кухня');assert.ok(r.memory.inventory.includes('ложка'));assert.equal(item(r.memory,'чашка').location,'кухня');assert.equal(r.memory.npcPresent,true);
});
test('social actions in an empty new place do not affect a distant character',()=>{
 const r=play(kitchen,'Иду в сад','Спасибо');assert.equal(r.memory.trust,0);assert.match(r.text,/нет прежнего собеседника/);
});
test('newly revealed objects become usable scene entities',()=>{
 const config={world:'Детектив расследует дело',character:'Игорь — сыщик',player:'Гость'};
 const r=play(config,'Ломаю сейф','Беру фотографию');assert.ok(r.memory.inventory.includes('фотография'));
});
test('help offer followed by yes acts on the earlier offer',()=>{
 const r=play(base,'Помоги','Да');assert.equal(r.memory.lastIntent,'agree');assert.equal(r.memory.stage,0);assert.ok(r.memory.world.loops.exploration.observed.includes(r.memory.world.player.location));
});
test('NPC help provides another route and creates an obligation',()=>{
 const r=play({...base,canon:'Доступ персонажа: ларец'},'Привет','Помоги открыть ларец','Да');assert.equal(item(r.memory,'ларец').opened,true);assert.equal(r.memory.facts.debt,'защитить сестру');
});
test('motives and secrets come from author supplied canon',()=>{
 const config={...kitchen,canon:kitchen.canon+'\nЦель персонажа: вернуть дневник'};
 const r=play(config,'Чего ты хочешь?','Привет','Спасибо','Расскажи секрет');assert.match(r.text,/старого друга/);assert.equal(r.memory.facts.secret,'ужин готовится для старого друга');
});
test('repetition alone cannot farm unlimited trust',()=>{
 const r=play(base,...Array(12).fill('Спасибо'));assert.equal(r.memory.trust,2);
});
test('equivalent repeats cycle prose instead of repeating the same line',()=>{
 let m;const lines=[];for(let i=0;i<3;i++){const r=E.reply(base,m,'Спасибо');m=r.memory;lines.push(r.text);}assert.equal(new Set(lines).size,3);
});
test('an unfamiliar subject becomes a persistent thread, not a forced quest reset',()=>{
 const r=play(base,'Ананас управляет вероятностью');assert.ok(r.memory.threads.some(t=>t.text.includes('Ананас')));assert.equal(r.memory.stage,0);assert.doesNotMatch(r.text,/сначала осмотритесь/i);
});
test('the player can decide what to do with the discovered memory',()=>{
 const r=play(base,'Ломаю ларец','Отпускаю воспоминание');assert.equal(r.memory.facts.decision,'отпустить');assert.ok(r.memory.threads.some(t=>t.id==='next-chapter'));
});
test('editing the world updates the scene while preserving player facts',()=>{
 const before=play(base,'Меня зовут Алекс','Хочу найти брата','Осматриваюсь').memory;
 const after=E.reframe(before,base,kitchen);
 assert.equal(after.place,'кухня');assert.equal(after.stage,0);assert.equal(item(after,'ларец'),undefined);assert.equal(after.facts.clue,undefined);assert.equal(after.facts.name,'Алекс');
});
test('editing the NPC changes their motive and resets the old relationship',()=>{
 const before=play(base,'Привет','Спасибо').memory;
 const changed={...base,character:'Гром — холодный наёмник. Хочет вернуть долг.'};
 const after=E.reframe(before,base,changed);assert.equal(after.trust,0);const r=E.reply(changed,after,'Чего ты хочешь?');assert.match(r.text,/вернуть долг/);assert.doesNotMatch(r.text,/защитить сестру/);
});
test('API callers also receive an updated scene after editing config',()=>{
 const before=play(base,'Осматриваюсь').memory;
 const r=E.reply(kitchen,before,'Беру ложку');assert.equal(r.memory.place,'кухня');assert.ok(r.memory.inventory.includes('ложка'));
});
test('old saves migrate without losing the completed scene or possessions',()=>{
 const old={turn:9,trust:2,tension:0,stage:3,inventory:['серебряный ключ'],facts:{name:'Алекс'},seen:{}};
 const restored=E.restore(base,old);assert.equal(item(restored,'ларец').opened,true);assert.equal(restored.facts.name,'Алекс');assert.ok(restored.inventory.includes('серебряный ключ'));
});
test('replies do not mutate an input memory snapshot',()=>{
 const m=prepared();const snapshot=JSON.stringify(m);E.reply(base,m,'Беру ключ');assert.equal(JSON.stringify(m),snapshot);
});
test('more than four clauses are not silently discarded',()=>{
 const r=play(kitchen,'Меня зовут Алекс. Привет. Спасибо. Осматриваюсь. Беру ложку. Отдаю ложку.');assert.equal(item(r.memory,'ложка').location,r.memory.world.primaryNpcId);
});

test('bypassing a door leaves the original lock closed',()=>{
 const config={...base,canon:'Предметы: верёвка, окно\nПреграда: дверь'};
 const r=play(config,'Беру верёвку','Использую верёвку чтобы обойти дверь через окно');assert.equal(item(r.memory,'дверь').bypassed,true);assert.equal(item(r.memory,'дверь').opened,false);assert.equal(r.memory.stage,3);
});
test('body language is not treated as picking up an object',()=>{
 const r=play(base,'Поднимаю бровь');assert.equal(r.memory.lastIntent,'gesture');assert.doesNotMatch(r.text,/не удаётся найти/i);
});
test('an explicitly empty scene is kept empty',()=>{
 const r=play({...base,world:'Пустая комната. Здесь нет предметов.'},'Осматриваюсь');assert.equal(r.memory.entities.filter(e=>e.location===r.memory.place).length,0);assert.doesNotMatch(r.text,/ключ|ларец/);
});
test('a hero can change form when the world allows magic',()=>{
 const r=play(base,'Превращаюсь в дракона');assert.equal(r.memory.facts.form,'дракона');
});
test('partially corrupted save data is normalized into a usable scene',()=>{
 const m=E.restore(kitchen,{version:3,turn:NaN,entities:[null],inventory:[null],journal:[null],threads:[null],facts:{},seen:{}});
 const r=E.reply(kitchen,m,'Беру ложку');assert.ok(r.memory.inventory.includes('ложка'));assert.ok(Number.isFinite(r.memory.turn));
});

test('a quoted compound action stays entirely inside dialogue',()=>{
 const r=E.reply(base,prepared(),'Я говорю: «Я беру ключ и открываю ларец»');assert.equal(item(r.memory,'ларец').opened,false);assert.ok(!r.memory.inventory.includes('серебряный ключ'));
});
test('adverbs between a conjunction and an action do not swallow the action',()=>{
 const r=play(kitchen,'Улыбаюсь и медленно выхожу');assert.equal(r.memory.npcPresent,false);
});
test('planning a compound action does not enact its second part',()=>{
 const m=play(base,'Осматриваюсь','Беру ключ').memory;
 const r=E.reply(base,m,'Хочу взять письмо и открыть ларец');assert.equal(item(r.memory,'ларец').opened,false);
});
test('a compound hypothetical does not enact the follow-up',()=>{
 const r=E.reply(base,prepared(),'А что если я беру ключ и открываю ларец?');assert.equal(item(r.memory,'ларец').opened,false);assert.ok(!r.memory.inventory.includes('серебряный ключ'));
});

test('a feeling receives an emotional response rather than a compulsory puzzle',()=>{
 const r=play(base,'Мне грустно и одиноко');assert.ok(r.memory.facts.mood.includes('грустно'));assert.match(r.text,/выслушать/);assert.doesNotMatch(r.text,/ключ|ларец/);
});
test('a conversational goal changes the offered next step',()=>{
 const r=play(base,'Хочу просто поговорить','Что делать?');assert.match(r.text,/поговорить/);assert.doesNotMatch(r.text,/Пока закрыто/);
});
test('a player assertion about location does not bypass graph movement',()=>{
 const r=play(base,'На самом деле мы на корабле','Беру письмо');assert.equal(r.memory.place,'лавка');assert.ok(r.memory.inventory.includes('запечатанное письмо'));
});

test('recall finds an older established fact after new topics',()=>{
 const r=play(base,'Запомни: мою кошку зовут Луна','Запомни: я боюсь высоты','Помнишь кошку?');assert.match(r.text,/Луна/);
});
test('a player claim of item loss does not change actual possession',()=>{
 const r=play(base,'Осматриваюсь','Беру ключ','Запомни: ключ потерян','Открываю ларец');assert.equal(item(r.memory,'ключ').location,'inventory');assert.equal(item(r.memory,'ларец').opened,true);
});
