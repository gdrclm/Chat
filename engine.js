/* Original narrative rules. See NARRATIVE.md for design references and limits. */
(function (root) {
  'use strict';
  const VERSION = 3;
  const clean = value => String(value || '').trim();
  const norm = value => clean(value).toLowerCase().replace(/ё/g, 'е').replace(/[«»“”"*]/g, '');
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min = -5, max = 5) => Math.max(min, Math.min(max, value));
  const words = text => norm(text).match(/[a-zа-я0-9-]+/g) || [];
  const stem = word => norm(word).replace(/(?:иями|ями|ами|ого|ему|ому|ыми|ими|ов|ев|ей|ия|ие|ий|ый|ой|ая|яя|ую|юю|ам|ям|ах|ях|ом|ем|а|я|ы|и|у|ю|е|о)$/u, '');
  const hash = value => [...value].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17).toString(36);
  const fields = text => Object.fromEntries(clean(text).split(/\n|;/).map(line => {
    const i = line.indexOf(':'); return i > 0 ? [norm(line.slice(0, i)), clean(line.slice(i + 1))] : [];
  }).filter(pair => pair.length));
  const signature = config => JSON.stringify(['world', 'character', 'player', 'canon'].map(k => clean(config[k])));
  const fresh = () => ({ version: VERSION, turn: 0, trust: 0, tension: 0, stage: 0, inventory: [], facts: {}, seen: {}, lastIntent: '', lastReply: '', entities: [], journal: [], notes: [], threads: [], used: {}, clocks: { danger: 0, discovery: 0 }, focus: null, pending: null, npcPresent: true, configSig: '' });

  // Words identify objects, not verbs: "take a cup" must not become "take the key".
  const OBJECTS = [
    ['ключ', 'ключ|ключик', 'tool'], ['карта доступа', 'карточк|пропуск|карт.*доступ', 'tool'],
    ['компас', 'компас', 'tool'], ['верёвка', 'веревк|канат|шнур', 'tool'], ['нож', 'нож|кинжал', 'weapon'],
    ['меч', 'меч|клинок', 'weapon'], ['пистолет', 'пистолет|револьвер', 'weapon'], ['бластер', 'бластер', 'weapon'],
    ['фонарь', 'фонар|светильник', 'tool'], ['телефон', 'телефон|смартфон', 'tool'], ['рация', 'раци', 'tool'],
    ['отмычка', 'отмыч', 'tool'], ['зеркало', 'зеркал', 'prop'], ['ложка', 'ложк', 'prop'],
    ['чашка', 'чашк|кружк', 'prop'], ['бутылка', 'бутыл', 'prop'], ['флакон', 'флакон', 'prop'],
    ['письмо', 'письм|конверт', 'clue'], ['записка', 'записк', 'clue'], ['книга', 'книг', 'clue'],
    ['журнал', 'журнал|дневник', 'clue'], ['фотография', 'фотограф|фото', 'clue'], ['документ', 'документ|досье|дело', 'clue'],
    ['монета', 'монет|деньг|золот', 'money'], ['кольцо', 'кольц|перстень', 'prop'], ['камень', 'камень|камня|камнем|кристалл', 'prop'],
    ['еда', 'ед[ауеы]|хлеб|яблок|бутерброд', 'food'], ['вода', 'вод[ауы]|водой', 'food'],
    ['стол', 'стол', 'fixed'], ['стул', 'стул|стуль', 'prop'], ['дверь', 'двер', 'barrier'],
    ['окно', 'окн', 'fixed'], ['ларец', 'ларец|ларц|сундук', 'barrier'], ['сейф', 'сейф', 'barrier'],
    ['шлюз', 'шлюз', 'barrier'], ['терминал', 'терминал|компьютер', 'fixed'], ['архив', 'архив', 'barrier'],
    ['гитара', 'гитар|лютн', 'instrument'], ['бумага', 'бумаг|лист', 'prop'], ['мел', 'мел[аоу]?$', 'tool'], ['шкаф', 'шкаф', 'barrier'], ['сумка', 'сумк|рюкзак', 'prop'], ['свеча', 'свеч', 'tool'], ['зажигалка', 'зажигалк|спичк', 'tool']
  ];
  const PLACES = [
    ['космическая станция', /станци|орбит/], ['корабль', /корабл/], ['школа', /школ/], ['университет', /университет|кампус/],
    ['лавка', /лавк/], ['лес', /(?:^|[^а-я])лес(?:[ауе]|[^а-я]|$)|лесн/], ['замок', /замок|замке|замка/], ['таверна', /таверн/],
    ['кухня', /кухн/], ['кафе', /кафе|кофейн/], ['больница', /больниц|клиник/], ['офис', /офис/],
    ['поезд', /поезд|вагон/], ['город', /город/], ['пустыня', /пустын/], ['порт', /порт/], ['деревня', /деревн/], ['дом', /(?:^|[^а-я])дом(?:[аеу]|[^а-я]|$)|квартир/]
  ];
  const THEMES = [
    { id: 'space', re: /космо|орбит|звездолет|бластер|станци|шлюз/g, place: 'станция', object: 'бортовой журнал', tool: 'карта доступа', barrier: 'шлюз', clue: 'В журнале отмечен отключённый аварийный канал.', reveal: 'Шлюз открывается. За ним работает передатчик. Сигнал можно отправить, но тогда вас заметят.', pressure: 'Аварийный индикатор меняет цвет. Времени на незаметный выход всё меньше.', mood: ['Вентиляция гудит ровно, словно ничего не случилось.', 'По металлу пробегает слабая дрожь.'] },
    { id: 'school', re: /школ|ученик|учител|урок|университет|кампус/g, place: 'учебный корпус', object: 'записка', tool: 'ключ от архива', barrier: 'архив', clue: 'В записке указан номер дела, которое убрали из общего списка.', reveal: 'За дверью — дело с пропавшей страницей. Кто-то оставил рядом копию.', pressure: 'В коридоре слышны шаги. Скоро здесь будут не только вы.', mood: ['За стеной отодвигают стул.', 'Звонок давно стих, но в коридоре ещё горит свет.'] },
    { id: 'fantasy', re: /маг|дракон|эльф|заклин|воспоминан|лавк|замок/g, place: 'лавка', object: 'запечатанное письмо', tool: 'серебряный ключ', barrier: 'ларец', clue: 'На внутренней стороне печати есть след: письмо уже открывали и запечатали снова.', reveal: 'Ларец открывается. Внутри — флакон с воспоминанием и записка: «Правду можно сохранить или отпустить».', pressure: 'Знак на печати начинает бледнеть. Чужое присутствие становится ощутимее.', mood: ['Свет задерживается на стекле дольше, чем должен.', 'Тишину нарушает едва слышный звон.'] },
    { id: 'survival', re: /апокалип|зомби|выжив|радиац|пустош|бункер/g, place: 'убежище', object: 'карта убежищ', tool: 'ржавый ключ', barrier: 'дверь склада', clue: 'На карте есть незачёркнутый маршрут к запасному выходу.', reveal: 'На складе уцелели припасы, но следы ведут к другому выходу.', pressure: 'Снаружи что-то скребёт по металлу. Шум уже привлёк внимание.', mood: ['Из щели тянет холодом.', 'Где-то капает вода; между каплями слышны шаги.'] },
    { id: 'sea', re: /пират|морск|океан|парус|капитан|палуб/g, place: 'палуба', object: 'судовой журнал', tool: 'медный ключ', barrier: 'сундук', clue: 'Координаты на последней странице исправлены другой рукой.', reveal: 'В сундуке лежит настоящая карта курса. Прежний маршрут вёл в ловушку.', pressure: 'Ветер усиливается. Незакреплённые вещи начинают скользить по настилу.', mood: ['Дерево тихо поскрипывает.', 'Соль остаётся на губах после порыва ветра.'] },
    { id: 'everyday', re: /кухн|кафе|кофе|офис|сосед|квартир|быт|романти/g, place: 'комната', object: 'записная книжка', tool: 'ключ от ящика', barrier: 'ящик стола', clue: 'Между страницами сохранилась запись о встрече, которую отменили без объяснения.', reveal: 'В ящике — неотправленное письмо. Его можно прочесть вместе или вернуть владельцу.', pressure: 'На экране вспыхивает уведомление: встречу больше нельзя откладывать.', mood: ['Снаружи идёт обычная жизнь.', 'На секунду отчётливо слышно, как тикают часы.'] },
    { id: 'mystery', re: /детектив|расслед|сыщик|улика|преступ|сейф/g, place: 'комната', object: 'записная книжка', tool: 'старый ключ', barrier: 'сейф', clue: 'В книжке зачёркнуто имя, но под нажимом сохранились буквы.', reveal: 'Сейф открывается. Внутри — фотография и адрес следующей встречи.', pressure: 'За дверью замирают шаги. Вашим разговором уже интересуются.', mood: ['В тишине становится слышен каждый шорох.', 'Свет из окна медленно смещается по полу.'] }
  ];
  function profile(config = {}) {
    const c = fields(config.canon); const charFields = fields(config.character);
    const world = clean(config.world); const all = norm(world);
    const scored = THEMES.map(t => [t, (all.match(t.re) || []).length]);
    scored.sort((a, b) => b[1] - a[1]);
    const theme = scored[0][1] ? scored[0][0] : THEMES[6];
    const descriptor = clean(config.character);
    const guessedName = descriptor.match(/^\s*([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё -]{0,34}?)\s*(?:[—–:]|\s-\s)/u)?.[1];
    const name = c['имя персонажа'] || charFields['имя'] || guessedName || descriptor.match(/^([А-ЯЁ][а-яё]{1,24})(?:\s|$)/u)?.[1] || 'Собеседник';
    const place = c['место'] || fields(world)['место'] || PLACES.find(([, re]) => re.test(all))?.[0] || theme.place;
    const motive = c['цель персонажа'] || charFields['цель'] || descriptor.match(/(?:хочет|стремится|мечтает)\s+([^.!?\n]+)/iu)?.[1] || 'понять, можно ли вам довериться';
    const secret = c['секрет'] || charFields['секрет'] || 'кто-то уже искал эту находку раньше, и этот след намеренно скрыли';
    const traits = norm(descriptor);
    const explicitlyNoMagic = /(?:без магии|магии нет|магия (?:не существует|запрещена)|никакой магии)/.test(norm(world + '\n' + config.canon));
    return { ...theme, tool:c['инструмент'] || theme.tool, clue:c['улика'] || theme.clue, reveal:c['развязка'] || theme.reveal, genre: theme.id, name, place, motive, secret, canon: c,
      female: /[ая]$/i.test(name) && !/^(?:Никита|Илья|Кузьма|Савва|Лука)$/i.test(name),
      warm: /добр|мягк|забот|дружелюб|ласков|вежлив/.test(traits), cold: /сдержан|холод|суров|замкнут/.test(traits),
      ironic: /юмор|сарказм|язв|ирони/.test(traits), timid: /робк|трус|боязл|пуглив/.test(traits),
      pragmatic: /практич|корыст|расчетлив|делов/.test(traits), magic: !explicitlyNoMagic && /маг|фэнтези|дракон|эльф|заклин|волшеб/.test(norm(world+' '+(c['правила']||''))),
      rules: c['правила'] || c['правило'] || c['запрет'] || '', title: c['название'] || place };
  }
  function objectKind(label) { return OBJECTS.find(([, re]) => new RegExp(re, 'i').test(norm(label)))?.[2] || 'prop'; }
  function addEntity(s, label, options = {}) {
    label = clean(label).slice(0, 100); if (!label) return null;
    const id = hash(norm(label));
    let item = s.entities.find(e => e.id === id);
    if (!item) { item = { id, label, kind: objectKind(label), location: s.place, known: true, opened: false, locked:/заперт|под замком/.test(norm(label)), destroyed: false, ...options }; s.entities.push(item); }
    return item;
  }
  function fromText(s, text, location, source) {
    for (const [label, re] of OBJECTS) {
      const match = new RegExp(re, 'i').exec(norm(text));
      if (!match) continue;
      const before = norm(text).slice(Math.max(0, match.index - 22), match.index);
      if (/(?:без|нет|отсутствует|никакого|никакой)\s+(?:[а-я]+\s+)?$/.test(before)) continue;
      // Don't make "хочу найти ключ" a starting possession.
      if (source === 'player' && /(?:хочу|ищу|найти|нужен|потерял)\s+(?:[а-я]+\s+)?$/.test(before)) continue;
      const item = addEntity(s, label, { location, source });
      if (location === 'inventory' && !s.inventory.includes(item.label)) s.inventory.push(item.label);
    }
  }
  function log(s, kind, text) {
    if (s.journal.at(-1)?.text !== text) s.journal.push({ turn: s.turn, kind, text: clean(text).slice(0, 300) });
    s.journal = s.journal.slice(-60);
  }
  function init(config, previous) {
    const s = { ...fresh(), ...clone(previous || {}) };
    s.version = VERSION;
    for (const k of ['facts', 'seen', 'used']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
    for (const k of ['inventory', 'entities', 'journal', 'threads', 'notes']) if (!Array.isArray(s[k])) s[k] = [];
    s.clocks = { danger: 0, discovery: 0, ...s.clocks };
    for(const k of ['turn','trust','tension','stage'])if(!Number.isFinite(s[k]))s[k]=0;
    for(const k of ['danger','discovery'])if(!Number.isFinite(s.clocks[k]))s.clocks[k]=0;
    s.entities=s.entities.filter(e=>e && typeof e.label==='string' && typeof e.id==='string');
    s.inventory=s.inventory.filter(v=>typeof v==='string');s.notes=s.notes.filter(v=>typeof v==='string').slice(-50);
    s.journal=s.journal.filter(e=>e && typeof e.text==='string');
    s.threads=s.threads.filter(e=>e && typeof e.text==='string');
    if(!clean(s.place))s.configSig='';
    const p = profile(config);
    if (!s.configSig) {
      s.place = p.place; s.startPlace = p.place;
      const oldInventory = s.inventory.slice(); s.inventory = []; s.entities = [];
      const supplied = p.canon['предметы'] || fields(config.world)['предметы'];
      const emptyScene=/^(?:нет|пусто|—|-)$/.test(norm(supplied)) || /нет предметов|предметов нет|пустая комната|ничего нет/.test(norm(config.world));
      if(emptyScene) { /* Explicit absence is part of the canon. */ }
      else if (supplied) {
        for (const label of supplied.split(/[,|]/)) addEntity(s, label, { source: 'canon' });
        if(p.canon['преграда'])addEntity(s,p.canon['преграда'],{source:'scene',kind:'barrier',locked:true});
      } else {
        addEntity(s, p.object, { kind: 'clue', source: 'scene' });
        addEntity(s, p.tool, { kind: 'tool', known: false, source: 'scene' });
        addEntity(s, p.canon['преграда'] || p.barrier, { kind: 'barrier', locked: true, source: 'scene' });
      }
      fromText(s, config.world, s.place, 'world');
      fromText(s, config.player, 'inventory', 'player');
      for (const label of oldInventory) {
        const item = addEntity(s, label, { location: 'inventory', source: 'carried' });
        item.location = 'inventory'; if (!s.inventory.includes(item.label)) s.inventory.push(item.label);
      }
      const playerFields = fields(config.player);
      const playerName = playerFields['имя'] || clean(config.player).match(/(?:меня зовут|имя\s*[:—])\s*([А-Яа-яЁёA-Za-z-]+)/iu)?.[1];
      if (playerName) s.facts.name = playerName;
      const goal = playerFields['цель'] || clean(config.player).match(/(?:хочу|цель\s*[:—])\s*([^.!?\n]+)/iu)?.[1];
      if (goal) s.facts.goal = goal;
      s.threads = [{ id: 'desire', text: s.facts.goal || p.motive, status: 'open' }];
      if(previous?.version!==VERSION) {
        for(const e of s.entities) { if(e.kind==='barrier' && s.stage>=3){e.opened=true;e.locked=false;} if(s.stage>=1)e.known=true; }
      }
      s.configSig = signature(config);
    }
    return s;
  }
  function reframe(previous, oldConfig, newConfig) {
    const worldChanged = clean(oldConfig.world) !== clean(newConfig.world) || clean(oldConfig.canon) !== clean(newConfig.canon);
    const actorChanged = clean(oldConfig.character) !== clean(newConfig.character);
    const playerChanged = clean(oldConfig.player) !== clean(newConfig.player);
    if (!worldChanged && !actorChanged && !playerChanged) return init(newConfig, previous);
    const keep = init(oldConfig, previous); const base = fresh();
    base.turn = keep.turn; base.facts = clone(keep.facts); base.journal = keep.journal.slice(); base.notes=keep.notes.slice();
    if(worldChanged)for(const key of ['clue','secret','revelation','topic','claim'])delete base.facts[key];
    if (playerChanged) { delete base.facts.name; delete base.facts.goal; }
    else base.inventory = keep.inventory.slice();
    if (!actorChanged) { base.trust = keep.trust; base.tension = keep.tension; }
    let result;
    if (!worldChanged && !playerChanged) {
      result = keep; result.configSig = signature(newConfig);
      if (actorChanged) { result.trust = 0; result.tension = 0; result.npcPresent = true; result.pending = null; result.secretRevealed = false; delete result.facts.secret; delete result.facts.lastGift; }
    } else result = init(newConfig, base);
    log(result, 'canon', 'Вводные обновлены: ' + profile(newConfig).place + '.');
    return result;
  }

  const ACTIONS = [
    ['name', /меня зовут|мое имя|зови меня|можешь звать меня/],
    ['remember', /помнишь|вспомни|как меня зовут|что я говорил|о чем мы говорили|что я обещал|что (?:ты )?(?:знаешь|помнишь) обо мне/],
    ['inventory', /инвентарь|что у меня|мои вещи|что в карман/],
    ['canon', /^(?:в этом мире|запомни\s*[:—-]|факт\s*:|в этой истории|на самом деле|правило\s*:|у меня (?:есть|в кармане)|рядом (?:есть|стоит|лежит))/],
    ['identity', /кто ты|как тебя зовут|представься/],
    ['refuse', /не (?:хочу|буду|стану)|отказыва|не соглас|^(?:нет|неа)[.! ]*$/],
    ['apology', /прости|извини|прошу прощени/], ['thanks', /спасибо|благодар/],
    ['help', /помоги|помощ|что делать|что дальше|как продолжить|как быть|дай совет/],
    ['greet', /привет|здравств|добрый (?:день|вечер)|доброе утро/],
    ['gesture', /улыба|кива|пожимаю плеч|развожу рук|поднимаю бров|закатываю глаз|отвожу взгляд|открываю рот|сжимаю кулак|вздыха/],
    ['joke', /шучу|шутк|анекдот|смеюсь|рассмеш|подмигива/],
    ['comfort', /обнима|обнять|успокаива|утеша|поддержива|сочувств|люблю|целую|поцело/],
    ['emotion', /мне грустно|грущу|одинок|печаль|сердит|злюсь|разозли|устал|радуюсь|счастлив|мне больно/],
    ['talk', /поговор|поболт|пообщ/],
    ['fear', /боюсь|страшно|мне страш|страх|тревожно/],
    ['lie', /вру|лгу|обманыва|притворя|блеф|выдаю себя/],
    ['bargain', /предлага|торг|сделк|взамен|обмен|подкуп|договарива|убежда/],
    ['perform', /танцу|танец|пою|спою|напевая|играю на|сальто|фокус|декламиру|стих/],
    ['decision', /сохраняю воспомин|отпускаю воспомин|отпустить воспомин|сохранить воспомин/],
    ['give', /отдаю|даю|передаю|дарю|вруча/], ['drop', /бросаю|выбрасыва|роняю|кладу|оставляю/],
    ['combine', /соединя|связыва|смешива|комбиниру|мастерю/],
    ['burn', /поджига|сжига|поджечь|огнем|огонь/], ['destroy', /ломаю|разбива|выбива|взламыва|разруша|срываю|выруб/],
    ['attack', /убью|убива|удар|бью|бить|напада|атаку|стреля|пронза|режу|угрожа/],
    ['defend', /защища|блокиру|прикрыва|уклоня|отража/],
    ['hide', /пряч|скрываюсь|крадусь|подкрадыва|незаметно|маскиру/],
    ['magic', /колду|заклина|телепорт|превраща|призыва|материализ|магическ/],
    ['take', /беру|взять|возьму|поднимаю|забираю|хватаю|достаю|подбираю|краду/],
    ['close', /закрыва|закрой|запира|закрыть/], ['open', /откры|открой|отпер|отпира/],
    ['inspect', /осмотр|осматр|смотр|изуч|ищу|обыск|вокруг|читаю|прочита|проверя|разглядыва|нюхаю|слушаю|трогаю|прислушива|ощупыва/],
    ['use', /использ|примен|нажима|вставля|поворачива|активир|включа|чиню|ремонтиру/],
    ['return', /возвраща|вернуться|назад|обратно/],
    ['move', /ухожу|уйти|выхожу|покидаю|до свидания|иду|идти|пойду|направля|бегу|прыгаю|лезу|влезаю|следую|лечу|вхожу|войти/],
    ['rest', /отдыха|сплю|ложусь спать|ложусь|засыпа|сажусь/], ['eat', /ем(?: |$)|съедаю|пью|выпива|пробую на вкус/],
    ['write', /пишу|рисую|черчу|записыва/], ['knock', /стучу|стукну|звоню в дверь/],
    ['wait', /жду|подожду|молчу|молчание|пауза|\.{3}|^…$/],
    ['goal', /хочу|моя цель|мне нужно|собираюсь|планирую/],
    ['agree', /^(?:да|ага|ладно|хорошо|согласен|согласна|пойдем|продолжай|давай|сделай это)[.!\s]*$/]
  ];
  const VERBS = ['осматриваюсь','осматриваю','открываю','закрываю','поднимаю','забираю','спрашиваю','прячусь','использую','благодарю','возвращаюсь','разбиваю','предлагаю','обнимаю','отказываюсь','поджигаю','показываю','передаю','осмотреть','открыть'];
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
  function normalizedInput(text) {
    return norm(text).replace(/[а-я]{6,}/g, token => VERBS.includes(token) ? token : (VERBS.find(v => oneEdit(token, v)) || token));
  }
  function clauses(text) {
    const result = []; let part = '', quoted = false;
    const source=clean(text).slice(0,6000).replace(/(беру|отдаю|бросаю)\s+не\s+[^,]+,\s*а\s+([^.!?]+)/giu, '$1 $2');
    const actionStart = value => {
      let head=normalizedInput(value);
      for(let i=0;i<5;i++)head=head.replace(/^(?:я|мы|не|медленно|быстро|тихо|осторожно|сразу|снова|теперь|решительно)\s+/, '');
      return ACTIONS.some(([,re])=>new RegExp('^(?:'+re.source+')',re.flags).test(head)) || /^(?:говорю|шепчу|спрашиваю)/.test(head);
    };
    const flush = () => { if(part.trim())result.push(part.trim());part=''; };
    for (let i=0;i<source.length;i++) {
      const char=source[i];
      if ('«»“”"'.includes(char)) quoted = !quoted;
      if(!quoted) {
        const connector=source.slice(i).match(/^(?:,\s*|\s+)(?:а затем|а потом|затем|потом|после этого|после чего|но|а|и)\s+/iu);
        const comma=char===',' && actionStart(source.slice(i+1));
        if((connector && actionStart(source.slice(i+connector[0].length))) || comma) {
          const current=parse(part); const context=current.hypothetical?'А что если я ':current.speech?'Я говорю: ':/^(?:я )?(?:хочу|собираюсь|планирую) /.test(current.lower)?'Хочу ':'';
          flush();part=context;
          i+=connector ? connector[0].length-1 : 0;
          continue;
        }
      }
      part += char;
      if (!quoted && /[;\n.!?]/.test(char) && !/[.!?]/.test(source[i+1] || ' ')) flush();
    }
    flush();return result;
  }
  function parse(text) {
    const lower = normalizedInput(text);
    const hypothetical = /(?:что (?:будет|случится)|а что если|если (?:я|мы)|представь|допустим|могу ли|можно ли|можно было бы|я думаю,? что|если бы)/.test(lower);
    const question = /\?/.test(lower) || /^(?:а )?(?:почему|зачем|где|куда|как |когда|кто |что |расскажи|скажи|ты знаешь|можно)/.test(lower);
    const speech = /^(?:я )?(?:говорю|сказал|скажу|шепчу|спрашиваю|кричу|рассказываю)/.test(lower);
    const actionText = lower.replace(/[«“"][\s\S]*?[»”"]/g, '');
    let intent = ACTIONS.find(([, re]) => new RegExp('(?:^|[^а-яa-z])(?:' + re.source + ')', re.flags).test(lower))?.[0] || 'custom';
    if (/^(?:я )?(?:хочу|собираюсь|планирую) /.test(lower)) intent = 'goal';
    if (question && !['remember','identity','inventory','help'].includes(intent)) intent = 'question';
    if (speech && ['take','open','close','attack','destroy','magic','move','use','burn','drop'].includes(intent)) intent = /угрожа|убью/.test(lower) ? 'threat' : 'talk';
    if (speech && intent==='custom') intent='talk';
    if(/ты врешь|ты лжешь|я тебе не верю/.test(lower))intent='question';
    if(/смеюсь над тобой/.test(lower))intent='insult';
    if (/^\s*(?:я\s+)?(?:не\s+)?(?:оскорбля|дурак|идиот|заткни|ненавиж)/.test(lower)) intent = 'insult';
    if (/показыва|демонстриру/.test(lower) && !question) intent = 'show';
    const negated = /(?:^|\s)не\s+(?:(?:буду|стану|хочу|собираюсь|могу)\s+)?(?:откры|закры|бер|брат|возьм|даю|отда|брос|напад|уби|убью|бить|бью|удар|использ|трога|иду|пойду|ухожу|выхожу|колду|превращ|лома|ломат|разбива|поджиг|ем|пью|целу|обнима|угрожа|пряч|говор)/.test(actionText);
    return { text, lower, intent, hypothetical, question, speech, negated };
  }
  function matchEntity(s, text, includeAbsent = false) {
    const lower = normalizedInput(text).replace(/(?:,?\s+а|,?\s+но)\s+не[\s\S]*$/, ''); const tokens = words(lower).map(stem);
    const candidates = s.entities.filter(e => includeAbsent || !e.destroyed && (e.location === s.place || e.location === 'inventory' || e.location === 'npc'));
    const scored = candidates.map(e => {
      let score = 0;
      if (lower.includes(norm(e.label))) score += 12;
      for (const token of words(e.label).map(stem)) if (token.length >= 3 && tokens.includes(token)) score += 3;
      const key = OBJECTS.find(([label]) => label === e.label);
      if (key && new RegExp(key[1]).test(lower)) score += 3;
      return [e, score];
    }).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
    if (scored.length) return scored[0][0];
    if (/(?:^|\s)(?:его|ее|это|этот|этим|им|ней|ним|туда)(?:\s|[.!?]|$)/.test(lower)) return candidates.find(e => e.id === s.focus) || null;
    return null;
  }
  function choose(s, key, choices) {
    const count = s.used[key] || 0; s.used[key] = count + 1;
    return choices[count % choices.length];
  }
  function voice(s, p, line) {
    if (p.female) {
      const feminine = {рад:'рада',готов:'готова',услышал:'услышала',видел:'видела',слышал:'слышала',скрывал:'скрывала',рассмеялся:'рассмеялась',отвлекся:'отвлеклась',перестал:'перестала',запомнил:'запомнила',понял:'поняла',пробовал:'пробовала',мог:'могла'};
      line=line.replace(/[А-Яа-яЁё]+/gu, token => { const replacement=feminine[norm(token)];return replacement ? (token[0]===token[0].toUpperCase()?replacement[0].toUpperCase()+replacement.slice(1):replacement) : token; });
    }
    if (!s.npcPresent) return 'Вокруг нет собеседника. Вы можете вернуться или исследовать новое место.';
    const manner = s.tension >= 3 ? 'Ответ звучит настороженно.' : p.timid ? 'Голос тихий; каждое слово даётся с осторожностью.' : p.warm ? choose(s, 'warm', ['В голосе чувствуется участие.', 'Интонация становится мягче.', 'В ответе нет торопливости.']) : p.cold ? choose(s, 'cold', ['Ответ звучит сдержанно.', 'После короткой паузы следует ответ.', 'Ни одного лишнего слова.']) : '';
    return `${p.name}${manner ? '. ' + manner : ':'}\n«${line}»`;
  }
  function thread(s, text, id = hash(text)) {
    if (!s.threads.some(t => t.id === id)) s.threads.push({ id, text: clean(text).slice(0,180), status: 'open' });
    s.threads = s.threads.slice(-12);
  }
  function advance(s, amount = 1) { s.clocks.discovery = Math.min(6, s.clocks.discovery + amount); }
  function danger(s, amount = 1) { s.clocks.danger = Math.min(6, Math.max(0, s.clocks.danger + amount)); }
  function knownHere(s) { return s.entities.filter(e => e.known && !e.destroyed && e.location === s.place); }
  function addInventory(s, item) {
    item.location = 'inventory'; item.known = true;
    if (!s.inventory.includes(item.label)) s.inventory.push(item.label);
  }
  function removeInventory(s, item, destination) {
    s.inventory = s.inventory.filter(v => v !== item.label); item.location = destination;
  }
  function hint(s, p) {
    if(/поговор|познаком|подруж|любов|поболт/.test(norm(s.facts.goal)))return 'Можно поговорить о вас, о моей цели или о том, что изменило ваш день. Вещи вокруг не обязывают нас идти за ними.';
    const lock = knownHere(s).find(e => e.kind === 'barrier' && !e.opened && !e.destroyed);
    const clue = knownHere(s).find(e => e.kind === 'clue');
    if (lock) return `Пока закрыто: «${lock.label}». Можно поискать способ открыть, договориться о помощи или придумать обход.`;
    if (clue) return `Можно изучить «${clue.label}» или обсудить, кому эта находка выгодна.`;
    return s.facts.goal ? `Нить истории: ${s.facts.goal}. Что вы готовы ради этого предпринять?` : `Ваш следующий шаг определит, куда пойдёт разговор. ${p.name} пока ждёт.`;
  }
  function learnFacts(s, c) {
    if (c.hypothetical || c.negated || c.question) return;
    const name = c.text.match(/(?:меня зовут|мо[её] имя|зови меня|можешь звать меня)\s+([A-Za-zА-Яа-яЁё-]{1,40})/iu)?.[1];
    if (name) { s.facts.name = name; log(s, 'fact', `Имя героя: ${name}`); }
    const goal = c.text.match(/(?:хочу|мне нужно|моя цель\s*[:—–]?|собираюсь)\s+([^.!?\n]+)/iu)?.[1];
    if (goal && !/не хочу/.test(c.lower) && !c.question) {
      s.facts.goal = goal.slice(0,180); thread(s, s.facts.goal, 'player-goal'); log(s, 'goal', `Цель героя: ${s.facts.goal}`);
    }
  }
  function inspect(s, p, item) {
    if (item?.destroyed) return `«${item.label}» уже разрушен; прежнее состояние не восстановилось.`;
    if (item && ![s.place,'inventory','npc'].includes(item.location)) return `«${item.label}» остался в другом месте. Здесь его нет.`;
    if (item) s.focus = item.id;
    const hidden = s.entities.filter(e => !e.known && e.location === s.place && !e.destroyed);
    hidden.forEach(e => { e.known = true; });
    s.stage = Math.max(s.stage,1);
    if (item?.kind === 'clue' || !item && s.clocks.discovery === 0 && knownHere(s).some(e=>e.kind==='clue')) {
      advance(s); s.facts.clue = p.clue; log(s, 'clue', p.clue); thread(s,'Кто изменил или спрятал свидетельство?', 'evidence');
    }
    const detail = item ? item.opened ? `«${item.label}» уже открыт. ${s.facts.revelation || 'Ничто не мешает исследовать содержимое.'}` : item.kind === 'clue' ? p.clue : item.kind === 'barrier' ? `«${item.label}»: ${item.locked ? 'замок держит; можно искать ключ, отмычку или обход' : 'ничто не запирает его'}.` : `«${item.label}» можно ${item.kind === 'fixed' ? 'изучить или использовать как опору' : item.kind === 'food' ? 'взять, предложить собеседнику или попробовать' : item.kind === 'weapon' ? 'использовать как угрозу или инструмент; шум привлечёт внимание' : 'взять, показать, передать или применить в своём плане'}.` : `Место: ${s.place}. Вы замечаете: ${knownHere(s).map(e => `«${e.label}»`).join(', ') || 'следы недавнего присутствия'}.`;
    return detail + (hidden.length ? `\nПри внимательном осмотре обнаруживается: ${hidden.map(e => `«${e.label}»`).join(', ')}.` : '') + (!item && s.facts.clue ? '\n' + s.facts.clue : '');
  }
  function resolveBarrier(s, p, barrier, method) {
    const bypass=method==='обход';
    if(bypass)barrier.bypassed=true;else {barrier.opened = true; barrier.locked = false;} s.stage = Math.max(s.stage,3); advance(s,2);
    const reveal = bypass ? `Путь за «${barrier.label}» найден. Прежний замок остаётся заперт, но теперь есть обход.` : barrier.source === 'scene' ? p.reveal : `За «${barrier.label}» обнаруживается след недавнего вмешательства: кто-то был здесь раньше вас.`;
    s.facts.revelation = reveal; fromText(s,reveal,s.place,'revelation'); log(s, 'consequence', `Открыто: ${barrier.label}. Способ: ${method}.`);
    thread(s, 'Выяснить, кому предназначалась находка', 'aftermath');
    return reveal;
  }
  function question(s, p, c, item) {
    if(/о себе|твое прошлое|о чем (?:ты )?думаешь/.test(c.lower))return voice(s,p,`Я — ${p.name}. Сейчас меня занимает одно: ${p.motive}. ${s.trust>=2?'С вами я могу говорить об этом откровеннее.':'Пока я не знаю, насколько могу быть откровенен.'}`);
    if (item && (item.destroyed || ![s.place,'inventory','npc'].includes(item.location))) return inspect(s,p,item);
    if (/где/.test(c.lower)) {
      if (item) return `«${item.label}»: ${item.location === 'inventory' ? 'у вас' : item.location === 'npc' ? 'у собеседника' : item.known ? `здесь, место — ${item.location}` : 'пока не обнаружен. Поможет внимательный осмотр'}.`;
      return voice(s,p,`Мы сейчас здесь: ${s.place}. ${s.facts.goal ? 'Вы искали: ' + s.facts.goal + '.' : 'Направление ещё можно выбрать.'}`);
    }
    if (/хочешь|твоя цель|тебе нужно|добиваешь|мотив/.test(c.lower)) return voice(s,p,`Я хочу ${p.motive}. Если наши цели совпадут, мы сможем помочь друг другу.`);
    if (/довер|секрет|скрыва|лжешь|врешь/.test(c.lower)) {
      if (s.trust >= 2 || s.clocks.discovery >= 2) { s.secretRevealed = true; s.facts.secret = p.secret; log(s,'secret',p.secret); return voice(s,p,`Хорошо. Вот что я скрывал от этого разговора: ${p.secret}. Теперь это касается и вас.`); }
      return voice(s,p,`Сначала скажите, зачем вам это знать. Я хочу ${p.motive}; мне нужен повод рискнуть.`);
    }
    if (item) {
      s.focus = item.id;
      if (/откроешь|открой|поможешь|помоги/.test(c.lower) && item.kind==='barrier' && !item.opened && s.trust>=1) {
        s.pending={kind:'npc-help',id:item.id};return voice(s,p,'Я помогу открыть. Взамен выслушайте мою просьбу. Согласны?');
      }
      if (/как|откры|сделать|использ/.test(c.lower) && item.kind === 'barrier') {
        s.pending = { kind: 'offer', text: `попробовать открыть «${item.label}»`, action: 'Открываю ' + item.label };
        return voice(s,p,`Можно искать подходящий инструмент, попросить меня помочь или попробовать иной путь. Силой тоже можно, но шум станет ценой.`);
      }
      if (item.kind === 'clue') return voice(s,p,p.clue + ' Не будем считать это всей правдой: кто-то мог оставить след намеренно.');
      return voice(s,p,`«${item.label}» ${item.opened ? 'уже открыт' : item.location === 'inventory' ? 'у вас' : 'пока здесь'}. ${p.pragmatic ? 'Скажите, какую пользу вы хотите из этого извлечь.' : 'Важнее то, что вы собираетесь с этим сделать.'}`);
    }
    if (/^(?:а )?(?:почему|зачем|как)[?! ]*$/.test(c.lower) && ['attack','threat','insult'].includes(s.lastIntent))return voice(s,p,'Потому что после угроз и оскорблений мне нужно защищать свои границы. Извинение или спокойный разговор могут изменить ситуацию.');
    const topic = (/^(?:а )?(?:почему|зачем|как)[?! ]*$/.test(c.lower) && s.facts.topic) || c.text.replace(/^(?:а\s+)?(?:расскажи(?: мне)?|что (?:ты )?думаешь|ты знаешь|скажи(?: мне)?|почему|зачем|как|кто|что)\s*/iu,'').replace(/[?!.]+$/,'').slice(0,140);
    s.facts.topic = topic;
    const origin = s.facts.goal ? `Для вашей цели «${s.facts.goal}»` : `В ситуации «${s.place}»`;
    return voice(s,p,choose(s,'question',[
      `Вы спрашиваете о «${topic || 'происходящем'}». Я могу судить по тому, что видел здесь. ${origin} важнее проверить свидетельства, чем принять первое объяснение. Что вы уже знаете об этом?`,
      `У меня нет подтверждённого ответа о «${topic || 'происходящем'}». Но это может стать зацепкой. Вы хотите спросить кого-то, поискать следы или предложить свою версию?`,
      `Давайте отделим известное от догадок. ${s.facts.clue || 'Пока у нас есть только эта встреча и ваши слова.'} Как «${topic || 'этот вопрос'}» связано с тем, зачем вы пришли?`
    ]));
  }
  function execute(s, p, c, config) {
    const primary=['take','drop','give','use','combine'].includes(c.intent) ? c.text.split(/\s+(?:в|на|под|за|через|чтобы)\s+/iu)[0] : c.text;
    const item = matchEntity(s,primary,true);
    if (c.hypothetical) return voice(s,p,`Пока это только план. ${/маг|превращ|телепорт/.test(c.lower) && !p.magic ? 'В этом мире магия не подтверждена; понадобится обычный способ.' : item?.kind === 'barrier' ? 'Можно попробовать, но замок, инструмент и шум повлияют на результат.' : 'Результат будет зависеть от способа и того, что есть рядом.'} Само действие ещё не произошло.`);
    if (c.negated) { log(s,'boundary',c.text); return voice(s,p,'Хорошо. Вы этого не делаете. Можно выбрать другой способ; я не стану решать за вас.'); }
    learnFacts(s,c);
    if (!s.npcPresent && ['greet','thanks','apology','comfort','joke','insult','bargain','lie','threat','attack','perform','identity'].includes(c.intent))return 'Здесь нет прежнего собеседника. Можно вернуться к нему или установить нового участника через вводные.';
    const count = s.seen[c.intent] || 0; s.seen[c.intent] = count + 1;
    const available = item && !item.destroyed && [s.place,'inventory','npc'].includes(item.location);
    const targetText = c.text.replace(/^\s*(?:я\s+)?\S+\s*/u,'').replace(/[.!?]+$/,'').slice(0,100);
    switch (c.intent) {
      case 'name': return voice(s,p,s.facts.name ? `${s.facts.name}. Запомню. ${s.facts.goal ? 'Вы всё ещё хотите ' + s.facts.goal + '?' : 'Что привело вас сюда?'}` : 'Как мне к вам обращаться?');
      case 'remember': {
        const tokens=words(c.text).map(stem).filter(w=>w.length>3);
        const recalled=s.notes.map(note=>[note,words(note).map(stem).filter(w=>tokens.includes(w)).length]).filter(([,score])=>score>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([note])=>note);
        const extra=recalled.filter(note=>note!==s.facts.note).map(note=>'Вы говорили: '+note+'.');
        return voice(s,p,[s.facts.name ? 'Вас зовут ' + s.facts.name + '.' : 'О себе вы рассказали: ' + (config.player || 'пока немного') + '.', s.facts.goal ? 'Ваша цель — ' + s.facts.goal + '.' : '', s.facts.secret ? 'Вы уже знаете: ' + s.facts.secret + '.' : '', s.facts.promise ? 'Вы обещали: ' + s.facts.promise + '.' : '', s.facts.note ? 'Вы просили запомнить: ' + s.facts.note + '.' : '', s.facts.lastGift ? 'Вы передали мне: ' + s.facts.lastGift + '.' : ''].filter(Boolean).concat(extra).join(' '));
      }
      case 'identity': return voice(s,p,`Я — ${p.name}. Сейчас для меня важно ${p.motive}. А вы решаете, говорить со мной начистоту или держать дистанцию.`);
      case 'inventory': return s.inventory.length ? 'При вас: ' + s.inventory.map(v=>'«'+v+'»').join(', ') + '.' : 'При вас нет учтённых предметов. Можно добавить стартовые вещи в описание героя или явно сказать: «У меня есть …».';
      case 'greet': if (count === 0) s.trust++; return voice(s,p,choose(s,'greeting',[`Здравствуйте${s.facts.name ? ', ' + s.facts.name : ''}. ${s.facts.goal ? 'Вы ищете: ' + s.facts.goal + '?' : 'С чем вы пришли?'}`, 'Я здесь. Продолжим с того, на чём остановились?', 'Снова здравствуйте. За это время вы ничего не обязаны были решить.']));
      case 'thanks': if (count < 2) s.trust++; return voice(s,p,choose(s,'thanks',[p.ironic ? 'Благодарность принята. Сдачи, правда, не будет.' : 'Спасибо, что сказали. Это не прошло незамеченным.', 'Я рад, что помощь оказалась кстати. Дальше решение за вами.', 'Мы можем обойтись без церемоний. Но я вас услышал.']));
      case 'apology': s.trust = clamp(s.trust+1);s.tension=Math.max(0,s.tension-2);return voice(s,p,'Принимаю извинение. Последствия не исчезнут, но разговор можно продолжить иначе.');
      case 'refuse': s.pending=null;log(s,'boundary',c.text);return voice(s,p,'Нет — значит нет. Этот путь закрыт по вашему решению, а не вся история. Что вы предложите вместо него?');
      case 'emotion': {
        s.facts.mood=(s.feelingTurn===s.turn ? s.facts.mood+'; '+c.text : c.text).slice(0,240);s.feelingTurn=s.turn;log(s,'feeling',s.facts.mood);if(count<2)s.trust++;
        const line=/злюсь|разозли|сердит/.test(c.lower)?'Я слышу вашу злость. Хотите выговориться или что-то изменить в этой ситуации?':/радуюсь|счастлив/.test(c.lower)?'Хорошо видеть, что для вас в этой истории есть что-то светлое. Что стало причиной?':'Не нужно делать вид, что всё в порядке. Я могу выслушать. Вы хотите разговора, помощи или просто немного тишины?';
        return voice(s,p,line);
      }
      case 'fear': s.trust++;return voice(s,p,p.warm ? 'Можно остановиться и выдохнуть. Скажите, что вас пугает, и мы подумаем, как снизить риск.' : 'Страх сообщает о риске. Можно осмотреться, подготовить путь отхода или попросить поддержки.');
      case 'comfort': if (count < 3) s.trust++;s.tension=Math.max(0,s.tension-1);return voice(s,p,p.cold && s.trust<2 ? 'Не так близко, пожалуйста. Но намерение я понимаю. Лучше побудьте рядом.' : p.warm ? 'Спасибо. С вами стало легче говорить. Что бы ни случилось дальше, это я запомню.' : 'Неожиданно. Я не сразу нахожу ответ, но отстраняться не хочется.');
      case 'insult': s.trust-=1;s.tension++;return voice(s,p,p.ironic ? 'Остроумие пока уступает громкости. Попробуем говорить о деле?' : 'Мне неприятно это слышать. Я готов говорить, но не на таких условиях.');
      case 'gesture':
        if(/сжимаю кулак|закатываю глаз/.test(c.lower)){s.tension++;return voice(s,p,'Я вижу, что вы напряжены. Скажите прямо, что вас не устраивает.');}
        s.tension=Math.max(0,s.tension-1);log(s,'gesture',c.text);return voice(s,p,choose(s,'gesture',[p.ironic?'Этот взгляд красноречивее длинной речи. Что за ним стоит?':'Я замечаю ваш жест. Не буду додумывать за вас — хотите продолжить?', 'Я понял, что вы отреагировали. Если это согласие или сомнение, скажите, к чему именно оно относится.', 'Пауза и жест меняют тон разговора. Можно обойтись без спешки.']));
      case 'joke': if (s.tension>2) {s.tension--;return voice(s,p,'Не лучшее время для шутки. Но напряжение вы всё-таки немного сбили.');}if(count<2)s.trust++;return voice(s,p,choose(s,'joke',[p.ironic ? 'Неплохо. Я бы даже рассмеялся, если бы не берег репутацию.' : 'Серьёзность на мгновение отступает. Спасибо за эту паузу.', 'В нужный момент такая шутка могла бы нас выдать. Хорошо, что сейчас никто не прячется.', 'Эту версию событий стоит сохранить. Хотя бы ради финальной реплики.']));
      case 'goal': thread(s,s.facts.goal || c.text,'player-goal');return voice(s,p,`Значит, вы хотите ${s.facts.goal || 'изменить ситуацию'}. Я хочу ${p.motive}. Давайте искать, где наши интересы совпадают.`);
      case 'canon': {
        const fact=c.text.replace(/^(?:запомни|факт|правило)\s*[:—-]\s*/iu,'').slice(0,240);s.facts.note=fact;
        if(!s.notes.includes(fact))s.notes.push(fact);s.notes=s.notes.slice(-50);
        if (/у меня (?:есть|в кармане)/.test(c.lower)) {
          const labels=c.text.replace(/^.*?у меня (?:есть|в кармане)\s*/iu,'').replace(/[.!]+$/,'').split(/,| и /iu);
          for(const label of labels) {const e=addEntity(s,label,{location:'inventory',source:'declared'});if(e)addInventory(s,e);}
        } else if (/рядом (?:есть|стоит|лежит)/.test(c.lower)) {
          const label=c.text.replace(/^.*?рядом (?:есть|стоит|лежит)\s*/iu,'').replace(/[.!]+$/,'');addEntity(s,label,{source:'declared'});
        }
        if(/без магии|магии нет|магия не существует|магия существует|существует магия|магия есть|магия работает/.test(norm(fact))) {
          s.runtimeRules=fact; p.magic=!/без магии|магии нет|магия не существует/.test(norm(fact));p.rules=fact;
        }
        const newPlace=fact.match(/(?:на самом деле\s+|теперь\s+)?(?:мы|я)\s+(?:находимся\s+)?(?:в|на)\s+([^.!?]+)/iu)?.[1];
        if(newPlace) {
          s.previousPlace=s.place;s.place=newPlace.trim().slice(0,100);s.startPlace=s.place;s.npcPresent=true;s.focus=null;s.pending=null;s.runtimeWorld=fact;
          Object.assign(p,profile({...config,world:fact}));log(s,'place','Уточнено место: '+s.place);
        }
        const changed=matchEntity(s,fact);
        if(changed) {
          if(/открыт|не заперт/.test(norm(fact)) && !/не открыт/.test(norm(fact))){changed.opened=true;changed.locked=false;}
          else if(/закрыт|заперт/.test(norm(fact))){changed.opened=false;changed.locked=/заперт/.test(norm(fact));}
          if(/потерян|исчез|больше нет/.test(norm(fact)) && !/не потерян|не исчез/.test(norm(fact)))removeInventory(s,changed,'lost');
          if(/сломан|сгорел|уничтожен/.test(norm(fact)) && !/не сломан|не сгорел|не уничтожен/.test(norm(fact))){changed.destroyed=true;s.inventory=s.inventory.filter(v=>v!==changed.label);}
        }
        log(s,'canon',fact);return `Установленный факт: ${fact}.\nОн сохранён в памяти истории. Явные изменения правил и состава сцены можно также внести в «Опоры истории».`;
      }
      case 'question': return question(s,p,c,item);
      case 'inspect': return inspect(s,p,item);
      case 'help':
        if (available && item.kind==='barrier' && !item.opened && s.trust>=1) {s.pending={kind:'npc-help',id:item.id};return voice(s,p,'Я могу помочь открыть преграду. Но потом мне тоже понадобится помощь. Согласны?');}
        s.pending={kind:'offer',text:'осмотреть место вместе',action:'Осматриваюсь'};return voice(s,p,`${hint(s,p)} Я могу помочь с осмотром. Попробуем вместе?`);
      case 'agree': {
        const pending=s.pending;s.pending=null;
        if(pending?.kind==='npc-help') {
          const lock=s.entities.find(e=>e.id===pending.id && e.location===s.place && !e.destroyed);
          if(!lock || !s.npcPresent)return 'Условия изменились: помощь в прежней сцене сейчас недоступна.';
          s.facts.debt=p.motive;log(s,'promise','Помощь в обмен на будущую услугу.');
          return voice(s,p,'Договорились. Теперь я рассчитываю и на вашу помощь.')+'\n'+resolveBarrier(s,p,lock,'помощь персонажа');
        }
        if(pending?.kind==='offer')return execute(s,p,parse(pending.action),config);
        if(pending?.kind==='bargain') {s.trust++;advance(s);return voice(s,p,`Тогда договорились: ${pending.text}. Прежде чем действовать, уточним вашу часть сделки.`);}
        return voice(s,p,`Согласие услышано. ${s.facts.topic ? 'Мы обсуждали: ' + s.facts.topic + '. ' : ''}Какой именно следующий шаг вы выбираете?`);
      }
      case 'take': {
        if (!c.single && / и |,/.test(c.lower)) {
          const group=s.entities.filter(e=>matchEntity({...s,entities:[e]},c.text));
          if(group.length>1)return group.map(e=>execute(s,p,{...parse('Беру '+e.label),single:true},config)).join('\n');
        }
        if(!available || !item.known) return item?.destroyed ? 'Эта вещь разрушена. Взять её в прежнем виде нельзя.' : `Не удаётся найти здесь ${item ? '«'+item.label+'»' : 'такой предмет'}. Можно осмотреться или явно добавить вещь в исходные вводные.`;
        if(item.location==='inventory')return `«${item.label}» уже у вас.`;
        if(['barrier','fixed'].includes(item.kind))return `«${item.label}» не получится просто унести. Его можно исследовать или использовать на месте.`;
        if(item.location==='npc' && s.trust<2)return voice(s,p,'Теперь эта вещь у меня. Попросите вернуть или предложите обмен.');
        addInventory(s,item);s.focus=item.id;s.stage=Math.max(s.stage,2);log(s,'item','Получено: '+item.label);return `Вы берёте «${item.label}». Предмет теперь при вас.`;
      }
      case 'drop': case 'give': {
        if(!available || item.location!=='inventory')return `Нельзя ${c.intent==='give'?'передать':'бросить'} вещь, которой у вас нет. ${s.inventory.length?'При вас: '+s.inventory.join(', ')+'.':'Сначала найдите или укажите предмет.'}`;
        if(c.intent==='give' && !s.npcPresent)return 'Рядом нет собеседника, которому можно передать вещь.';
        const away=/в окно|в пропасть|в реку|в огонь|сжечь/.test(c.lower);
        removeInventory(s,item,c.intent==='give'?'npc':away?'lost':s.place);s.focus=item.id;
        if(c.intent==='give'){s.trust++;s.facts.lastGift=item.label;advance(s);log(s,'item','Передано собеседнику: '+item.label);return voice(s,p,`Вы передали мне «${item.label}». Я это учту. Это подарок или ваша часть сделки?`);}
        log(s,'item',(away?'Потеряно: ':'Оставлено: ')+item.label);return `«${item.label}» ${away?'оказывается вне досягаемости':'остаётся здесь'}. ${away?'Теперь нужен другой способ действовать.':'Вы сможете подобрать предмет снова, пока он здесь.'}`;
      }
      case 'open': case 'close': {
        const implicit=/^(?:я )?(?:открываю|открыть|закрываю|закрыть)[.! ]*$/.test(c.lower);
        const barrier=item || (implicit ? knownHere(s).find(e=>e.kind==='barrier') : null);
        if(!barrier)return 'Неясно, что именно открыть или закрыть. Назовите предмет из сцены.';
        if(!['barrier','clue'].includes(barrier.kind))return `У «${barrier.label}» нет очевидной запирающейся части. Можно осмотреть предмет или описать способ подробнее.`;
        if(!available && item)return inspect(s,p,item);
        s.focus=barrier.id;
        if(c.intent==='close'){barrier.opened=false;log(s,'action','Закрыто: '+barrier.label);return `Вы закрываете «${barrier.label}». ${barrier.locked?'Замок остаётся заперт.':'Предмет закрыт, но не заперт.'}`;}
        if(barrier.opened)return `«${barrier.label}» уже открыт. ${s.facts.revelation || 'Можно исследовать содержимое.'}`;
        if(barrier.kind==='clue'){barrier.opened=true;advance(s);s.facts.clue=p.clue;return `Вы раскрываете «${barrier.label}». ${p.clue}`;}
        const key=s.entities.find(e=>e.location==='inventory' && (e.label===p.tool || e.kind==='tool' && /отмыч/.test(norm(e.label))));
        if(!barrier.locked || key)return resolveBarrier(s,p,barrier,key?.label || 'без замка');
        s.pending={kind:'offer',text:'осмотреть запор',action:'Осматриваю '+barrier.label};
        return `«${barrier.label}» заперт. Подходящего инструмента пока нет. Можно искать «${p.tool}», договориться о помощи, сломать запор с риском или придумать обход.`;
      }
      case 'destroy': case 'burn': {
        if(!available)return 'Сначала нужно понять, что вы собираетесь повредить и где оно находится.';
        const fuel=c.intent==='burn' && !s.inventory.some(v=>/огонь|спич|зажиг|факел/.test(norm(v))) && !p.magic;
        if(fuel)return 'Без источника огня поджечь предмет не выходит. Можно найти огонь или выбрать другой способ.';
        danger(s,2);s.tension++;s.focus=item.id;
        if(item.kind==='barrier'){item.destroyed=true;const outcome=resolveBarrier(s,p,item,'силой');log(s,'cost','Шум привлёк внимание.');return `Запор поддаётся, но треск слышен далеко. Тихо уйти теперь сложнее.\n${outcome}`;}
        item.destroyed=true;s.inventory=s.inventory.filter(v=>v!==item.label);log(s,'cost','Разрушено: '+item.label);return `«${item.label}» больше нельзя использовать в прежнем виде. Шум и следы останутся частью этой сцены.`;
      }
      case 'use': case 'combine': {
        if(!available)return 'Назовите инструмент и то, на что хотите им воздействовать. Вещи должны быть здесь или при вас.';
        if(item.location!=='inventory' && !['fixed','barrier'].includes(item.kind))return `«${item.label}» ещё не у вас. Его можно взять или использовать на месте, описав как.`;
        s.focus=item.id;
        const locks=knownHere(s).filter(e=>e.kind==='barrier'&&!e.opened&&!e.destroyed);
        const lock=locks.find(e=>matchEntity({...s,entities:[e]},c.text)) || (/запор|преград|замок/.test(c.lower) ? locks[0] : null);
        const keyLock=lock || (locks.length===1 && !/двер|ларец|сейф|шлюз|архив|сундук|ящик|окно/.test(c.lower) ? locks[0] : null);
        if(keyLock && (item.label===p.tool || /отмыч/.test(norm(item.label))))return resolveBarrier(s,p,keyLock,item.label);
        if(lock && /нож|меч|лом/.test(norm(item.label)) && /подд|взлом|вскры|вскрыть|запор/.test(c.lower)) {
          danger(s);return `С помощью «${item.label}» запор поддаётся, но остаются заметные следы.\n${resolveBarrier(s,p,lock,'импровизация')}`;
        }
        if(lock && /веревк|стул/.test(norm(item.label)) && /обойти|обход|окно|влез/.test(c.lower)) {
          const window=knownHere(s).find(e=>/окно/.test(norm(e.label)));
          if(!window || /ларец|сейф|сундук|ящик|шкаф/.test(norm(lock.label)))return 'Так можно обойти проход, если есть реальный путь рядом. Сам запертый контейнер от этого не откроется.';
          danger(s);return `Вы используете «${item.label}» и соседнее окно. Обход оставляет заметный след.\n${resolveBarrier(s,p,lock,'обход')}`;
        }
        if(c.intent==='combine') {
          const second=s.entities.find(e=>e.id!==item.id && e.location==='inventory' && matchEntity({...s,entities:[e]},c.text));
          if(!second)return 'Для комбинации нужны два доступных предмета. Назовите оба и цель: что должна сделать новая конструкция?';
          const label=`${item.label} + ${second.label}`;const made=addEntity(s,label,{location:'inventory',source:'crafted'});addInventory(s,made);log(s,'creation',label);return `Вы собираете конструкцию «${label}». Она пригодна для проверки вашего замысла; какой эффект вы хотите получить?`;
        }
        advance(s);log(s,'action',c.text);return `Вы пробуете свой способ с «${item.label}». ${/фонар|зеркал/.test(norm(item.label))?'Изменив свет, удаётся заметить след на поверхности.':/телефон|раци|терминал/.test(norm(item.label))?'Устройство откликается; теперь можно попытаться связаться с кем-то или проверить запись.':'Предмет реагирует обычным для него образом. Для необычного эффекта нужно уточнить, на что и как вы воздействуете.'}`;
      }
      case 'show':
        if(!available)return 'Что именно вы показываете? Предмет должен быть у вас или находиться рядом.';
        s.focus=item.id;advance(s);if(count<2)s.trust++;return voice(s,p,`«${item.label}» меняет разговор. ${item.kind==='clue'?p.clue:'Вы хотите воспользоваться этой вещью или предложить её в обмен?'} ${p.pragmatic?'Давайте обсудим условия.':'Откуда она у вас?'}`);
      case 'bargain': s.facts.proposal=c.text.slice(0,200);s.pending={kind:'bargain',text:s.facts.proposal};thread(s,'Условия сделки: '+s.facts.proposal,'bargain');if(s.trust>=1){advance(s);s.trust++;return voice(s,p,`Я готов обсуждать это. Моя сторона сделки — помочь с вашей целью; ваша — помочь мне ${p.motive}. Уточните, что именно вы предлагаете.`);}return voice(s,p,`Предложение услышано. Я хочу ${p.motive}. Что убедит меня, что вы выполните свою часть?`);
      case 'lie': s.facts.claim=c.text.slice(0,200);danger(s);return voice(s,p,s.clocks.discovery>=2?'Ваш рассказ расходится с найденным следом. Я не могу принять его без объяснения.':'Допустим. Я пока не могу это проверить — но запомню вашу версию.');
      case 'attack': case 'threat': {
        const targetPart=c.text.match(/(?:по|в)\s+([^.!?]+)/iu)?.[1];
        const physical=targetPart ? matchEntity(s,targetPart,true) : item;
        if(c.intent==='attack' && physical && !physical.destroyed && [s.place,'inventory'].includes(physical.location)) {
          if(/стреля/.test(c.lower) && !s.entities.some(e=>e.location==='inventory'&&e.kind==='weapon'))return 'Для выстрела нужно оружие при вас. Пока его нет, выстрела не происходит.';
          if(physical.kind==='barrier')return execute(s,p,parse('Ломаю '+physical.label),config);
          danger(s);s.tension++;log(s,'conflict','Удар по предмету: '+physical.label);
          return `Удар приходится по «${physical.label}». Шум меняет обстановку, но это не нападение на собеседника. Предмет можно осмотреть, чтобы решить следующий шаг.`;
        }
        s.trust-=2;s.tension+=2;danger(s,2);s.pending=null;
        if(c.intent==='threat'||/угрожа|убью/.test(c.lower))return voice(s,p,p.timid?'Не подходите. Я отступлю, но доверять вам после этого не смогу.':'Угроза услышана. Я держу дистанцию. Силой вы можете получить доступ, но добровольной помощи — едва ли.');
        log(s,'conflict',c.text);return `Попытка нападения меняет сцену: ${p.name} отступает и защищается. Конфликт открыт; исход не решён одним ударом. Можно продолжить, отойти или предложить остановиться.`;
      }
      case 'defend': danger(s,-1);log(s,'action','Выбрана защита.');return 'Вы выбираете защиту и сохраняете пространство для отступления. Непосредственный риск ниже, но причина конфликта остаётся.';
      case 'hide': danger(s,-1);s.facts.hidden=true;log(s,'action','Герой скрывается.');return `Вы находите укрытие, пользуясь тем, что есть в месте «${s.place}». Пока вы не шумите, можно наблюдать. ${s.npcPresent?p.name+' теряет вас из виду.':'Преследование не подтверждено.'}`;
      case 'magic': {
        if(!p.magic)return `В правилах этого мира магия не установлена${p.rules?': '+p.rules:''}. Попытка не меняет предметы сама по себе. Можно использовать трюк, технологию или изменить канон в настройках.`;
        if(/(?:без|не может|невозмож|нельзя|запрещ)/.test(norm(p.rules)) && /бессмер|смерт|воскреш|врем/.test(c.lower))return `Заклинание упирается в заданное ограничение: ${p.rules}. Нужен другой способ.`;
        danger(s);advance(s);log(s,'magic',c.text);
        if(/телепорт/.test(c.lower))return move(s,p,c,true);
        if(/превращаюсь|превращаю себя/.test(c.lower)) {
          const form=c.text.match(/\sв\s+([^.!?]+)/iu)?.[1];
          if(!form)return 'Какую форму вы принимаете?';
          s.facts.form=form;log(s,'magic','Новая форма героя: '+form);return `Вы принимаете форму «${form}». Ваши вещи не исчезают из учёта, но способ обращения с ними теперь нужно соотносить с новой формой.`;
        }
        if(item && /превращ/.test(c.lower)) {
          if(!available)return 'Нужный предмет сейчас недоступен: заклинанию не на что опереться.';
          const form=c.text.match(/\sв\s+([^.!?]+)/iu)?.[1]?.trim();
          if(!form)return 'Во что вы превращаете предмет? Назовите форму — от неё будут зависеть последствия.';
          const loc=item.location;item.destroyed=true;s.inventory=s.inventory.filter(v=>v!==item.label);
          const next=addEntity(s,form,{location:loc,source:'magic'});if(loc==='inventory')addInventory(s,next);s.focus=next.id;
          return `«${item.label}» меняет форму: теперь это «${form}». Магия оставляет заметный след. Нельзя одновременно пользоваться прежней вещью и новой формой.`;
        }
        const lock=knownHere(s).find(e=>e.kind==='barrier'&&!e.opened);
        if(lock && /откры|отпер|замок|ларец|двер|снять/.test(c.lower))return `Заклинание снимает преграду; его след можно обнаружить.\n${resolveBarrier(s,p,lock,'магия')}`;
        return 'Заклинание оставляет видимый след в сцене. Его эффект нужно направить: на какой предмет, препятствие или цель вы воздействуете?';
      }
      case 'decision': {
        if(s.stage<3)return 'Это решение пока не к чему применить: воспоминание ещё не получено.';
        const release=/отпус/.test(c.lower);s.facts.decision=release?'отпустить':'сохранить';
        log(s,'decision','Решение о воспоминании: '+s.facts.decision);
        for(const t of s.threads)if(t.id==='aftermath')t.status='resolved';
        thread(s,release?'Разобраться, что останется после отказа от прошлого':'Понять, как жить с открывшейся правдой','next-chapter');
        return release?'Вы выбираете отпустить воспоминание. Оно больше не определяет ваше решение; цена — прежние ответы останутся недоступны. Новая зацепка: кем вы хотите стать теперь?':'Вы сохраняете воспоминание. Теперь найденную правду можно обсуждать и проверять; она остаётся частью вашей истории.';
      }
      case 'move': case 'return': return move(s,p,c,false);
      case 'perform': if(count<2)s.trust++;danger(s,s.clocks.danger>2?1:0);s.facts.performance=c.text.slice(0,180);log(s,'performance',c.text);return voice(s,p,choose(s,'performance',[p.ironic?'План неожиданен. Но пока вы выступали, я перестал ждать подвоха. Это уже достижение.':'Неожиданное выступление меняет настроение. Я отвлёкся от своих подозрений. Вы хотите развеселить меня или выиграть время?', 'Внимание теперь на вас. Если вы кого-то отвлекаете, это подходящий момент для следующего шага.', 'Это придаёт нашей встрече совсем другой ритм. Расскажите, почему вы выбрали именно это.']));
      case 'rest': danger(s,s.clocks.danger>0?1:0);s.tension=Math.max(0,s.tension-1);return 'Вы даёте себе передышку. Напряжение спадает; незавершённые дела остаются. В безопасной обстановке можно поговорить без спешки.';
      case 'eat': if(!available || item.kind!=='food')return 'Назовите доступную еду или напиток. От желания поесть предметы не появляются.';removeInventory(s,item,'consumed');item.destroyed=true;s.tension=Math.max(0,s.tension-1);log(s,'item','Использовано: '+item.label);return `Вы пробуете «${item.label}». Небольшая пауза помогает собраться; этот запас уже израсходован.`;
      case 'write': {const note=c.text.replace(/^\s*(?:я\s+)?(?:пишу|рисую|черчу|записываю)\s*/iu,'').slice(0,180);s.facts.writing=note;log(s,'creation',note);return `На месте остаётся ваша запись или рисунок: «${note}». Это след, к которому можно вернуться или который можно показать собеседнику.`;}
      case 'knock': if(!s.npcPresent)return 'Стук расходится в тишине. Известный вам собеседник остался в другом месте; ответа пока нет.';return voice(s,p,choose(s,'knock',['Я слышу. Входите в разговор — что вам нужно?', 'Вы не обязаны стучать снова. Я уже здесь и жду ваших слов.', 'Стук привлёк внимание. Теперь тихо наблюдать будет сложнее.']));
      case 'wait': if(s.clocks.danger)danger(s);return s.npcPresent?voice(s,p,choose(s,'wait',[`Не буду заполнять паузу за вас. Для меня по-прежнему важно ${p.motive}.`, 'Можно не отвечать сразу. Иногда пауза честнее обещания.', 'Пока мы молчим, решение остаётся открытым.'])):'Вы ждёте. Необычных изменений пока не видно; можно осмотреть новое место или вернуться.';
      case 'talk': s.facts.topic=c.text.slice(0,160);return voice(s,p,`Я услышал вашу версию. ${s.facts.goal?'Как это поможет вам '+s.facts.goal+'?':'Чего вы хотите добиться этим разговором?'}`);
      default: {
        if(/обещаю|клянусь/.test(c.lower)){s.facts.promise=c.text.slice(0,180);log(s,'promise',s.facts.promise);return voice(s,p,'Я запомню обещание. Доверие будет зависеть от того, что вы сделаете дальше.');}
        if(item && available) {
          s.focus=item.id;log(s,'attempt',c.text);
          return `Вы пробуете необычный подход к «${item.label}». ${item.opened?'Доступ уже открыт; способ не отменяет найденного.':item.kind==='barrier'?'Преграда остаётся на месте: опишите, как ваш способ должен обойти запор.':'Предмет остаётся в сцене. Уточните ожидаемый эффект, и можно будет проверить способ.'}\n${s.npcPresent?voice(s,p,p.ironic?'Я такого ещё не видел. Объясните замысел — возможно, в нём есть смысл.':'Любопытно. Вы хотите что-то проверить или показать мне?'):''}`;
        }
        s.facts.topic=c.text.slice(0,140);thread(s,c.text,'player-topic');
        return voice(s,p,choose(s,'unfamiliar',[
          `Похоже, вы предлагаете другой ход. Я пока не понимаю его цели. Это поступок, новая деталь мира или реплика мне? Можно описать желаемый результат своими словами.`,
          `Мы ещё не пробовали такой путь. ${s.facts.goal?'Ваша цель — '+s.facts.goal+'. ':''}Что должно измениться после этого? Если нужна новая вещь или правило, задайте это как факт: «Запомни: …».`,
          `Я не хочу приписать вам чужой замысел. Что в вашем предложении главное — изменить обстановку, повлиять на меня или установить факт истории?`
        ]));
      }
    }
  }
  function move(s,p,c,magic) {
    if(c.intent==='return') {
      if(!s.previousPlace)return 'Пока некуда возвращаться: вы ещё не покидали исходную сцену.';
      [s.place,s.previousPlace]=[s.previousPlace,s.place];s.npcPresent=s.place===s.startPlace;log(s,'place','Место: '+s.place);return `Вы возвращаетесь. Место: ${s.place}. ${s.npcPresent?p.name+' здесь; разговор можно продолжить.':'Здесь можно осмотреться.'}`;
    }
    const explicit=c.text.match(/(?:иду|пойду|направляюсь|бегу|вхожу|телепортируюсь|прыгаю|лезу)\s+(?:я\s+)?(?:в|на|к|за|через)\s+([^.!?]+)/iu)?.[1];
    const next=explicit?.trim().slice(0,100) || 'снаружи: '+s.place;
    s.previousPlace=s.place;s.place=next;s.focus=null;s.pending=null;s.npcPresent=false;s.facts.hidden=false;
    if(/следую|вместе/.test(c.lower))s.npcPresent=true;
    log(s,'place','Место: '+next);thread(s,'Исследовать: '+next,'place-'+hash(next));
    return `${magic?'Магия переносит вас':'Вы меняете место'}. Теперь: ${next}. ${s.npcPresent?p.name+' рядом.':'Прежний собеседник остаётся позади.'} Старые предметы не переносятся вслед за вами; с собой — только ваши вещи. Можно осмотреться, задать новые детали места или вернуться.`;
  }
  function director(s,p,intents) {
    // Storylets have eligibility conditions and fire once, rather than hijacking every turn.
    const events=[
      {id:'pressure',when:s.clocks.danger>=4 && !s.facts.hidden, text:p.pressure,kind:'danger'},
      {id:'connection',when:s.trust>=3 && s.npcPresent && !s.secretRevealed && !intents.includes('question'), text:`${p.name} решается сказать больше: «${p.secret}».`,kind:'secret'},
      {id:'discovery',when:s.clocks.discovery>=4 && s.stage<3, text:'Зацепки начинают сходиться. Есть основания попробовать другой способ, а не повторять прежний.',kind:'clue'}
    ];
    const event=events.find(e=>e.when&&!s.used['event:'+e.id]);
    if(!event)return '';
    s.used['event:'+event.id]=1;log(s,event.kind,event.text);
    if(event.kind==='secret'){s.secretRevealed=true;s.facts.secret=p.secret;}
    return event.text;
  }
  function reply(config, previous, input) {
    let s=init(config,previous); const p=profile({...config,world:s.runtimeWorld || config.world});
    if(s.configSig!==signature(config)) {
      // Public API callers may edit config without going through the settings form.
      const preserved={...fresh(),turn:s.turn,facts:s.facts,journal:s.journal,inventory:s.inventory};
      s=init(config,preserved);log(s,'canon','Сцена согласована с обновлёнными вводными.');
    }
    if(s.runtimeRules) {
      if(/без магии|магии нет|магия не существует/.test(norm(s.runtimeRules)))p.magic=false;
      else if(/магия существует|существует магия|магия есть|магия работает/.test(norm(s.runtimeRules)))p.magic=true;
      p.rules=[p.rules,s.runtimeRules].filter(Boolean).join('; ');
    }
    const text=clean(input).slice(0,6000);
    if(!text)return {text:'Что вы хотите сказать или сделать?',memory:s};
    s.turn++;const parsed=clauses(text).map(parse);const replies=[];const intents=[];
    for(const c of parsed) {
      intents.push(c.intent);replies.push(execute(s,p,c,config));s.lastIntent=c.negated?'refuse':c.intent;
    }
    s.trust=clamp(s.trust);s.tension=clamp(s.tension,0,5);
    s.facts.activePlace=s.place;
    const event=director(s,p,intents);if(event)replies.push(event);
    // No obligatory flavour sentence or repeated task list on every line.
    const opening=s.turn===1 ? `${clean(config.world) || 'История начинается.'}\n\n` : '';
    const output=opening+replies.filter(Boolean).join('\n\n');
    s.lastReply=output;log(s,'turn',text);s.version=VERSION;
    return {text:output,memory:s};
  }
  root.StoryEngine={version:VERSION,fresh,reply,profile,restore:init,reframe,parse,clauses};
})(globalThis);
