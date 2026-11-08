/* Offline Russian action grammar. It describes a plan; it never changes the world. */
(function (root) {
  'use strict';
  const norm = value => String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
  const tidy = value => String(value || '').replace(/^[\s,:—-]+|[\s,.!?;:]+$/g, '').trim();
  const tokens = value => norm(value).match(/[a-zа-я0-9-]+/g) || [];
  const stem = word => {
    if (/^лар(?:ец|ц)/.test(word)) return 'ларец';
    if (/^двер(?:ь|и|ью|ей|ям|ями|ях)?$/.test(word)) return 'двер';
    if (/^мир[аыуеой]*$/.test(word)) return 'мира';
    return word.replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ов|ев|ей|ия|ию|ие|ий|ый|ой|ая|яя|ую|юю|ам|ям|ах|ях|ом|ем|а|я|ы|и|у|ю|е|о|ь)$/u, '');
  };
  const lexicon = new Map();
  function verbs(intent, canonical, forms, extra = {}) {
    for (const word of forms.split(/\s+/).filter(Boolean)) lexicon.set(word, { intent, canonical, ...extra });
  }
  verbs('MOVE', 'Иду', 'идти иду идем иди идите шел шла пойду пойти пойдем пошел пошла идтись отправиться отправляюсь отправлюсь отправился отправилась отправляемся направиться направляюсь направлюсь направился направилась направляемся перейти перехожу перейду перешел перешла переходить пройти прохожу пройду прошел прошла добраться добираюсь дойти дохожу', { variant: 'travel' });
  verbs('MOVE', 'Выхожу', 'выйти выхожу выйду выйдем выйди выйдите выходим вышел вышла вышли выходить уйти ухожу уйду ушел ушла покинуть покидаю покину покинул покинула', { variant: 'leave' });
  verbs('MOVE', 'Иду', 'войти вхожу войду войди войдите вошел вошла входить заходить зайти захожу зайду зашел зашла', { variant: 'enter' });
  verbs('MOVE', 'Иду', 'подняться поднимаюсь поднимусь поднялся поднялась спуститься спускаюсь спущусь спустился спустилась', { variant: 'vertical' });
  verbs('MOVE', 'Иду', 'попасть попадаю попаду попал попала доберусь добрался добралась дойду дошел дошла', { variant: 'travel' });
  verbs('MOVE', 'Возвращаюсь', 'вернуться возвращаюсь вернусь вернулся вернулась возвращаться', { variant: 'return' });
  verbs('APPROACH', 'Подхожу', 'подойти подхожу подойду подойди подойдите подошел подошла подошли подходить приблизиться приближаюсь приближусь приблизься приблизился приблизилась приближаться', { scope:'local' });
  verbs('GREET', 'Приветствую', 'поприветствовать приветствовать приветствую приветствуй приветствуйте поприветствую поприветствуй поприветствуйте поприветствовал поприветствовала поздороваться здороваться здороваюсь поздороваюсь поздоровайся поздоровайтесь поздоровался поздоровалась привет здравствуй здравствуйте здороваться', { variant:'greeting' });
  verbs('GREET', 'Приветствую', 'приветствует здоровается', { variant:'greeting',form:'report' });
  verbs('INSPECT', 'Осматриваю', 'осмотреть осматриваю осмотрю осмотри осмотрите осмотрел осмотрела осматривать оглядеть оглядываю огляжу оглядел оглядела изучить изучать изучаю изучу изучил изучила исследовать исследую исследовал исследовала рассмотреть рассматриваю рассмотрю рассмотрел рассмотрела разглядеть разглядываю разгляжу посмотреть смотрю посмотрю поглядеть глянуть', { method: 'examine' });
  verbs('INSPECT', 'Осматриваюсь', 'осмотреться осматриваюсь осмотрюсь осмотрелся осмотрелась оглядеться оглядываюсь огляжусь огляделся огляделась озираться озираюсь оглянуться оглянусь', { method: 'survey' });
  verbs('INSPECT', 'Слушаю', 'послушать слушать слушаю послушаю прислушаться прислушиваюсь прислушаюсь прислушался прислушалась', { method: 'listen' });
  verbs('INSPECT', 'Проверяю', 'проверить проверяю проверю проверил проверила проверить испытать испытываю испытаю', { method: 'check' });
  verbs('INSPECT', 'Читаю', 'читать читаю прочитать прочитаю прочел прочла прочитал прочитала прочитываю', { method: 'read' });
  verbs('SEARCH', 'Обыскиваю', 'обыскать обыскиваю обыщу обыскал обыскала поискать ищу поищу искал искала искать обшарить обшариваю обшарю заглянуть заглядываю загляну заглянул заглянула', { method: 'search' });
  verbs('TAKE', 'Беру', 'взять беру возьму возьми возьмите взял взяла брать забрать забираю заберу забрал забрала подобрать подбираю подберу подобрал подобрала поднять поднимаю подниму поднял подняла достать достаю достану достал достала вытащить вытаскиваю вытащу вытащил вытащила прихватить прихватываю прихвачу прихватил прихватила схватить хватаю схвачу', { variant: 'take' });
  verbs('TAKE', 'Беру', 'украсть краду украду украл украла стащить стаскиваю стащу', { variant: 'steal', manner: 'скрытно' });
  verbs('OPEN', 'Открываю', 'открыть открываю открою открой откройте открыл открыла открывать', { variant: 'open' });
  verbs('OPEN', 'Открываю', 'открывает открывают открываешь', { variant: 'open', form: 'report' });
  verbs('OPEN', 'Открываю', 'отпереть отпираю отопру отпер отперла отпирать разблокировать разблокирую', { variant: 'unlock' });
  verbs('OPEN', 'Открываю', 'распахнуть распахиваю распахну распахнул распахнула', { variant: 'wide' });
  verbs('OPEN', 'Открываю', 'приоткрыть приоткрываю приоткрою приоткрыл приоткрыла', { variant: 'slightly' });
  verbs('USE', 'Использую', 'использовать использую использовал использовала применить применяю применю применил применила воспользоваться пользуюсь воспользуюсь воспользовался воспользовалась задействовать задействую задействовал задействовала');
  verbs('TALK', 'Говорю', 'поговорить говорю поговорю поговорил поговорила побеседовать беседую побеседую побеседовал побеседовала пообщаться общаюсь пообщаюсь поболтать болтаю поболтаю');
  verbs('TALK', 'Обращаюсь к', 'обратиться обращаюсь обращусь обратился обратилась');
  verbs('TALK', 'Спрашиваю', 'спросить спрашиваю спрошу спросил спросила расспросить расспрашиваю расспрошу', { variant: 'ask' });
  verbs('GIVE', 'Отдаю', 'отдать отдаю отдам отдал отдала передать передаю передам передал передала вручить вручаю вручу вручил вручила подарить дарю подарю подарил подарила дать даю дам дал дала', { variant: 'transfer' });
  verbs('REPAIR', 'Чиню', 'починить чиню починю починил починила чинить отремонтировать ремонтирую отремонтирую отремонтировал отремонтировала ремонтировать исправить исправляю исправлю исправил исправила восстановить восстанавливаю восстановлю восстановил восстановила');
  verbs('CLOSE', 'Закрываю', 'закрыть закрываю закрою закрой закрыл закрыла захлопнуть захлопываю захлопну запереть запираю запру');
  verbs('DROP', 'Кладу', 'положить кладу положу положил положила оставить оставляю оставлю оставил оставила бросить бросаю брошу бросил бросила');
  verbs('SHOW', 'Показываю', 'показать показываю покажу показал показала продемонстрировать демонстрирую продемонстрирую');

  const modifiers = new Set('я мы он она они ты вы сейчас теперь затем потом сначала пожалуйста осторожно аккуратно тихо медленно быстро решительно сразу снова еще уже просто немного полностью широко потихоньку незаметно тайно тут здесь вокруг кругом внимательно попробую попробуем пытаюсь попытаюсь попробовал попробовала буду будем давай давайте бы лучше хочу хочется собираюсь планирую намерен намерена намереваюсь хотел хотела хотелось мне нужно надо необходимо можно могу ли если что будет случится а не стану стал стала думаю предположим допустим'.split(' '));
  const stopTargets = /^(?:я|мы|пожалуйста|сейчас|теперь|осторожно|аккуратно|тихо|медленно|быстро|решительно|снова|внимательно|незаметно|тайно|потихоньку|полностью|немного|широко|просто|еще|уже|сначала|затем|потом)\s+/;
  const phrases = [
    [/^(?:добрый\s+(?:день|вечер)|доброе\s+утро)/iu, {intent:'GREET',canonical:'Приветствую',variant:'greeting'}],
    [/^(?:снять|снимаю|сниму)\s+крышку/iu, { intent: 'OPEN', canonical: 'Открываю', variant: 'lid' }],
    [/^(?:завести|завожу|заведу)\s+разговор/iu, { intent: 'TALK', canonical: 'Говорю', variant: 'conversation' }],
    [/^(?:проверить|проверяю|проверю)\s+содержимое/iu, { intent: 'SEARCH', canonical: 'Обыскиваю', method: 'search' }]
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function visible(text) { return norm(text).replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, m => ' '.repeat(m.length)); }
  function oneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return edits + Number(i < a.length || j < b.length) === 1;
  }
  function lookup(word) {
    if (lexicon.has(word)) return { ...lexicon.get(word), word };
    if (word.length < 6) return null;
    const alternatives = [...lexicon.keys()].filter(v => v.slice(0,4)===word.slice(0,4)&&oneEdit(word, v));
    if (!alternatives.length || new Set(alternatives.map(v => lexicon.get(v).intent)).size !== 1) return null;
    const corrected = alternatives[0];
    return { ...lexicon.get(corrected), word: corrected, correction: { from: word, to: corrected } };
  }
  function allowedPrefix(prefix, context) {
    const parts = tokens(prefix);
    if (parts.every(t => modifiers.has(t))) return true;
    if (/(?:написано|надпись|сказано|сказали|говорится|указано|упоминается|рекомендуется|следует|рассказ|мечта|совет|слово|команда|история|цитата|название|обещал|обещала|думает|хочет)/.test(prefix)) return false;
    const withoutModifiers = parts.filter(t => !modifiers.has(t));
    if (!withoutModifiers.length) return true;
    const first = withoutModifiers[0];
    if (['с', 'со', 'из', 'у', 'в', 'на', 'к'].includes(first) && withoutModifiers.length <= 5) return true;
    const nouns=[...(context.entities || []),...(context.people || [])].flatMap(e=>tokens(e.label || e.name).map(stem));
    return withoutModifiers.every(word=>['с','со','из','у','в','на','к'].includes(word)||nouns.includes(stem(word)));
  }
  function head(text, context = {}) {
    const source = visible(text);
    for (const match of source.matchAll(/[а-яa-z-]+/g)) {
      const prefix = source.slice(0, match.index);
      if (!allowedPrefix(prefix, context)) continue;
      for (const [re, spec] of phrases) {
        const phrase = source.slice(match.index).match(re);
        if (phrase) return { ...spec, start: match.index, end: match.index + phrase[0].length, word: phrase[0], prefix };
      }
      const entry = lookup(match[0]);
      if (entry) return { ...entry, start: match.index, end: match.index + match[0].length, prefix };
    }
    return null;
  }
  function mode(text, h, inherited, context={}) {
    const q = visible(text);
    if (/^(?:я\s+)?(?:говорю|сказал|скажу|шепчу|кричу|рассказываю)\s*[:«“"]/.test(norm(text))) return 'speech';
    const addressed=q.match(/^([а-я-]+)\s*[:,]\s*(?:открой|выйди|возьми|осмотри)/);
    if (/^(?:я\s+)?(?:попрошу|прошу|попросить|попроси|попросил|попросила)\s/.test(q) || addressed&&!modifiers.has(addressed[1])) return 'request';
    if (/(?:^|\s)не\s+(?:(?:буду|стану|хочу|собираюсь|могу|планирую)\s+)?[а-я]+/.test(q) && !/(?:беру|взять|забираю)\s+не\s/.test(q)) return 'negated';
    if (/\?|^(?:а\s+)?(?:можно|могу\s+ли|как\s|почему\s|зачем\s|когда\s|где\s|что\s+(?:будет|случится))/.test(q)) return 'question';
    if (/(?:^|\s)(?:если|бы)(?:\s|$)|^(?:я\s+)?(?:думаю|представь|допустим|предположим)/.test(q)) return 'hypothetical';
    if (/^(?:я\s+)?(?:хочу|собираюсь|планирую|намерен|намерена|намереваюсь)|^(?:мне\s+(?:нужно|надо|необходимо)|хотелось)/.test(q)) return 'intention';
    if(h?.form==='report')return 'report';
    if (h?.intent === 'TALK') return 'execute';
    if (h && (contextPerson(h.prefix) || (context.people || []).some(n=>norm(tidy(h.prefix))===norm(n.name)) || /(?:^|\s)(?:он|она|они|ты|вы)\s/.test(q))) return 'report';
    if (/(?:^|\s)(?:попробую|попытаюсь|пытаюсь|попробуем)(?:\s|$)/.test(q)) return 'attempt';
    return inherited || 'execute';
  }
  function contextPerson(prefix) { return /^(?:мира|илья|ника|лея)\s*$/.test(tidy(prefix)); }
  function modifiersIn(text) {
    return tokens(text).filter(w => ['осторожно','аккуратно','тихо','медленно','быстро','незаметно','тайно','потихоньку','полностью','широко'].includes(w));
  }
  function stripModifiers(value) {
    let result = norm(tidy(value));
    while (stopTargets.test(result)) result = result.replace(stopTargets, '');
    return tidy(result.replace(/\s+(?:пожалуйста|осторожно|аккуратно|тихо|медленно|внимательно)$/g, ''));
  }
  function relation(value) {
    const q = ' ' + value;
    const found = q.match(/\s+(из|со|с|у|внутри)\s+(.+?)(?=\s+(?:чтобы|используя|посредством|осторожно|пожалуйста)|$)/u);
    return found ? { direct: tidy(q.slice(0, found.index)), source: tidy(found[2]), preposition: found[1] } : { direct: tidy(value), source: null };
  }
  function placeName(value) {
    return ({улицу:'улица',улице:'улица',мастерскую:'мастерская',мастерской:'мастерская',площадь:'площадь',рынке:'рынок',городу:'город',городе:'город',лавку:'лавка',лавке:'лавка',саду:'сад'})[value] || value;
  }
  function slots(text, h, context) {
    if (!h) return {};
    const prefix = stripModifiers(h.prefix), suffix = stripModifiers(text.slice(h.end));
    let args = suffix, source = null, destination = null, recipient = null, placement = null;
    const via = args.match(/\s+(?:с помощью|используя|посредством)\s+(.+?)(?=\s+чтобы|$)/u);
    let tool=via?.[1]||null;
    const effect = args.match(/\s+(?:чтобы|с целью)\s+(.+)$/u)?.[1] || null;
    args = tidy(args.split(/\s+(?:чтобы|с целью|с помощью|используя|посредством)\s+/u)[0]);
    if(['OPEN','REPAIR'].includes(h.intent)&&!tool){
      const instrument=args.match(/(?:^|\s+)([а-я]+(?:ом|ем|ой|ью))$/u);
      if(instrument&&(context.entities||[]).some(e=>['tool','weapon'].includes(e.kind)&&matches(instrument[1],e.label))){tool=instrument[1];args=tidy(args.slice(0,instrument.index));}
      else if(/(?:ом|ем|ой|ью)$/u.test(prefix)&&(context.entities||[]).some(e=>['tool','weapon'].includes(e.kind)&&matches(prefix,e.label)))tool=prefix;
    }
    let target = args;
    if (h.intent === 'MOVE') {
      if (h.variant === 'return'&&!args) destination = 'previous_location';
      else if (/^(?:наружу|снаружи|вон)$/.test(args)) destination = 'outside';
      else {
        args=args.replace(/^бы\s+/u,'');
        const path = (args || prefix).match(/^(?:в|на|к|до|через)\s+(.+)$/u);
        destination = path ? placeName(tidy(path[1])) : null;
        if (!destination && h.variant === 'leave' && (!args || /^(?:из|с|со)\s/.test(args))) destination = 'outside';
        if(!destination&&h.variant==='leave'&&context.memory?.place&&matches(args,context.memory.place))destination='outside';
      }
      target = null;
    } else {
      if (h.intent === 'OPEN' && h.variant === 'lid') args = args.replace(/^(?:с|у|от)\s+/u, '');
      if (h.intent === 'REPAIR') args = args.replace(/^работоспособность\s+/u, '');
      if (h.intent === 'SEARCH') args = args.replace(/^(?:внутрь|внутри|содержимое)\s*/u, '');
      if (h.intent === 'DROP') {const where=args.match(/\s+((?:в|на|под|за)\s+.+)$/u);if(where){placement=where[1];args=args.slice(0,where.index);}}
      if (h.intent === 'INSPECT' && h.method === 'listen') args = args.replace(/^(?:к|за|в|на)\s+/u, '');
      if(h.intent==='GREET'){
        if(!args&&prefix&&!tokens(prefix).every(token=>modifiers.has(token)))args=prefix;
        args=args.replace(/^(?:с|со|к)\s+/u,'');
        recipient=/^(?:меня|мной|со мной|героя|игрока)$/u.test(args)?'player':(context.people||[]).find(n=>matches(args,n.name))?.name||args||null;
        target=null;
      }else if (h.intent === 'TALK') {
        const explicit=/^(?:разговор\s+)?(?:с|со|к)\s+/u.test(args);
        const topic=/^(?:о|об|про)\s+/u.test(args);
        args = args.replace(/^(?:разговор\s+)?(?:с|со|к)\s+/u, '');
        const candidate = (context.people || []).find(n => matches(args, n.name));
        recipient = topic?null:candidate?.name || (explicit?tidy(args.split(/[,?:]/)[0]):null);
        target = recipient || null;
      } else {
        const rel = relation(args);
        target = rel.direct; source = rel.source;
        if (prefix && /^(?:с|со|из|у)\s/.test(prefix)) source = prefix.replace(/^(?:с|со|из|у)\s+/u, '');
        else if (prefix && !target && !tokens(prefix).every(t => modifiers.has(t))) {const before=relation(prefix);target=before.direct;source=before.source||source;}
        if (['GIVE','SHOW'].includes(h.intent)) {
          const receiver = (context.people || []).find(n => matches(target, n.name));
          if (receiver) {
            recipient = receiver.name;
            target = tidy(target.split(/\s+/).filter(t => !tokens(receiver.name).map(stem).includes(stem(t))).join(' '));
          }
        }
        target = tidy(target.replace(/^\s*(?:в|на|под|за|к|ко|до)\s+/u, '').replace(/\s+(?:возле|около|рядом с)\s+.*$/u, ''));
        if(!target&&h.intent==='INSPECT'&&h.method==='examine')target='focused_entity';
        else if (['INSPECT','SEARCH'].includes(h.intent) && (!target || /^(?:вокруг|кругом|обстановку|обстановка|помещение|помещении|комнату|место|все|окрестности|здесь|по сторонам)$/u.test(target))) target = 'current_location';
        if (/^(?:его|ее|это|этот предмет|этим|им|ней)$/u.test(target)) target = 'focused_entity';
      }
    }
    return {target:target || null, destination, source, recipient, placement, method:target==='current_location'&&h.method==='examine'?'survey':h.method || null, tool, expectedEffect:effect, manner:[...new Set([...(h.manner ? [h.manner] : []), ...modifiersIn(text)])]};
  }
  function matches(query, label) {
    const a = tokens(query).map(stem), b = tokens(label).map(stem);
    return b.some(w => w.length >= 3 && a.includes(w));
  }
  function requested(nested,actor,raw){
    const passive=['negated','question','intention','hypothetical','speech','report'].includes(nested.mode);
    return {...nested,raw,mode:passive?nested.mode:'request',actor,recipient:nested.recipient||(nested.intent==='GREET'?'player':null)};
  }
  function step(text, context, inherited) {
    const raw = String(text || '').trim();
    // Idioms and existing specialised plans retain their handlers, never a physical keyword inside them.
    const idiom = /(?:откры(?:ть|ваю)\s+(?:рот|душу|сердце)|поднима(?:ю|ть)\s+бров|выйти\s+из\s+себя|взять\s+слово)/u.test(norm(raw));
    const request = /^(?:я\s+)?(?:прошу|попрошу|попросить|договариваюсь|предлагаю)\s/u.test(norm(raw));
    if(/^[а-я-]+[:,]\s*(?:вынеси|перенеси|унеси|спрячь)/u.test(norm(raw)))return {raw,intent:'LEGACY',recognized:false,mode:'request',legacyRequest:true,actor:'player'};
    if (/^(?:ищу|найти|поищу)\s+(?:работу|подработку|знакомства)|^(?:забираю|получаю)\s+(?:плату|зарплату)|^(?:вручаю|доставляю)\s+посылку/u.test(norm(raw)))return {raw,intent:'LEGACY',recognized:false,mode:mode(raw,null,inherited),actor:'player'};
    if (request && /вынест|перенест|унест|спрят/.test(norm(raw))) return {raw,intent:'LEGACY',recognized:false,mode:'request',legacyRequest:true};
    if (request) {
      const parts = norm(raw).match(/^(?:я\s+)?(?:прошу|попрошу|попросить)\s+([^,]+?)\s+(.+)$/u);
      if (parts) {
        const nested = step(parts[2],context);
        if (nested.recognized) return requested(nested,parts[1],raw);
      }
    }
    const direct = norm(raw).match(/^([а-я-]+)\s*[:,]\s*(.+)$/u);
    if (direct && !modifiers.has(direct[1])) {
      const nested = step(direct[2],context);
      if (nested.recognized) return requested(nested,direct[1],raw);
    }
    const vocative=norm(raw).match(/^(.+?),\s*([а-я-]+(?:\s+[а-я-]+)?)$/u);
    if(vocative&&(context.people||[]).some(n=>sameName(vocative[2],n.name))&&/^(?:поздоровайся|поздоровайтесь|поприветствуй|поприветствуйте|приветствуй|приветствуйте)(?:\s|$)/u.test(vocative[1])){
      const nested=step(vocative[1],context);return requested(nested,vocative[2],raw);
    }
    const h = idiom ? null : head(raw,context);
    const result = {raw,intent:h?.intent || 'LEGACY',recognized:Boolean(h),mode:mode(raw,h,inherited,context),actor:'player',...slots(raw,h,context)};
    if(!h&&!idiom&&!context.legacyStarts?.(raw)&&['execute','attempt'].includes(result.mode)){
      const lead=tokens(raw).find(word=>!modifiers.has(word));
      if(lead&&/(?:ться|ть|ти|юсь|ю)$/u.test(lead)){result.intent='UNKNOWN';result.unsupportedVerb=lead;}
    }
    if(result.mode==='speech'&&result.intent==='TALK'){result.recipient=null;result.target=null;result.utterance=raw;}
    if(result.mode==='report')result.actor=tidy(h.prefix)||tokens(raw).find(w=>['он','она','они','ты','вы'].includes(w))||'unknown';
    if (h) {result.verb=h.word;result.canonical=h.canonical;result.variant=h.variant || null;if(h.correction)result.correction=h.correction;}
    const spatial=root.StorySpatial;
    if(result.intent==='MOVE'&&result.destination&&!['outside','previous_location'].includes(result.destination)){
      const reference=spatial.descriptor(result.destination);
      if(reference||context.memory&&!spatial.location(context.memory,result.destination)&&spatial.entities(context.memory,result.destination).length){result.intent='APPROACH';result.target=result.destination;result.destination=null;}
    }
    if(['APPROACH','INSPECT','SEARCH','OPEN','CLOSE'].includes(result.intent)&&result.target){
      const reference=spatial.descriptor(result.target);if(reference)Object.assign(result,reference);
    }
    if(result.intent==='APPROACH'){
      result.scope='local';
      const place=!result.part&&context.memory&&spatial.location(context.memory,result.target);
      if(place){result.intent='MOVE';result.scope='world';result.destination=place.name;result.target=null;}
    }else if(result.intent==='MOVE')result.scope='world';
    // Lifting the loose grate is a local environmental action, not picking it up.
    if (h?.intent==='TAKE' && /решетк/.test(norm(result.target)) && /^подн|приподн/.test(h.word)) result.recognized=false;
    return result;
  }
  function starts(text,context) {
    const q = tidy(text).replace(/^(?:затем|потом|после этого|сначала)\s+/iu,'');
    return Boolean(head(q,context)) || /^(?:я\s+)?(?:прошу|попрошу|попросить|не\s|хочу\s|меня зовут|говорю|шепчу|привет|танцую|ломаю|беру|изготавливаю|устанавливаю|превращаю)/u.test(norm(q)) || Boolean(context.legacyStarts?.(q));
  }
  function split(text,context) {
    const chunks=[];let part='',quote=null,dependent=false;
    const flush=()=>{if(tidy(part))chunks.push({raw:part.trim(),dependsOnPrevious:dependent});part='';};
    const source=String(text || '').trim().slice(0,6000).replace(/(беру|взять|забираю|отдаю|бросаю)\s+не\s+[^,]+,\s*а\s+([^.!?]+)/giu,'$1 $2');
    // A request to carry/hide/open is one negotiated NPC plan in the existing simulation.
    if ((/^(?:я\s+)?(?:прошу|договариваюсь|предлагаю|попрошу|попросить)/u.test(norm(source))||/^[а-я-]+[:,]\s*(?:вынеси|перенеси|унеси|спрячь)/u.test(norm(source))) && /вынест|перенест|унест|спрят|вынеси|перенеси|унеси|спрячь/.test(norm(source))) return [{raw:source,dependsOnPrevious:false}];
    for(let i=0;i<source.length;i++){
      const char=source[i];
      if(!quote&&['«','“','"'].includes(char))quote=char==='«'?'»':char==='“'?'”':'"';else if(quote===char)quote=null;
      if(!quote){
        const connector=source.slice(i).match(/^(?:,\s*|\s+)(?:а затем|а потом|затем|потом|после этого|после чего|но|а|и)\s+/iu);
        const introductory=tokens(part).length>0&&tokens(part).every(t=>modifiers.has(t));
        const comma=char===','&&!introductory&&starts(source.slice(i+1),context);
        const embeddedQuestion=comma&&head(part,context)?.intent==='TALK'&&/^(?:можно|могу|как|что|где|когда|почему|кто|зачем)/u.test(norm(source.slice(i+1)));
        const coordinatedQuestion=connector&&/^\s*(?:,\s*)?и\s+$/u.test(connector[0])&&head(part,context)?.intent==='TALK'&&/,\s*(?:можно|могу|как|что|где|когда|почему|кто|зачем)/u.test(norm(part));
        const vocative=comma&&(context.people||[]).some(person=>sameName(part,person.name))&&head(source.slice(i+1),context);
        if((connector&&!coordinatedQuestion&&starts(source.slice(i+connector[0].length),context))||comma&&!embeddedQuestion&&!vocative){
          flush();dependent=connector?!/(?:^|\s)(?:а|но)\s*$/.test(connector[0]):true;
          i+=connector?connector[0].length-1:0;continue;
        }
      }
      part+=char;
      if(!quote&&/[;\n.!?]/.test(char)&&!/[.!?]/.test(source[i+1]||' ')){flush();dependent=false;}
    }
    flush();return chunks;
  }
  function resolve(text, context = {}) {
    const conditional=String(text).match(/^\s*пока\s+([^,]+?)\s+(работает|занят|отвернулся|спит),\s*(.+)$/iu);
    const condition=conditional?{type:'npc_attention',name:conditional[1],attention:/спит/iu.test(conditional[2])?'asleep':'busy'}:null;
    const chunks=split(conditional?conditional[3]:text,context);const steps=[];
    for(const chunk of chunks){
      const previous=steps.at(-1);
      const inherited=chunk.dependsOnPrevious&&previous&&['intention','question','hypothetical','negated','speech','report','request'].includes(previous.mode)?previous.mode:null;
      const parsed=step(chunk.raw,context,inherited);
      if(inherited&&!/^(?:я\s+)?(?:не\s|хочу\s|можно\s|попрошу\s|прошу\s)/u.test(norm(chunk.raw)))parsed.mode=inherited;
      if(inherited==='request'&&previous.actor!=='player'&&parsed.actor==='player'){parsed.actor=previous.actor;if(parsed.intent==='GREET'&&!parsed.recipient)parsed.recipient='player';}
      if(parsed.target==='focused_entity'&&chunk.dependsOnPrevious&&previous?.intent==='MOVE'){parsed.target='current_location';if(parsed.method==='examine')parsed.method='survey';}
      steps.push({...parsed,...(condition?{condition,originalInput:text}:{}),index:steps.length,dependsOnPrevious:chunk.dependsOnPrevious});
    }
    if(!steps.length)steps.push({...step('',context),index:0,dependsOnPrevious:false});
    return {mode:steps.every(s=>s.mode===steps[0].mode)?steps[0].mode:'mixed',steps};
  }
  function context(memory) {
    return {entities:memory.entities || [],people:Object.values(memory.world?.npcs || {}),locations:memory.world?.locations || [],memory};
  }
  function sameName(a,b){return root.StorySpatial.same(a,b);}
  function bind(original,memory) {
    const result=clone(original),ctx=context(memory);
    const candidates=(query,values)=>{
      const q=tokens(query).map(stem);
      return values.map(e=>{const labels=[e.label||e.name,...(e.aliases||[])];let score=0;for(const label of labels){const words=tokens(label).map(stem);const common=q.filter(w=>w.length>=3&&words.includes(w)).length;score=Math.max(score,common*3+(norm(label)===norm(query)?20:0));}return {e,score};}).filter(v=>v.score>0).sort((a,b)=>b.score-a.score);
    };
    if(result.actor!=='player')result.actorId=candidates(result.actor,ctx.people)[0]?.e.id || null;
    if(result.recipient)result.recipientId=result.recipient==='player'?'player':candidates(result.recipient,ctx.people)[0]?.e.id || null;
    if(result.source){const owners=candidates(result.source,ctx.people);const sources=candidates(result.source,ctx.entities);result.sourceId=sources[0]?.e.id || owners[0]?.e.id || null;}
    if(result.tool)result.toolId=candidates(result.tool,ctx.entities)[0]?.e.id||null;
    if(!result.target&&['OPEN','CLOSE'].includes(result.intent)){
      const present=e=>e.known&&!e.hidden&&!e.destroyed&&(e.location===memory.place||e.location==='inventory');
      const focus=ctx.entities.find(e=>e.id===memory.focus&&['barrier','clue'].includes(e.kind)&&present(e));
      const choices=focus?[focus]:ctx.entities.filter(e=>e.kind==='barrier'&&present(e));
      if(choices.length===1)result.targetId=choices[0].id;
      else if(choices.length>1){result.ambiguous=true;result.target=choices.map(e=>e.label).join(' / ');}
    }
    if(result.target==='focused_entity'){
      if(memory.focus)result.targetId=memory.focus;
      else if(memory.world.player.attention){result.targetRef=clone(memory.world.player.attention);result.targetLabel=result.targetRef.label;if(['OPEN','CLOSE'].includes(result.intent)&&result.targetRef.part==='lid'){result.targetId=result.targetRef.parentId;result.targetLabel=ctx.entities.find(e=>e.id===result.targetId)?.label;}return result;}
      else {result.target='current_location';result.locationId=memory.world.player.location;if(result.method==='examine')result.method='survey';}
    }
    else if(result.target&&result.target!=='current_location'&&!['TALK','GREET'].includes(result.intent)){
      const descriptor=result.part?result:root.StorySpatial.descriptor(result.target);
      if(descriptor){
        Object.assign(result,descriptor);const resolved=root.StorySpatial.bind(memory,result);
        if(resolved?.reference){result.targetRef=resolved.reference;result.targetLabel=resolved.reference.label;if(resolved.reference.kind==='entity')result.targetId=resolved.reference.id;else if(['OPEN','CLOSE'].includes(result.intent)&&resolved.reference.part==='lid')result.targetId=resolved.reference.parentId;}
        else result.referenceError=resolved?.error||'unknown_spatial_target';
        if(!result.targetId)return result;
      }
      const namedPlace=!result.part&&['INSPECT','SEARCH'].includes(result.intent)&&root.StorySpatial.location(memory,result.target);
      if(namedPlace){result.locationId=namedPlace.id;result.target=namedPlace.name;result.targetId=null;if(result.method==='examine')result.method='survey';return result;}
      let found=result.targetId?ctx.entities.filter(e=>e.id===result.targetId).map(e=>({e,score:100})):candidates(result.target,ctx.entities);
      if(result.sourceId){const sourced=found.filter(v=>v.e.containerId===result.sourceId||v.e.supportId===result.sourceId||v.e.location===result.sourceId);if(sourced.length)found=sourced;}
      const best=found[0]?.score;const equal=found.filter(v=>v.score===best);
      const local=equal.filter(v=>v.e.location===memory.place||v.e.location==='inventory'||v.e.location===memory.world?.activeNpcId);
      if(local.length)found=local;
      if(result.intent==='TAKE'&&/\sи\s|,/.test(result.target)){result.targetIds=found.map(v=>v.e.id);result.ambiguous=false;return result;}
      result.ambiguous=found.length>1&&found[0].score===found[1].score;
      result.targetId=result.ambiguous?null:found[0]?.e.id || null;
    }
    if(result.targetId){const e=ctx.entities.find(e=>e.id===result.targetId);if(e)result.targetLabel=e.label;}
    if(result.intent==='APPROACH'){
      if(result.targetId)result.targetRef=root.StorySpatial.entityRef(ctx.entities.find(e=>e.id===result.targetId));
      else result.referenceError||='unknown_spatial_target';
    }
    if(result.target==='current_location')result.locationId=memory.world?.player.location;
    if(result.destination){
      if(result.destination==='outside')result.destinationId=memory.world?.outdoorId;
      else if(result.destination==='previous_location')result.destinationId=memory.world?.player.previousLocation;
      else result.destinationId=root.StorySpatial.location(memory,result.destination)?.id || null;
    }
    if(['INSPECT','SEARCH'].includes(result.intent)&&result.target!=='current_location'&&!result.targetId){
      const place=!result.part&&root.StorySpatial.location(memory,result.target);
      if(place){result.locationId=place.id;result.target=place.name;}
    }
    return result;
  }
  function command(step) {
    const target=step.targetLabel || (step.target==='focused_entity'?'его':step.target==='current_location'?'':step.target) || '';
    if(step.intent==='MOVE')return step.variant==='return'&&step.destination==='previous_location'?'Возвращаюсь':step.destination==='outside'?'Выхожу':step.destination?'Иду в '+step.destination:step.canonical || 'Иду';
    if(step.intent==='APPROACH')return 'Подхожу к '+target;
    if(step.intent==='GREET')return 'Приветствую'+(step.recipient&&step.recipient!=='player'?' '+step.recipient:'');
    if(['INSPECT','SEARCH'].includes(step.intent)){const detail=step.method==='check'&&/(?:^|\s)(?:ход|работу)(?:\s|$)/.test(step.target || '')?step.target:target;return (({survey:'Осматриваюсь',listen:'Слушаю',check:'Проверяю',read:'Читаю',search:'Обыскиваю'})[step.method] || 'Осматриваю')+(detail?' '+detail:'');}
    if(step.intent==='TALK')return step.variant==='ask'||step.mode==='speech'||step.utterance?step.raw:step.recipient?'Говорю с '+step.recipient:'Поговорим';
    const verb=({TAKE:'Беру',OPEN:'Открываю',CLOSE:'Закрываю',USE:'Использую',GIVE:'Отдаю',DROP:'Кладу',SHOW:'Показываю',REPAIR:'Чиню'})[step.intent];
    return (verb || step.canonical || '')+(target?' '+target:'')+(step.placement?' '+step.placement:'')+(step.tool?' с помощью '+step.tool:'')+(step.expectedEffect?' чтобы '+step.expectedEffect:'');
  }
  root.StorySemantic={resolve,bind,command,context};
})(globalThis);
