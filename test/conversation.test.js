import test from 'node:test';
import assert from 'node:assert/strict';
for(const f of ['spatial','narrator','messages','dialogue','developer','social','conversation-topics','npc-personality','conversation-memory','npc-biography','conversation-engine','action-catalog','rpg-core','physical-system','investigation-system','equipment-crafting','action-resolver','goals-story','npc-agency','economy-system','society-system','life-combat','genre-system','extended-actions','rpg-engine','semantic','scenes','simulation','engine'])await import('../'+f+'.js');
const E=globalThis.StoryEngine,T=globalThis.ConversationTopics;
const base={world:'Город. В лавке продают воспоминания в стеклянных флаконах.',character:'Мира — хозяйка лавки воспоминаний. Сдержанная и наблюдательная, с сухим юмором.',player:'Путник',canon:''};
const actor=(m,name='Мира')=>Object.values(m.world.npcs).find(n=>n.name===name);
const play=(commands,c=base,m=E.fresh())=>commands.reduce((r,t)=>E.reply(c,r.memory,t),{memory:m});
const speech=r=>r.messages.filter(m=>m.speaker.type==='npc').map(m=>m.text).join(' ');
const card=c=>E.restore(c,E.fresh());
const snapshot=m=>JSON.stringify({entities:m.entities,place:m.place,inventory:m.inventory,clocks:m.clocks,stage:m.stage});
for(const topic of T.all)for(const question of topic.questions)test(`catalog ${topic.number} ${topic.id}: ${question}`,()=>{
 const m=card(base),before=snapshot(m),r=E.reply(base,m,question),actual=r.analysis[0]?.conversation?.topicId;
 assert.ok(actual===topic.id||topic.id==='age'&&actual==='tenure',JSON.stringify({question,actual,analysis:r.analysis}));
 assert.equal(snapshot(r.memory),before);assert.ok(r.messages.some(m=>m.speaker.type==='npc'&&m.speaker.id===actor(r.memory).id));assert.ok(!r.messages.some(m=>m.speaker.type==='developer'));
});
for(const q of ['Как вас зовут?','Ваше имя?','Как тебя зовут','Как, пожалуйста, вас зовут?','Скажите, как вас зовут?','Мира, как вас зовут?'])test('polite naming: '+q,()=>{const r=play([q]);assert.match(speech(r),/Мира/);assert.equal(r.analysis[0].conversation.topicId,'name');});
test('five reported regressions have grounded and distinct answers',()=>{
 const r=play(['Как вас зовут?','Кто вы?','Что это за место?','Чем вы здесь занимаетесь?','Вы давно здесь живёте?']);assert.equal(r.results[0].code,'conversation_unknown');assert.match(speech(r),/срок|дат/);assert.doesNotMatch(speech(r),/свидетельств|улики|подтверждение/);
});
test('authored biography stays stable and absent facts are not invented',()=>{
 const c={...base,canon:'Биография NPC: Мира | origin | Я родом из Северной долины.\nБиография NPC: Мира | age | Мне тридцать четыре года.\nБиография NPC: Мира | tenure | Веду лавку семь лет.'};
 let r=play(['Откуда вы родом?','Вы давно здесь живёте?'],c);assert.match(speech(r),/семь лет/);const biography=structuredClone(actor(r.memory).biography);
 r=play(['Откуда вы родом?','Вы давно здесь живёте?'],c,E.restore(c,JSON.parse(JSON.stringify(r.memory))));assert.match(speech(r),/семь лет/);assert.deepEqual(actor(r.memory).biography,biography);
 const unknown=play(['Расскажите о семье'],c);assert.equal(unknown.results[0].code,'conversation_unknown');assert.equal(actor(unknown.memory).biography.facts.family,undefined);
});
test('work motivation and personal follow-up use the same context and own facts',()=>{
 const c={...base,canon:'Биография NPC: Мира | occupation.motivation | Я выбрала работу, чтобы возвращать людям утраченное.\nБиография NPC: Мира | occupation.personal_experience | Когда-то мне помог наставник. | глубина=1\nБиография NPC: Мира | previous_work | Раньше я переписывала книги. | глубина=1'};
 let r=play(['Почему вы выбрали эту работу?','А вам самой кто-нибудь помог?'],c);assert.match(speech(r),/наставник/);assert.equal(actor(r.memory).conversation.activeTopic,'occupation.personal_experience');
 r=E.reply(c,r.memory,'А раньше?');assert.match(speech(r),/переписывала книги/);assert.equal(r.analysis[0].conversation.followUp,'past');assert.equal(actor(r.memory).conversation.conversationDepth,2);
});
for(const q of ['Почему?','А раньше?','Расскажите подробнее','Что вы имеете в виду?','А у вас самой?','И что случилось потом?','Вы уверены?','А если я не соглашусь?'])test('context continuation preserves subject and physical state: '+q,()=>{
 const m=play(['Чем вы занимаетесь?']).memory,before=snapshot(m);const r=E.reply(base,m,q);assert.ok(r.analysis[0].conversation?.followUp,q);assert.equal(r.analysis[0].conversation.topicId,'occupation');assert.equal(snapshot(r.memory),before);assert.ok(speech(r));
});
test('a follow-up without a conversation asks for context instead of inventing a topic',()=>{const r=play(['Почему?']);assert.equal(r.results[0].code,'conversation_unknown');assert.match(speech(r),/Уточните|теме/);assert.equal(actor(r.memory).conversation.lastClaim,null);});
test('independent NPCs cannot inherit a previous conversation subject',()=>{
 const r=play(['Чем вы занимаетесь?','Выхожу на улицу','Иду в город','Иду в мастерскую','А раньше?']);assert.equal(actor(r.memory,'Илья').conversation.activeTopic,'unresolved');assert.equal(actor(r.memory).conversation.activeTopic,'occupation');assert.equal(r.results[0].code,'conversation_unknown');
});
test('repeated question remembers the count and never rewards trust',()=>{
 const m=card(base);let r=play(Array(12).fill('Как вас зовут?'),base,m);assert.equal(actor(r.memory).trust,0);assert.equal(actor(r.memory).conversation.discussedTopics.name.count,12);assert.match(speech(r),/Имя|представлялись/);
});
test('catalog scanning does not farm relationship scores',()=>{
 const m=card(base),before=structuredClone(actor(m).social.relationship);const r=play(T.all.map(t=>t.questions[0]),base,m);assert.equal(actor(r.memory).trust,0);assert.deepEqual(actor(r.memory).social.relationship,before);
});
test('high trust can reveal an authored private name but cannot invent one',()=>{
 const c={...base,canon:'Биография NPC: Мира | name.private | Когда-то меня звали Марой. | глубина=3'};let m=card(c);actor(m).trust=5;let r=E.reply(c,m,'Как вас зовут?');assert.match(speech(r),/Марой/);
 m=card(base);actor(m).trust=5;r=E.reply(base,m,'Как вас зовут?');assert.doesNotMatch(speech(r),/раньше|звали иначе|Марой/);
});
test('individual openness changes access at the same trust level',()=>{
 const c={...base,canon:'Биография NPC: Мира | family | Моя сестра — Лада. | глубина=3'};const closed=card(c),open=structuredClone(closed);actor(closed).trust=3;actor(open).trust=3;actor(closed).personality.openness=.05;actor(open).personality.openness=1;
 const a=E.reply(c,closed,'Расскажите о семье'),b=E.reply(c,open,'Расскажите о семье');assert.equal(a.results[0].code,'conversation_withheld');assert.equal(b.results[0].code,'conversation_truthful');assert.match(speech(b),/Лада/);assert.doesNotMatch(speech(a),/Лада/);
});
test('fear is not friendship and is independent from respect',()=>{
 const m=card(base);actor(m).social.relationship.fear=4;actor(m).social.relationship.respect=4;actor(m).trust=-2;const r=E.reply(base,m,'Вы мне доверяете?');assert.match(speech(r),/боюсь|не означает|доверяю/);assert.equal(actor(r.memory).trust,-2);assert.equal(actor(r.memory).social.relationship.affection,0);
});
test('high respect with low trust has a different content from warm affection',()=>{
 const a=card(base),b=structuredClone(a);actor(a).social.relationship.respect=4;actor(b).social.relationship.affection=4;
 const ra=E.reply(base,a,'Что вы обо мне думаете?'),rb=E.reply(base,b,'Что вы обо мне думаете?');assert.match(speech(ra),/уважение|умелого/);assert.match(speech(rb),/приятно/);assert.notEqual(speech(ra),speech(rb));
});
test('suspicion asks about motive without disclosing personal details',()=>{
 const m=card(base);actor(m).social.relationship.suspicion=3;const r=E.reply(base,m,'Как вас зовут?');assert.match(speech(r),/Мира.*Зачем/s);assert.equal(actor(r.memory).trust,0);
});
test('hostility can end contact and states the concrete unresolved cause',()=>{
 const m=card(base),n=actor(m);n.social.relationship.hostility=4;n.personality.assertiveness=.9;n.grievances.push({id:'case',kind:'theft',reason:'Украден компас',requiredItem:'компас',resolved:false});const r=E.reply(base,m,'Как вас зовут?');assert.equal(r.results[0].code,'conversation_refusal');assert.match(speech(r),/верните.*компас/);assert.equal(r.memory.world.activeNpcId,null);
});
test('high trust alone never opens a guarded secret',()=>{
 const c={...base,canon:'Секрет: Антон подменил память.'},m=card(c);actor(m).trust=5;actor(m).social.relationship.affection=5;const r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].code,'conversation_withheld');assert.doesNotMatch(speech(r),/Антон/);assert.equal(actor(r.memory).secretRevealed,false);
});
test('an explicit author disclosure rule can open a known secret',()=>{
 const c={...base,canon:'Секрет: Антон подменил память.\nРаскрытие NPC: Мира | secret | доверие=3'};const m=card(c);actor(m).trust=5;const r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].code,'conversation_truthful');assert.match(speech(r),/Антон/);assert.equal(r.memory.facts.secret,'Антон подменил память.');
});
test('evidence must be known to the NPC, not merely carried by the player',()=>{
 const c={...base,player:'Путник с запиской',canon:'Секрет: Архив принадлежит Антону.\nДоказательство: записка | виновник = Антон\nРаскрытие NPC: Мира | secret | доверие=3; улика=записка'};const m=card(c);actor(m).trust=5;let r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].code,'conversation_withheld');
 r=play(['Показываю записку','Расскажите секрет'],c,r.memory);assert.equal(r.results[0].code,'conversation_truthful');assert.match(speech(r),/Антону/);
});
test('protection of another person is not overridden by high trust',()=>{
 const c={...base,canon:'Секрет NPC: Мира | Ника скрывается в башне. | доверие=1; защищает=Ника'};const m=card(c);actor(m).trust=5;const r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].code,'conversation_withheld');assert.doesNotMatch(speech(r),/башне/);
});
test('an authored cover story is a lie, not absence of knowledge or changed world truth',()=>{
 const c={...base,canon:'Секрет NPC: Мира | Антон подменил письмо. | доверие=5; ложь=Я ничего не видела.'};const m=card(c),truth=structuredClone(m.world.facts);const r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].code,'conversation_lie');assert.match(speech(r),/ничего не видела/);assert.deepEqual(r.memory.world.facts,truth);assert.equal(actor(r.memory).secretRevealed,false);assert.ok(!actor(r.memory).conversation.disclosedFacts.some(id=>id.includes(':secret:')));
});
test('a known secret can be evaded separately from an unknown biography',()=>{
 const c={...base,canon:'Секрет NPC: Мира | Антон подменил письмо. | доверие=5; уклонение=Поговорим о работе.'};const r=play(['Расскажите секрет'],c);assert.equal(r.results[0].code,'conversation_evasion');assert.match(speech(r),/работе/);
});
test('machine and spirit cards do not acquire a human childhood or diet',()=>{
 for(const description of ['Оракул — искусственный интеллект. Исследователь.','Эхо — древний дух.']){const c={...base,character:description};const r=play(['Каким было ваше детство?'],c);assert.equal(r.results[0].code,'conversation_not_applicable');assert.equal(actor(r.memory,E.profile(c).name).biography.facts.childhood,undefined);}
});
test('new NPCs of one archetype retain different stable cards across saves',()=>{
 const c={...base,canon:'Персонаж: Антон | рынок | торговать книгами\nПерсонаж: Борис | площадь | торговать картами'};const m=card(c),a=actor(m,'Антон'),b=actor(m,'Борис');assert.notDeepEqual(a.personality,b.personality);assert.notEqual(a.biography.facts.goal[0].text,b.biography.facts.goal[0].text);
 const saved=E.restore(c,JSON.parse(JSON.stringify(m)));assert.deepEqual(actor(saved,'Антон').biography,a.biography);assert.deepEqual(actor(saved,'Борис').personality,b.personality);
});
test('a curious greeting asks a question and remembers a short player answer',()=>{
 const c={...base,canon:'Манера NPC: Мира | sociability=0.8; curiosity=0.9'};let r=play(['Привет'],c);assert.match(speech(r),/как зовут вас/);assert.equal(actor(r.memory).conversation.pendingNpcQuestion.type,'player_name');
 r=E.reply(c,r.memory,'Алекс');assert.equal(r.results[0].code,'conversation_answer_remembered');assert.equal(actor(r.memory).memory.playerName,'Алекс');assert.equal(r.memory.facts.name,'Алекс');assert.equal(actor(r.memory).conversation.pendingNpcQuestion,null);
});
test('refusing a reciprocal question preserves autonomy and stops repeated requests',()=>{
 const c={...base,canon:'Манера NPC: Мира | sociability=0.8; curiosity=0.9'};const r=play(['Привет','Не хочу отвечать','Кто вы?','Что это за место?','Как вас зовут?'],c);assert.equal(actor(r.memory).memory.playerName,undefined);assert.ok(actor(r.memory).conversation.declinedQuestions.includes('player_name'));assert.equal(actor(r.memory).conversation.askedQuestions.player_name,1);
});
test('a pending name question never turns a physical command into a name',()=>{
 const c={...base,canon:'Манера NPC: Мира | sociability=0.8; curiosity=0.9'};const r=play(['Привет','Осмотреться'],c);assert.equal(actor(r.memory).memory.playerName,undefined);assert.equal(r.analysis[0].intent,'inspect');assert.ok(r.outcome.information.novel);
});
test('questions are occasional and absent outside actual contact',()=>{
 const c={...base,canon:'Манера NPC: Мира | sociability=0.8; curiosity=0.9'};let r=play(['Привет','Алекс'],c);assert.doesNotMatch(speech(r),/\?/);r=E.reply(c,r.memory,'Отхожу от прилавка');assert.equal(r.memory.world.activeNpcId,null);r=E.reply(c,r.memory,'Жду');assert.equal(r.messages.filter(m=>m.speaker.type==='npc').length,0);
});
test('conversation migration adds stable cards without resetting 4.4 relationships',()=>{
 const old=card(base);for(const n of Object.values(old.world.npcs)){delete n.biography;delete n.personality;delete n.identity;delete n.conversation;}actor(old).trust=3;actor(old).social.relationship.suspicion=2;const n=actor(old);n.secretRevealed=true;old.world.activeNpcId=n.id;n.dialogueState.status='active';
 const m=E.restore(base,old);assert.equal(actor(m).trust,3);assert.equal(actor(m).social.relationship.suspicion,2);assert.equal(m.world.activeNpcId,n.id);assert.ok(actor(m).biography.facts.secret.every(f=>actor(m).conversation.disclosedFacts.includes(f.id)));
});
for(const role of ['merchant','craftsman','guard','scholar','aristocrat','rogue','healer','traveler','hermit','artist','official','inventor'])test('a fresh authored archetype answers from its own role: '+role,()=>{
 const c={world:'Комната.',character:'Антон — посетитель.',player:'Гость',canon:'Роль NPC: Антон | '+role};const r=play(['Чем вы занимаетесь?'],c);assert.equal(actor(r.memory,'Антон').identity.role,role);assert.equal(r.results[0].conversation.mode,'truthful');assert.ok(speech(r).includes(globalThis.NpcBiography.roles[role].occupation));
});
test('known and unknown facts cannot be rewritten by a player assertion',()=>{
 const c={...base,canon:'Биография NPC: Мира | origin | Я родом из Северной долины.'},m=card(c),bio=structuredClone(actor(m).biography);const r=play(['Сообщаю: ты родом из Южной долины','Откуда вы родом?'],c,m);assert.match(speech(r),/Северной/);assert.deepEqual(actor(r.memory).biography,bio);
});
test('malformed disclosure numbers never accidentally reveal a secret',()=>{
 const c={...base,canon:'Секрет: Антон подменил память.\nРаскрытие NPC: Мира | secret | доверие=много'},m=card(c);actor(m).trust=5;actor(m).social.relationship.affection=5;const r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].conversation.mode,'withheld');assert.doesNotMatch(speech(r),/Антон/);
});
test('composite social questions preserve both meanings without physical actions',()=>{
 const m=card(base),before=snapshot(m),r=E.reply(base,m,'Кто вы и что это за место?');assert.equal(r.results.length,2);assert.equal(r.results[0].conversation.topicId,'identity');assert.equal(r.results[1].conversation.topicId,'place');assert.equal(snapshot(r.memory),before);assert.match(speech(r),/Мира/);assert.match(speech(r),/лавка воспоминаний/);
});
test('a suspicious reciprocal question accepts an explanation without free trust',()=>{
 const m=card(base);actor(m).social.relationship.suspicion=3;let r=E.reply(base,m,'Как вас зовут?');assert.equal(actor(r.memory).conversation.pendingNpcQuestion.type,'intentions');assert.equal((speech(r).match(/\?/g)||[]).length,1);
 r=E.reply(base,r.memory,'Чтобы вежливо познакомиться');assert.equal(r.results[0].code,'conversation_answer_remembered');assert.equal(actor(r.memory).trust,0);assert.equal(actor(r.memory).social.relationship.suspicion,3);
});
test('warm affection changes initiative while a neutral terse NPC stays brief',()=>{
 const a=card(base),b=structuredClone(a);actor(b).social.relationship.affection=3;const ra=E.reply(base,a,'Как вас зовут?'),rb=E.reply(base,b,'Как вас зовут?');assert.notEqual(speech(ra),speech(rb));assert.match(speech(rb),/приятно/);
});
test('a completed real work contract earns one remembered cooperative experience',()=>{
 const r=play(['Выхожу на улицу','Осматриваю водосток','Приподнимаю решётку','Беру проволоку','Иду в город','Иду в мастерскую','Ищу работу','Да','Осматриваю механизм','Проверяю хватает ли деталей','Изготавливаю штифт','Устанавливаю штифт','Проверяю ход механизма','Забираю плату']);
 const n=actor(r.memory,'Илья');assert.ok(n.conversation.relationshipCredits.some(id=>id.startsWith('work:')));assert.equal(n.social.relationship.respect,1);const before=n.trust;const next=play(['Кто вы?','Чем вы занимаетесь?','Вы мне доверяете?'],base,r.memory);assert.equal(actor(next.memory,'Илья').trust,before);assert.equal(actor(next.memory,'Илья').social.relationship.respect,1);
});
test('a human spiritual mentor is not mistaken for a disembodied spirit',()=>{
 const c={...base,character:'Лея — духовная наставница.'};const r=play(['Каким было ваше детство?'],c);assert.equal(actor(r.memory,'Лея').identity.kind,'human');assert.equal(r.results[0].conversation.mode,'unknown');
});
test('the common Russian AI abbreviation gets a nonhuman card',()=>{
 const c={...base,character:'Оракул — ИИ станции.'};const r=play(['Каким было ваше детство?'],c);assert.equal(actor(r.memory,'Оракул').identity.kind,'machine');assert.equal(r.results[0].conversation.mode,'not_applicable');
});

test('first disclosure after refusal is new information and preserves proper names',()=>{
 const c={...base,canon:'Секрет: Антон подменил память.\nРаскрытие NPC: Мира | secret | доверие=3'},m=card(c);let r=E.reply(c,m,'Расскажите секрет');assert.equal(r.results[0].conversation.mode,'withheld');actor(r.memory).trust=5;r=E.reply(c,r.memory,'Расскажите секрет');assert.match(speech(r),/Антон/);assert.doesNotMatch(speech(r),/Как уже говорилось/);assert.ok(r.outcome.information.novel);
 r=E.reply(c,r.memory,'Расскажите секрет');assert.match(speech(r),/Антон/);assert.equal(r.outcome.information.novel,false);
});

test('an explicit nonhuman biography overrides a default applicability assumption',()=>{
 const c={...base,character:'Оракул — ИИ станции.',canon:'Биография NPC: Оракул | childhood | Мой ранний опыт — обучение на навигационных задачах. | глубина=1'};const r=play(['Каким было ваше детство?'],c);assert.equal(r.results[0].conversation.mode,'truthful');assert.match(speech(r),/навигационных задачах/);
});
