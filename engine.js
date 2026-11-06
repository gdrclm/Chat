(function (root) {
  'use strict';
  const fresh = () => ({ turn: 0, trust: 0, tension: 0, stage: 0, inventory: [], facts: {}, seen: {}, lastIntent: '', lastReply: '' });
  const rules = [
    ['refuse', /не\s+(?:буду|хочу|стану)|отказыва|не соглас/iu],
    ['apology', /прости|извини/iu], ['threat', /убью|удар|угрожа|напада|сломаю/iu],
    ['help', /помоги|помощ|что делать|как быть/iu],
    ['greet', /привет|здравств|добрый (?:день|вечер)/iu],
    ['thanks', /спасибо|благодар/iu], ['name', /меня зовут|мо[её] имя/iu],
    ['remember', /помнишь|что ты знаешь обо мне|как меня зовут/iu],
    ['take', /беру|взять|поднимаю|забираю/iu], ['use', /использ|примен|откры|отпер/iu],
    ['inventory', /инвентарь|что у меня|мои вещи/iu],
    ['inspect', /осмотр|осматр|смотр|изуч|ищу|обыск|вокруг/iu],
    ['leave', /ухожу|уйти|выхожу|покидаю|до свидания/iu],
    ['agree', /^(?:да|ладно|хорошо|согласен|согласна|пойд[её]м|продолжай)[.!\s]*$/iu],
    ['fear', /боюсь|страшно|страх/iu], ['goal', /хочу|моя цель|мне нужно/iu],
    ['identity', /кто ты|тебя зовут/iu], ['question', /\?|почему|зачем|расскажи/iu]
  ];
  function profile(config) {
    const world = config.world || '';
    const name = (config.character || '').match(/^\s*([^—–\n:.]{1,40})(?:\s*[—–:]|\s+-\s+)/u)?.[1]?.trim() || 'Собеседник';
    const genre = /космо|корабл|станци|робот/iu.test(world) ? 'space' : /школ|универ|кампус/iu.test(world) ? 'school' : /лес|дракон|замок|маг|лавк|воспоминан/iu.test(world) ? 'fantasy' : 'mystery';
    const scenes = {
      space: { object: 'бортовой журнал', tool: 'карта доступа', obstacle: 'заблокированный шлюз', clue: 'В журнале есть координаты аварийного маяка.', ending: 'Шлюз открывается. По ту сторону мигает сигнал: кто-то ещё ждёт помощи.' },
      school: { object: 'записка', tool: 'ключ от архива', obstacle: 'закрытая дверь архива', clue: 'На записке указан номер старого личного дела.', ending: 'Дверь открывается. На столе лежит дело с вырванной первой страницей.' },
      fantasy: { object: 'запечатанное письмо', tool: 'серебряный ключ', obstacle: 'запертый ларец', clue: 'Под печатью проступают слова: «Правда ждёт того, кто решится открыть ларец».', ending: 'Ларец открывается. Внутри — флакон с мерцающим воспоминанием и записка: «Теперь выбирай, сохранить его или отпустить».' },
      mystery: { object: 'записная книжка', tool: 'старый ключ', obstacle: 'закрытый сейф', clue: 'В книжке отмечено время встречи и зачёркнуто знакомое имя.', ending: 'Сейф открывается. Внутри лежит фотография: на обороте назначена новая встреча.' }
    };
    return { name, ...scenes[genre], warm: /добра|мягк|забот|дружелюб/iu.test(config.character || ''), cold: /сдержан|холод|суров|язв|юмор/iu.test(config.character || '') };
  }
  function reply(config, previous, input) {
    const s = JSON.parse(JSON.stringify(previous || fresh()));
    const p = profile(config); const text = input.trim().slice(0,6000);
    const intent = rules.find(([, re]) => re.test(text))?.[0] || 'unknown';
    s.turn++; s.seen[intent] = (s.seen[intent] || 0) + 1;
    const statedName = text.match(/(?:меня зовут|мо[её] имя)\s+([A-Za-zА-Яа-яЁё-]{1,40})/iu)?.[1];
    if (statedName) s.facts.name = statedName;
    const goal = text.match(/(?:хочу|мне нужно|моя цель\s*[—:–]?)\s+(.{1,180})/iu)?.[1];
    if (goal && intent !== 'refuse') s.facts.goal = goal;
    let line = '';
    const next = () => s.stage === 0 ? `Рядом лежит ${p.object}. Можно осмотреть его или спросить о нём.` : s.stage === 1 ? `Теперь можно взять ${p.tool} или продолжить разговор.` : s.stage === 2 ? `У вас есть ${p.tool}. Впереди — ${p.obstacle}.` : 'Можно обсудить находку, уйти или начать новую историю.';
    switch (intent) {
      case 'name': line = statedName ? `«${statedName}. Запомню. Что привело вас сюда?»` : '«Как мне к вам обращаться?»'; break;
      case 'remember': line = `«${s.facts.name ? `Вас зовут ${s.facts.name}.` : `Вы рассказали о себе: ${config.player || 'пока немного'}.`} ${s.facts.goal ? `Вы хотели: ${s.facts.goal}.` : 'Свою цель вы ещё не назвали.'}»`; break;
      case 'greet': s.trust++; line = `«Здравствуйте${s.facts.name ? ', ' + s.facts.name : ''}. ${s.turn === 1 ? 'Я ждала, когда кто-нибудь нарушит эту тишину.' : 'Я всё ещё здесь. Продолжим?'}»`; break;
      case 'identity': line = `«${config.character || 'Я ваш проводник в этой истории.'}»`; break;
      case 'goal': s.trust++; line = `«Значит, ваша цель — ${s.facts.goal || 'найти свой путь'}. Начнём с того, что можно проверить».\n${next()}`; break;
      case 'inspect':
        if (s.stage === 0) { s.stage = 1; line = `Вы замечаете ${p.object}. ${p.clue}\nРядом — ${p.tool}.`; }
        else line = `${p.clue}\n${next()}`;
        break;
      case 'take':
        if (s.stage === 0) line = `«Сначала осмотритесь. Брать вещи вслепую — плохая привычка».\n${next()}`;
        else if (/не\s+(?:беру|брать|возьму)/iu.test(text)) line = 'Предмет остаётся на месте. Собеседник не настаивает.';
        else if (!s.inventory.includes(p.tool)) { s.inventory.push(p.tool); s.stage = Math.max(s.stage, 2); line = `Теперь у вас есть ${p.tool}.\n«Не потеряйте. Возможно, он откроет путь дальше».`; }
        else line = `У вас уже есть ${p.tool}.\n${next()}`;
        break;
      case 'use':
        if (s.stage >= 3) line = `Путь уже открыт. ${p.ending}`;
        else if (!s.inventory.includes(p.tool)) line = `Не удаётся открыть: нужен ${p.tool}.\n${next()}`;
        else { s.stage = 3; line = p.ending; }
        break;
      case 'inventory': line = s.inventory.length ? `При вас: ${s.inventory.join(', ')}.` : `Вы ещё ничего не подобрали. О себе вы указали: ${config.player || 'нет описания'}.`; break;
      case 'threat': s.trust -= 2; s.tension += 2; line = 'Собеседник отступает, преграждая путь. «Угрозы не помогут. Вы хотите получить ответ или поссориться?»'; break;
      case 'apology': s.trust++; s.tension = Math.max(0,s.tension-2); line = '«Принимается. Давайте попробуем ещё раз». Напряжение понемногу спадает.'; break;
      case 'thanks': s.trust++; line = '«Спасибо, что сказали. Здесь редко благодарят». Взгляд становится мягче.'; break;
      case 'refuse': s.trust--; line = '«Хорошо. Решение за вами. Можем поговорить, осмотреться или разойтись». Ничто не заставляет вас продолжать.'; break;
      case 'fear': s.trust++; line = '«Не нужно торопиться. Скажите, что именно вас пугает. Я выслушаю». Собеседник оставляет вам пространство.'; break;
      case 'leave': line = '«Я не стану вас удерживать. Если захотите вернуться, разговор продолжим отсюда». Путь наружу свободен.'; break;
      case 'help': case 'agree': line = `«Давайте по порядку». ${next()}`; break;
      case 'question':
        if (/письм|записк|журнал|книжк|ларец|сейф|шлюз|архив/iu.test(text)) line = `«${p.clue} Но проверить это сможете только вы».\n${next()}`;
        else if (/довер|секрет|скрыва/iu.test(text)) line = s.trust >= 2 ? '«Я скрываю, что уже пыталась пройти этот путь. У меня не получилось. Поэтому я здесь». Это признание даётся нелегко.' : '«Доверие не возникает от одного вопроса. Дайте мне повод рассказать больше».';
        else line = `«Вы спрашиваете: “${text.slice(0,180)}”. У меня пока нет точного ответа. Давайте искать то, что можно проверить».\n${next()}`;
        break;
      default: line = `Собеседник обдумывает ваши слова: «${text.slice(0,180)}».\n«Вы хотите что-то узнать, сделать или рассказать о себе? Скажите чуть конкретнее».\n${next()}`;
    }
    s.trust = Math.max(-5,Math.min(5,s.trust)); s.tension = Math.min(5,s.tension);
    const manner = s.tension >= 2 ? 'Голос звучит настороженно.' : p.warm ? 'В голосе чувствуется участие.' : p.cold ? 'Ответ звучит сдержанно, после короткой паузы.' : 'Собеседник внимательно следит за разговором.';
    const repeat = intent === s.lastIntent && s.seen[intent] > 1 ? '«Мы уже касались этого. Попробуем взглянуть ещё раз».\n' : '';
    const opening = s.turn === 1 ? `${config.world || 'История начинается в незнакомом месте.'}\n\n` : '';
    const output = `${opening}${p.name}. ${manner}\n${repeat}${line}`;
    s.lastIntent = intent; s.lastReply = output;
    return { text: output, memory: s };
  }
  root.StoryEngine = { fresh, reply, profile };
})(globalThis);
