/* Conversation categories and Russian paraphrases, independent from physical actions. */
(function(root){
  'use strict';
  const topics=[
    {"number": 1, "id": "name", "label": "Имя", "depth": 0, "questions": ["Как вас зовут?", "Ваше имя?"]},
    {"number": 2, "id": "address", "label": "Обращение", "depth": 0, "questions": ["Как к вам обращаться?", "Можно на ты?"]},
    {"number": 3, "id": "identity", "label": "Личность", "depth": 0, "questions": ["Кто вы?", "Расскажите о себе"]},
    {"number": 4, "id": "occupation", "label": "Занятие", "depth": 0, "questions": ["Чем занимаетесь?", "Кто вы по профессии?"]},
    {"number": 5, "id": "age", "label": "Возраст", "depth": 1, "questions": ["Сколько вам лет?", "Вы давно здесь живёте?"]},
    {"number": 6, "id": "origin", "label": "Происхождение", "depth": 1, "questions": ["Откуда вы родом?", "Вы местная?"]},
    {"number": 7, "id": "presence", "label": "Причина присутствия", "depth": 0, "questions": ["Что вы здесь делаете?", "Почему пришли сюда?"]},
    {"number": 8, "id": "impression", "label": "Первое впечатление", "depth": 1, "questions": ["Что вы обо мне думаете?", "Я вам не мешаю?"]},
    {"number": 9, "id": "availability", "label": "Цель разговора", "depth": 0, "questions": ["У вас найдётся минутка?", "Можем поговорить?"]},
    {"number": 10, "id": "acquaintance", "label": "Взаимное знакомство", "depth": 1, "questions": ["Хотите узнать обо мне?", "Может, познакомимся поближе?"]},
    {"number": 11, "id": "place", "label": "Текущее место", "depth": 0, "questions": ["Что это за место?", "Куда я попал?"]},
    {"number": 12, "id": "place.history", "label": "История места", "depth": 0, "questions": ["Как здесь всё началось?", "Кто основал это место?"]},
    {"number": 13, "id": "people", "label": "Жители", "depth": 0, "questions": ["Кто здесь живёт?", "Кого здесь можно встретить?"]},
    {"number": 14, "id": "rules", "label": "Местные правила", "depth": 0, "questions": ["Что здесь разрешено?", "Чего лучше не делать?"]},
    {"number": 15, "id": "safety", "label": "Безопасность", "depth": 0, "questions": ["Здесь безопасно?", "Чего стоит опасаться?"]},
    {"number": 16, "id": "surroundings", "label": "Окрестности", "depth": 0, "questions": ["Что находится поблизости?", "Куда отсюда можно пойти?"]},
    {"number": 17, "id": "notables", "label": "Известные личности", "depth": 0, "questions": ["Кто тут главный?", "Кого все знают?"]},
    {"number": 18, "id": "changes", "label": "Изменения", "depth": 1, "questions": ["Что изменилось за последнее время?", "Раньше здесь было иначе?"]},
    {"number": 19, "id": "rumors", "label": "Слухи", "depth": 1, "questions": ["Что нового слышно?", "О чём здесь говорят?"]},
    {"number": 20, "id": "landmark", "label": "Особенности", "depth": 0, "questions": ["Чем славится это место?", "Что здесь необычного?"]},
    {"number": 21, "id": "work", "label": "Работа", "depth": 0, "questions": ["Чем вы зарабатываете?", "Какая у вас работа?"]},
    {"number": 22, "id": "work.satisfaction", "label": "Удовлетворённость", "depth": 1, "questions": ["Вам нравится ваша работа?", "Не надоедает?"]},
    {"number": 23, "id": "skills", "label": "Навыки", "depth": 1, "questions": ["Что вы умеете лучше всего?", "Какому делу обучены?"]},
    {"number": 24, "id": "tools", "label": "Инструменты", "depth": 0, "questions": ["Чем вы работаете?", "Для чего эта вещь?"]},
    {"number": 25, "id": "schedule", "label": "Распорядок", "depth": 1, "questions": ["Как проходит рабочий день?", "Когда вы заканчиваете?"]},
    {"number": 26, "id": "training", "label": "Обучение", "depth": 2, "questions": ["Кто вас научил?", "Где вы этому учились?"]},
    {"number": 27, "id": "clients", "label": "Клиенты", "depth": 1, "questions": ["Кто к вам обращается?", "У вас много посетителей?"]},
    {"number": 28, "id": "work.difficulty", "label": "Трудности", "depth": 2, "questions": ["Что самое сложное в работе?", "Что мешает?"]},
    {"number": 29, "id": "achievements", "label": "Достижения", "depth": 2, "questions": ["Чем вы гордитесь?", "Что у вас получилось лучше всего?"]},
    {"number": 30, "id": "career", "label": "Профессиональные планы", "depth": 2, "questions": ["Хотите сменить дело?", "Чего хотите добиться?"]},
    {"number": 31, "id": "day", "label": "Обычный день", "depth": 1, "questions": ["Как проходит ваш день?", "Чем обычно занимаетесь?"]},
    {"number": 32, "id": "food", "label": "Еда", "depth": 1, "questions": ["Что любите есть?", "Что здесь обычно готовят?"]},
    {"number": 33, "id": "drink", "label": "Напитки", "depth": 1, "questions": ["Что пьёте по утрам?", "Чай или кофе?"]},
    {"number": 34, "id": "rest", "label": "Отдых", "depth": 1, "questions": ["Как отдыхаете?", "Что делаете в свободное время?"]},
    {"number": 35, "id": "home", "label": "Жильё", "depth": 2, "questions": ["Где живёте?", "Далеко отсюда ваш дом?"]},
    {"number": 36, "id": "habits", "label": "Привычки", "depth": 1, "questions": ["Есть особые привычки?", "Без чего не начинаете день?"]},
    {"number": 37, "id": "busy", "label": "Занятость", "depth": 0, "questions": ["Вы сегодня заняты?", "Когда у вас будет время?"]},
    {"number": 38, "id": "sleep", "label": "Сон", "depth": 2, "questions": ["Хорошо спите?", "Часто работаете ночами?"]},
    {"number": 39, "id": "money", "label": "Деньги", "depth": 2, "questions": ["Дорого здесь жить?", "Вам хватает заработка?"]},
    {"number": 40, "id": "supplies", "label": "Покупки", "depth": 1, "questions": ["Где достать припасы?", "Что обычно покупаете?"]},
    {"number": 41, "id": "hobbies", "label": "Увлечения", "depth": 1, "questions": ["Чем увлекаетесь?", "Есть хобби?"]},
    {"number": 42, "id": "books", "label": "Книги и истории", "depth": 1, "questions": ["Что любите читать?", "Знаете интересную историю?"]},
    {"number": 43, "id": "music", "label": "Музыка", "depth": 1, "questions": ["Какая музыка вам нравится?", "Любите петь?"]},
    {"number": 44, "id": "art", "label": "Искусство", "depth": 1, "questions": ["Нравятся картины?", "Что считаете красивым?"]},
    {"number": 45, "id": "games", "label": "Игры", "depth": 1, "questions": ["Во что играете?", "Любите соревнования?"]},
    {"number": 46, "id": "animals", "label": "Животные", "depth": 1, "questions": ["Любите животных?", "Есть питомец?"]},
    {"number": 47, "id": "holidays", "label": "Праздники", "depth": 1, "questions": ["Как отмечаете праздники?", "Какой любимый?"]},
    {"number": 48, "id": "travel", "label": "Путешествия", "depth": 2, "questions": ["Где бывали?", "Куда хотели бы отправиться?"]},
    {"number": 49, "id": "collections", "label": "Коллекции", "depth": 2, "questions": ["Что-нибудь собираете?", "Почему храните эти вещи?"]},
    {"number": 50, "id": "curiosity", "label": "Любопытство", "depth": 1, "questions": ["Что вас удивляет?", "О чём хочется узнать больше?"]},
    {"number": 51, "id": "friends", "label": "Друзья", "depth": 2, "questions": ["У вас есть друзья?", "С кем обычно проводите время?"]},
    {"number": 52, "id": "family", "label": "Семья", "depth": 2, "questions": ["Расскажите о семье", "Есть ли у вас родные?"]},
    {"number": 53, "id": "important_person", "label": "Близкий человек", "depth": 3, "questions": ["Кто для вас важнее всех?", "О ком беспокоитесь?"]},
    {"number": 54, "id": "acquaintances", "label": "Знакомые", "depth": 1, "questions": ["Вы знаете Илью?", "Как относитесь к Нике?"]},
    {"number": 55, "id": "community", "label": "Окружающие", "depth": 1, "questions": ["Как вам здешние люди?", "Легко с ними уживаетесь?"]},
    {"number": 56, "id": "trust", "label": "Доверие", "depth": 2, "questions": ["Кому вы доверяете?", "Легко доверяете незнакомцам?"]},
    {"number": 57, "id": "conflicts", "label": "Конфликты", "depth": 2, "questions": ["Вы с кем-то поссорились?", "Что между вами произошло?"]},
    {"number": 58, "id": "forgiveness", "label": "Примирение", "depth": 2, "questions": ["Умеете прощать?", "Как можно исправить ошибку?"]},
    {"number": 59, "id": "loneliness", "label": "Одиночество", "depth": 2, "questions": ["Вам бывает одиноко?", "Нравится быть одному?"]},
    {"number": 60, "id": "sociability", "label": "Общение", "depth": 1, "questions": ["Любите гостей?", "Нравится разговаривать с людьми?"]},
    {"number": 61, "id": "childhood", "label": "Детство", "depth": 3, "questions": ["Каким было ваше детство?", "Где вы выросли?"]},
    {"number": 62, "id": "old_home", "label": "Родной дом", "depth": 3, "questions": ["Помните свой первый дом?", "Скучаете по родине?"]},
    {"number": 63, "id": "previous_work", "label": "Предыдущая жизнь", "depth": 2, "questions": ["Чем занимались раньше?", "Всегда жили так?"]},
    {"number": 64, "id": "education", "label": "Образование", "depth": 2, "questions": ["Где учились?", "Кто вас воспитывал?"]},
    {"number": 65, "id": "mentor", "label": "Наставник", "depth": 3, "questions": ["Кто повлиял на вашу жизнь?", "Был ли у вас учитель?"]},
    {"number": 66, "id": "relocation", "label": "Переезд", "depth": 3, "questions": ["Почему уехали?", "Что заставило сменить место?"]},
    {"number": 67, "id": "meeting", "label": "Важная встреча", "depth": 3, "questions": ["Кого запомнили навсегда?", "Кто изменил вашу жизнь?"]},
    {"number": 68, "id": "memory", "label": "Успех прошлого", "depth": 3, "questions": ["Какое воспоминание вам дорого?", "Чем раньше гордились?"]},
    {"number": 69, "id": "regret", "label": "Ошибка", "depth": 3, "questions": ["О чём жалеете?", "Что сделали бы иначе?"]},
    {"number": 70, "id": "loss", "label": "Утрата", "depth": 4, "questions": ["Кого вам не хватает?", "Что вы потеряли?"]},
    {"number": 71, "id": "good", "label": "Добро и зло", "depth": 2, "questions": ["Что считаете добром?", "Все ли поступки можно оправдать?"]},
    {"number": 72, "id": "justice", "label": "Справедливость", "depth": 2, "questions": ["Что для вас справедливость?", "Всегда ли виновных наказывают?"]},
    {"number": 73, "id": "law", "label": "Закон", "depth": 1, "questions": ["Нужно ли соблюдать любые законы?", "Вы уважаете местные порядки?"]},
    {"number": 74, "id": "freedom", "label": "Свобода", "depth": 2, "questions": ["Что для вас свобода?", "Ради чего готовы рисковать?"]},
    {"number": 75, "id": "duty", "label": "Долг", "depth": 2, "questions": ["Перед кем чувствуете обязательства?", "Что важнее личной выгоды?"]},
    {"number": 76, "id": "honesty", "label": "Правда", "depth": 2, "questions": ["Всегда ли нужно говорить правду?", "Можно ли солгать ради другого?"]},
    {"number": 77, "id": "risk", "label": "Риск", "depth": 2, "questions": ["Вы осторожный человек?", "Часто идёте на риск?"]},
    {"number": 78, "id": "power", "label": "Власть", "depth": 2, "questions": ["Доверяете правителям?", "Как относитесь к начальству?"]},
    {"number": 79, "id": "property", "label": "Собственность", "depth": 1, "questions": ["Что думаете о воровстве?", "Можно ли брать чужое ради выживания?"]},
    {"number": 80, "id": "meaning", "label": "Смысл и вера", "depth": 3, "questions": ["Во что верите?", "Что придаёт жизни смысл?"]},
    {"number": 81, "id": "mood", "label": "Настроение", "depth": 1, "questions": ["Как настроение?", "Всё в порядке?"]},
    {"number": 82, "id": "joy", "label": "Радость", "depth": 2, "questions": ["Что вас радует?", "Когда вы в последний раз были счастливы?"]},
    {"number": 83, "id": "irritation", "label": "Раздражение", "depth": 2, "questions": ["Что вас злит?", "Что терпеть не можете?"]},
    {"number": 84, "id": "worry", "label": "Беспокойство", "depth": 3, "questions": ["Вас что-то тревожит?", "О чём сейчас думаете?"]},
    {"number": 85, "id": "fear", "label": "Страх", "depth": 3, "questions": ["Чего боитесь?", "Что вас пугает?"]},
    {"number": 86, "id": "shame", "label": "Стыд", "depth": 4, "questions": ["Было ли вам за что-то стыдно?", "Что предпочли бы забыть?"]},
    {"number": 87, "id": "envy", "label": "Зависть", "depth": 3, "questions": ["Кому завидуете?", "Хотели бы оказаться на чужом месте?"]},
    {"number": 88, "id": "hope", "label": "Надежда", "depth": 3, "questions": ["На что надеетесь?", "Верите, что всё наладится?"]},
    {"number": 89, "id": "comfort", "label": "Утешение", "depth": 3, "questions": ["Что помогает вам успокоиться?", "Кто поддерживает вас?"]},
    {"number": 90, "id": "boundaries", "label": "Границы", "depth": 2, "questions": ["О чём не любите говорить?", "Что вас обижает?"]},
    {"number": 91, "id": "plans", "label": "Ближайшие планы", "depth": 1, "questions": ["Что собираетесь делать?", "Какие планы на завтра?"]},
    {"number": 92, "id": "change", "label": "Большие перемены", "depth": 2, "questions": ["Хотите изменить свою жизнь?", "Что бы поменяли?"]},
    {"number": 93, "id": "goal", "label": "Главная цель", "depth": 2, "questions": ["Чего больше всего хотите?", "К чему стремитесь?"]},
    {"number": 94, "id": "obstacles", "label": "Препятствия", "depth": 3, "questions": ["Что вам мешает?", "Почему до сих пор не получилось?"]},
    {"number": 95, "id": "help", "label": "Помощь", "depth": 1, "questions": ["Чем я могу помочь?", "Вам что-нибудь нужно?"]},
    {"number": 96, "id": "secret", "label": "Секрет", "depth": 5, "questions": ["Что вы скрываете?", "Есть то, о чём никто не знает?"]},
    {"number": 97, "id": "dangers", "label": "Опасности", "depth": 3, "questions": ["Кому не доверяете?", "Кто может нам помешать?"]},
    {"number": 98, "id": "unfinished", "label": "Незавершённое дело", "depth": 3, "questions": ["Есть невыполненное обещание?", "Что вам ещё предстоит закончить?"]},
    {"number": 99, "id": "decision", "label": "Важное решение", "depth": 4, "questions": ["Перед каким выбором стоите?", "Что не даёт решиться?"]},
    {"number": 100, "id": "expectations", "label": "Отношение к герою", "depth": 2, "questions": ["Чего вы ждёте от меня?", "Зачем вам моё участие?"]}
  ];
  const byId=Object.fromEntries(topics.map(topic=>[topic.id,topic]));
  byId.hobbies.questions.push('Есть увлечение?');byId.music.questions.push('Какую музыку любите?');byId.secret.questions.push('Раскройте свой секрет');
  const norm=text=>String(text||'').toLowerCase().replace(/ё/g,'е').replace(/[«»“”"?!.,:;—–]/g,' ').replace(/\s+/g,' ').trim();
  function normalized(text){return norm(text).replace(/(?:^| )(?:пожалуйста|пожалуй|скажите|скажи)(?= |$)/gu,' ').replace(/(?:^| )(?:вы|вас|вам|вами|ты|тебя|тебе|тобой)(?= |$)/gu,' ты').replace(/(?:ваше|ваш|ваша|ваши|твое|твой|твоя|твои)/gu,'свой').replace(/\s+/g,' ').trim();}
  const patterns={
    name:/как.*(?:зовут|имя)|(?:свой|твое|ваше) имя/,address:/как.*обращат|можно на ты|называть.*тебя|обращаться на/,identity:/кто (?:же )?ты|расскаж.*о себе|представь(?:ся|тесь)/,
    occupation:/чем.*занима|кто.*професси/,age:/сколько.*лет|возраст|давно.*жив/,origin:/откуда.*родом|ты местн|откуда.*приехал/,presence:/почему.*(?:здесь|сюда|тут)|что.*здесь дела/,impression:/что.*обо мне дума|я.*не мешаю|первое впечатлен/,availability:/найдется минут|можем поговор|есть.*минут/,acquaintance:/узнать обо мне|познакомимся|познакомиться поближе/,
    place:/что это за место|куда я попал|что за.*(?:лавка|мастерская|площадь|место|станция)/,'place.history':/кто.*основа|как здесь.*начал|истори.*(?:лавк|мест|город)|давно.*(?:откры|лавк)/,people:/кто здесь жив|кого.*(?:здесь|тут).*встрет/,rules:/здесь.*разрешено|чего.*не делать|местные правила/,safety:/здесь безопасно|чего.*опасаться/,surroundings:/что.*поблизости|куда отсюда|рядом.*(?:места|находит)/,notables:/кто тут главн|кого все зна/,changes:/что изменил|раньше здесь/,rumors:/что нового слыш|о чем здесь говор|какие.*слух/,landmark:/чем славится|что.*здесь необыч/,
    work:/чем.*зарабатыва|какая.*работа|чем.*на жизнь/,'work.satisfaction':/нравится.*работ|не надоедает|довол.*работ/,skills:/что.*умеешь|чему.*обучен|лучше всего.*получается/,tools:/чем.*работа|для чего.*вещь|какие.*инструмент/,schedule:/рабочий день|когда.*заканчива/,
    training:/кто.*научил|где.*этому.*учил/,clients:/кто.*обращается|много.*посетител|свои клиент/,'work.difficulty':/сложное в работе|что.*работ.*меша/,achievements:/чем.*горди|получилось лучше/,career:/сменить дело|чего.*хочешь добиться|профессиональн.*план/,
    day:/как.*проходит.*день|чем обычно.*занима/,food:/любишь есть|любимая еда|здесь.*готовят/,drink:/пьешь.*утрам|чай или кофе|любимый напиток/,rest:/как.*отдыха|свободное время/,home:/где.*живешь|далеко.*дом/,habits:/особые привыч|без чего.*день/,busy:/сегодня занят|когда.*будет время/,sleep:/хорошо.*спишь|работаешь ночами/,money:/дорого.*жить|хватает.*заработ|денег хватает/,supplies:/где.*припас|обычно.*покупа/,
    hobbies:/чем.*увлека|есть.*хобби/,books:/любишь читать|интересную историю|любимая книг/,music:/какая.*музыка|любишь петь/,art:/нравятся картины|считаешь красив/,games:/во что.*играешь|любишь соревнован/,animals:/любишь животн|есть.*питом/,holidays:/отмечаешь праздник|любимый праздник/,travel:/где.*быва|куда.*хотел.*отправ|путешеств/,collections:/что нибудь собира|хранишь эти вещи/,curiosity:/что.*удивляет|хочется узнать/,
    friends:/есть.*друзья|с кем.*проводишь время/,family:/о семье|есть ли.*родные|своя семья/,important_person:/важнее всех|о ком.*беспокои/,acquaintances:/знаешь.*(?:иль|ник|ле[юя]|мир)|как относишься к/,community:/здешние люди|с ними ужива/,trust:/кому.*доверя|доверяешь.*(?:незнаком|мне)|ты мне довер|можно мне доверять/,conflicts:/с кем то.*поссор|между нами.*произош|наша ссора/,forgiveness:/умеешь прощ|исправить ошиб|как.*примир/,loneliness:/бывает одинок|нравится быть одн/,sociability:/любишь гост|нравится.*разговар/,
    childhood:/свое детство|где.*вырос|каким было.*детство/,old_home:/первый дом|скучаешь по родине/,previous_work:/занима.*раньше|всегда.*жил|кем.*был.*раньше/,education:/где.*учил|кто.*воспитывал/,mentor:/повлиял на.*жизнь|был ли.*учител/,relocation:/почему.*уеха|сменить место/,meeting:/кого.*запомнил навсегда|кто изменил.*жизнь/,memory:/какое воспоминание.*дорого|раньше горди/,regret:/о чем.*жале|сделал.*иначе/,loss:/кого.*не хватает|что.*потерял/,
    good:/считаешь добром|поступки.*оправда|добро и зло/,justice:/для.*справедливость|виновных.*наказыва/,law:/соблюдать.*законы|уважаешь.*порядк/,freedom:/для.*свобода|ради чего.*рискова/,duty:/чувствуешь обязатель|важнее.*выгод/,honesty:/говорить правду|солгать ради|допустима.*ложь/,risk:/осторожный человек|часто.*на риск/,power:/доверяешь правител|относишься к началь/,property:/о воровстве|брать чужое/,meaning:/во что.*веришь|придает.*смысл/,
    mood:/как настроение|все в порядке/,joy:/что.*радует|последний раз.*счастлив/,irritation:/что.*злит|терпеть не мож/,worry:/что то тревож|о чем.*(?:сейчас )?дума/,fear:/чего.*боишься|что.*пугает/,shame:/за что то стыд|предпочел.*забыть/,envy:/кому.*завиду|на чужом месте/,hope:/на что.*наде|что все наладится/,comfort:/помогает.*успоко|кто.*поддерживает/,boundaries:/не любишь говорить|что.*обижает/,
    plans:/собираешься делать|планы на завтра/,change:/изменить.*жизнь|что бы.*поменя/,goal:/больше всего хочешь|к чему.*стреми|чего.*хочешь|своя цель/,obstacles:/что.*мешает|почему.*не получил/,help:/чем я.*помо|тебе что нибудь нужно/,secret:/что.*скрыва|есть.*никто не зна|расскаж.*секрет|своя тайна|твой секрет/,dangers:/кому не довер|кто.*помешать/,unfinished:/невыполненное обещан|предстоит законч/,decision:/перед каким выбор|не дает решиться/,expectations:/чего.*ждешь от меня|зачем.*мое участ/,
  };
  // Polite and familiar verb forms share a matching representation.
  function familiar(text){return normalized(text).replace(/етесь/g,'ешься').replace(/итесь/g,'ишься').replace(/аете/g,'аешь').replace(/яете/g,'яешь').replace(/ите(?= |$)/g,'ишь').replace(/ете(?= |$)/g,'ешь').replace(/считаете/g,'считаешь');}
  const forms=topics.map(topic=>({topic,forms:topic.questions.map(familiar)}));
  function resolve(input,context={}){
    let text=String(input||'').trim();
    for(const person of context.people||[]){const escaped=person.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.replace(new RegExp('^'+escaped+'\\s*[:,]\\s*','iu'),'');}
    text=text.replace(/^(?:я\s+)?(?:спрашиваю|спросить)\s+(?:[^«:"?]+?:\s*|[^«"?]+?\s+о\s+)?[«"]?/iu,'').replace(/[»"]$/u,'');
    const q=familiar(text),base=normalized(text),last=context.activeTopic;
    if(/^(?:а )?(?:почему|зачем|расскаж(?:и|ите) подробнее|подробнее|что это значит|что.*имеешь в виду|что.*имеете в виду|а раньше|раньше|и что случилось потом|что было потом|(?:вы|ты) уверен(?:а|ы)?|а у.*самой|а у.*самого|а если я не соглашусь)$/u.test(base)){
      let followUp=/раньше/.test(base)?'past':/почему|зачем/.test(base)?'reason':/уверен/.test(base)?'certainty':/не соглаш/.test(base)?'disagree':/самой|самого/.test(base)?'personal_experience':/потом/.test(base)?'next':'elaborate';
      const parent=byId[last?.split('.')[0]]||byId[last]||null;
      return {topicId:last||null,parentId:parent?.id||null,followUp,confidence:1,raw:input,contextRequired:!last};
    }
    if(/(?:почему|зачем).*выбра.*(?:работ|дело|профес)|почему.*(?:торгу|ремонт|лечишь)/u.test(q))return {topicId:'occupation.motivation',parentId:'occupation',facet:'motivation',confidence:1,raw:input};
    if(/(?:давно|сколько лет).*(?:жив|откры|работа)/u.test(q))return {topicId:'tenure',parentId:/жив/.test(q)?'home':'place.history',confidence:1,raw:input};
    if(/(?:кто|кто нибудь).*(?:тебе|ты|вам).*(?:помог|помога)|(?:ты|тебе|вам).*сам.*помог/u.test(base))return {topicId:'occupation.personal_experience',parentId:'occupation',facet:'personal_experience',confidence:1,raw:input};
    if(/как меня зовут|мое имя|меня зовут|что я говорил|что я обещал|помнишь/.test(base))return null;
    const exact=forms.filter(entry=>entry.forms.includes(q));
    if(exact.length)return {topicId:exact[0].topic.id,confidence:1,raw:input};
    const scores=[];
    for(const [id,pattern]of Object.entries(patterns)){const match=q.match(pattern);if(match)scores.push({id,score:match[0].length+(id.includes('.')?8:0)});}
    scores.sort((a,b)=>b.score-a.score);
    if(!scores.length)return null;
    return {topicId:scores[0].id,confidence:.85,raw:input};
  }
  function topic(id){return byId[id]||{id,label:id==='tenure'?'Срок жизни и работы здесь':byId[id?.split('.')[0]]?.label||'Продолжение разговора',depth:id==='tenure'?1:2};}
  root.ConversationTopics={all:topics,byId,topic,resolve,normalize:familiar};
})(globalThis);
