/* Cards are created once. Unknown past/family facts stay unknown; new tastes are saved. */
(function(root){
  'use strict';
  const norm=value=>String(value||'').toLowerCase().replace(/ё/g,'е');
  const hash=text=>[...text].reduce((n,char)=>(n*31+char.charCodeAt(0))>>>0,23);
  const roles={
    memory_merchant:{label:'торговля воспоминаниями',occupation:'Я торгую воспоминаниями и веду эту лавку.',skills:'Умею различать и бережно хранить воспоминания.',motivation:'Я выбрал это дело, чтобы помогать людям возвращать то, что они потеряли.',satisfaction:'В этом деле мне важно, что найденное воспоминание может что-то изменить для человека.',difficulty:'Труднее всего решить, какое воспоминание стоит возвращать.',clients:'Ко мне обращаются те, кто ищет утраченное или готов с чем-то расстаться.'},
    merchant:{label:'торговля',occupation:'Я занимаюсь торговлей.',skills:'Умею оценивать товары и договариваться об обмене.',motivation:'Мне важно вести дело, на которое можно рассчитывать.',satisfaction:'Мне нравится, когда сделка устраивает обе стороны.',difficulty:'Непросто отличить хорошее предложение от красивого обещания.',clients:'Мои клиенты приходят за товарами и обменом.'},
    craftsman:{label:'ремесло',occupation:'Я ремонтирую вещи и работаю в мастерской.',skills:'Умею находить поломки и подгонять детали.',motivation:'Мне нравится возвращать вещам рабочее состояние.',satisfaction:'Приятно видеть, как вещь снова работает.',difficulty:'Главная трудность — понять причину поломки, а не спрятать её признаки.',clients:'Ко мне приходят с вещами, которым нужен ремонт.'},
    guard:{label:'охрана',occupation:'Я слежу за порядком и безопасностью.',skills:'Умею замечать опасность и охранять проходы.',motivation:'Мне важно, чтобы рядом можно было жить без страха.',satisfaction:'Спокойный день для меня — хороший результат.',difficulty:'Важно не принять подозрение за доказанную вину.',clients:'Ко мне обращаются за защитой и по вопросам порядка.'},
    scholar:{label:'исследования',occupation:'Я занимаюсь исследованиями.',skills:'Умею сопоставлять наблюдения и проверять гипотезы.',motivation:'Мне хочется понять, как устроены вещи, а не довольствоваться удобным объяснением.',satisfaction:'Мне интересно находить ответы, которые выдерживают проверку.',difficulty:'Сложнее всего заметить собственную ошибку.',clients:'Обычно ко мне приходят с вопросами и наблюдениями.'},
    aristocrat:{label:'представительство',occupation:'Я занимаюсь делами своего круга и представительством.',skills:'Умею вести переговоры и разбираться в этикете.',motivation:'Мне важно сохранять достоинство и отвечать за принятые решения.',satisfaction:'Я ценю возможность влиять на ход дел.',difficulty:'Влияние требует ответственности за последствия.',clients:'Ко мне обращаются за содействием в общих делах.'},
    rogue:{label:'неформальные сделки',occupation:'Я нахожу возможности, которые другие не замечают.',skills:'Умею замечать лазейки и вести осторожные переговоры.',motivation:'Мне дорого право самому выбирать свой путь.',satisfaction:'Люблю находить выход там, где все видят тупик.',difficulty:'Самое трудное — решить, кому показать найденный выход.',clients:'Ко мне приходят с необычными предложениями.'},
    healer:{label:'лечение',occupation:'Я помогаю больным и пострадавшим.',skills:'Умею оказывать помощь и замечать тревожные признаки.',motivation:'Мне важно облегчать чужую боль.',satisfaction:'Радуюсь, когда человеку становится лучше.',difficulty:'Трудно помогать там, где не хватает сведений и средств.',clients:'Ко мне приходят те, кому нужна помощь.'},
    traveler:{label:'путешествия',occupation:'Я путешествую и изучаю дороги.',skills:'Умею наблюдать за местностью и готовиться к пути.',motivation:'Мне интересно увидеть, что находится за знакомым горизонтом.',satisfaction:'Люблю узнавать новые места.',difficulty:'В пути важно понимать, когда пора остановиться.',clients:'Обычно у меня спрашивают о дорогах.'},
    hermit:{label:'уединённая жизнь',occupation:'Я живу спокойно и стараюсь обходиться своими силами.',skills:'Умею обходиться малым и внимательно наблюдать.',motivation:'Мне нужна тишина, чтобы слышать собственные мысли.',satisfaction:'Меня устраивает спокойная жизнь.',difficulty:'Уединение не освобождает от необходимости заботиться о себе.',clients:'Я редко ищу чужого внимания.'},
    artist:{label:'искусство',occupation:'Я занимаюсь искусством и выступлениями.',skills:'Умею передавать чувства через образы и выступления.',motivation:'Мне важно находить форму для того, что трудно сказать прямо.',satisfaction:'Радуюсь, когда моя работа отзывается в другом человеке.',difficulty:'Трудно сохранить собственный голос, стараясь понравиться всем.',clients:'Обычно ко мне приходят за впечатлением или историей.'},
    official:{label:'ведение дел',occupation:'Я занимаюсь общими делами и установленными процедурами.',skills:'Умею разбираться в обращениях и порядке действий.',motivation:'Мне важно, чтобы договорённости имели понятный порядок.',satisfaction:'Ценю дела, доведённые до результата.',difficulty:'Трудно соблюсти порядок, не забыв о человеке.',clients:'Ко мне приходят с обращениями и вопросами о порядке.'},
    inventor:{label:'изобретательство',occupation:'Я проектирую и собираю устройства.',skills:'Умею исследовать механизмы и искать новые способы решения.',motivation:'Мне интересно сделать то, чего ещё не хватало.',satisfaction:'Люблю момент, когда замысел начинает работать.',difficulty:'Сложно отличить полезную идею от просто необычной.',clients:'Ко мне обращаются с техническими задачами.'},
    courier:{label:'доставка',occupation:'Я доставляю письма и посылки.',skills:'Умею беречь отправления и выбирать путь доставки.',motivation:'Мне важно, чтобы послание дошло до адресата.',satisfaction:'Нравится доводить поручение до получателя.',difficulty:'Сложно уложиться в срок, не рискуя чужим отправлением.',clients:'Ко мне обращаются те, кому нужно что-то передать.'},
    resident:{label:'местный житель',occupation:null,skills:null,motivation:null,satisfaction:null,difficulty:null,clients:null}
  };
  function role(n,s){
    const text=norm(n.description+' '+n.motive),place=norm(s.world.locations.find(l=>l.id===n.location)?.name),world=norm(s.world.authorCanon.world);
    if(/торгов|лавк|купец|продав/.test(text)&&/воспомин/.test(text+' '+world)&&!/(?:нет|без) воспомин/.test(world))return 'memory_merchant';
    for(const [id,re]of [['guard',/страж|охран|часов/],['scholar',/ученый|ученая|исследовател/],['aristocrat',/аристократ|дворян|барон|герцог/],['rogue',/вор|плут|контрабанд|разбой/],['healer',/лекарь|лекарка|целител|врач/],['hermit',/отшель|затвор/],['artist',/артист|бард|певец|певица|художник/],['official',/чиновник|писарь|секретарь/],['inventor',/изобретател|инженер/],['traveler',/путешествен|странник/],['merchant',/торгов|купец|продав|хозяйк.*лавк/],['courier',/достав.*письм|курьер|почтальон/],['craftsman',/ремеслен|кузнец|мастер|починить инструмент/]])if(re.test(text))return id;
    return /мастерск/.test(place)?'craftsman':/рынок/.test(place)?'merchant':'resident';
  }
  const factAliases={имя:'name',занятие:'occupation',профессия:'occupation',возраст:'age',происхождение:'origin',родина:'origin',дом:'home',семья:'family',друзья:'friends',детство:'childhood',прошлое:'previous_work',увлечения:'hobbies',секрет:'secret',цель:'goal',причина_работы:'occupation.motivation',срок:'tenure'};
  function rules(text){
    const p={};for(const part of String(text||'').split(';')){const [raw,...tail]=part.split('=');const key=norm(raw).trim(),value=tail.join('=').trim();
      if(!value)continue;
      if(['доверие','симпатия','уважение','страх'].includes(key)){if(Number.isFinite(Number(value)))p[({доверие:'trust',симпатия:'affection',уважение:'respect',страх:'fear'})[key]]=Number(value);else p.invalid=true;}
      else if(key==='улика')p.evidence=value;else if(key==='защищает')p.protects=value;else if(key==='долг')p.debt=value;else if(key==='сделка')p.deal=value;else if(key==='решение')p.decision=value;else if(key==='ложь')p.cover=value;else if(key==='глубина'){if(Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=5)p.depth=Number(value);else p.invalid=true;}else if(key==='уклонение')p.evasion=value;
    }return p;
  }
  function fact(n,topic,text,options={}){return {id:n.id+':bio:'+topic+':'+hash(text),topic,text:String(text),depth:root.ConversationTopics.topic(topic).depth,source:'generated-once',...options};}
  function init(s,config){
    const lines=String(config.canon||'').split('\n').map(line=>{const at=line.indexOf(':');return at<0?null:{key:norm(line.slice(0,at)).trim(),args:line.slice(at+1).split('|').map(v=>v.trim())};}).filter(Boolean);
    for(const n of Object.values(s.world.npcs)){
      if(n.biography?.version===1){root.ConversationMemory.init(n);continue;}
      const type=/искусственный интеллект|андроид|(?:^|[^а-яa-z])(?:робот|ии|ai)(?:[^а-яa-z]|$)|автомат|компьютерн.*разум/.test(norm(n.description))?'machine':/древний дух|призрак|(?:^|[^а-я])дух(?:[^а-я]|$)|божество/.test(norm(n.description))?'spirit':'human';
      const configured=lines.find(entry=>entry.key==='роль npc'&&norm(entry.args[0])===norm(n.name))?.args[1];
      const r=roles[configured]?configured:role(n,s),spec=roles[r],overrides={};
      for(const entry of lines)if(entry.key==='манера npc'&&norm(entry.args[0])===norm(n.name))for(const part of (entry.args[1]||'').split(';')){const [key,value]=part.split('=');overrides[key?.trim()]=value?.trim();}
      n.personality=root.NpcPersonality.create(n,r,overrides);n.identity={name:n.name,role:r,kind:type,originLocationId:n.location};
      const facts={};const put=(id,text,options={})=>{if(text)facts[id]=[fact(n,id,text,options)];};
      put('name',n.name,{depth:0,source:'identity'});put('occupation',spec.occupation,{depth:0});
      put('occupation.motivation',spec.motivation,{depth:1});put('work',spec.occupation,{depth:0});put('work.satisfaction',spec.satisfaction);put('skills',spec.skills);put('work.difficulty',spec.difficulty);put('clients',spec.clients);
      put('goal','Мне важно '+n.motive+'.',{depth:1,source:'author-motive'});put('plans','Сейчас я хочу '+n.motive+'.',{source:'author-motive'});put('presence',r==='memory_merchant'?'Я присматриваю за лавкой и принимаю посетителей.':spec.occupation?'Я здесь занимаюсь своим делом. '+spec.occupation:'Сейчас я нахожусь здесь.',{depth:0,source:'role-presence'});
      if(r!=='resident')put('hobbies',r==='craftsman'||r==='inventor'?'Мне нравится разбираться в устройстве сложных вещей.':r==='scholar'?'Люблю сопоставлять разные объяснения одного явления.':r==='artist'?'Люблю искать истории и неожиданные образы.':hash(n.id)%2?'В свободное время люблю спокойные беседы.':'Мне нравятся неторопливые прогулки.');
      put('music',hash(n.id)%2?'Мне нравятся спокойные мелодии.':'Люблю музыку с ясным ритмом.');
      put('curiosity',n.personality.curiosity>.6?'Мне интересно, почему люди выбирают разные пути к одной цели.':'Мне интереснее хорошо понять знакомое дело, чем менять его ради новизны.');
      if(type==='human'){put('food','Предпочитаю простую сытную еду.');put('drink','Предпочитаю воду; вкусы в напитках не самая важная часть моей жизни.');}
      put('sociability',n.personality.sociability>.6?'Люблю беседу, если мы слушаем друг друга.':'Я не очень разговорчив; мне легче говорить о конкретном.');
      put('boundaries',n.personality.openness<.4?'Не люблю, когда меня торопят с личными признаниями.':'Можно спрашивать, но я оставляю за собой право не отвечать.');
      put('risk',n.personality.caution>.6?'Предпочитаю сначала понять риск и подготовить путь назад.':'Иногда стоит попробовать, даже если не всё известно.');
      put('property',n.social.profile.propertyRespect>=.5?'Чужие вещи следует брать с разрешения владельца.':'Обстоятельства бывают разными, но даже ловкий поступок имеет последствия.');
      put('law',n.social.profile.lawfulness>=.5?'Порядок помогает жить вместе, хотя подозрение само по себе не делает человека виновным.':'Не каждый запрет я считаю справедливым. Но о последствиях забывать нельзя.');
      put('honesty',n.personality.caution>.6?'Слова я сравниваю с поступками. Иногда молчание честнее удобной выдумки.':'Предпочитаю прямой разговор, но у человека могут быть причины беречь чужую тайну.');
      put('forgiveness',n.social.profile.forgiveness>.6?'Прощать можно, если человек признаёт причину и исправляет последствия.':'Одного извинения мне мало. Сначала нужно исправить причинённое.');
      put('rest',n.personality.sociability>.6?'Мне помогает спокойная беседа без спешки.':'Лучше всего отдыхаю в тишине.');
      if(n.secret)put('secret',n.secret,{depth:5,source:'author-secret',policy:{guarded:true,trust:3}});
      n.biography={version:1,createdTurn:s.turn,facts,kind:type,role:r};
      const charFields=Object.fromEntries(String(n.description).split(/[\n;]/).map(line=>{const at=line.indexOf(':');return at<0?[]:[norm(line.slice(0,at)).trim(),line.slice(at+1).trim()];}).filter(row=>row.length));
      for(const [key,value]of Object.entries(charFields)){const topic=factAliases[key];if(topic&&topic!=='name')put(topic,value,{source:'author-character'});}
      for(const entry of lines){const [name,rawTopic,text,rawRules]=entry.args;if(norm(name)!==norm(n.name))continue;
        if(['биография npc','факт npc'].includes(entry.key)&&rawTopic&&text){const topic=factAliases[norm(rawTopic)]||rawTopic,policy=rules(rawRules);if(topic==='name')continue;put(topic,text,{source:'author-biography',...(policy.depth!==undefined?{depth:policy.depth}:{}),...(Object.keys(policy).length?{policy}:{})});}
        if(entry.key==='секрет npc'&&rawTopic){const policy={guarded:true,trust:3,...rules(text)};put('secret',rawTopic,{depth:5,source:'author-secret',policy});}
        if(entry.key==='раскрытие npc'&&rawTopic){const topic=factAliases[norm(rawTopic)]||rawTopic,policy=rules(text);for(const value of facts[topic]||[])value.policy={...policy,...(topic==='secret'&&!Object.keys(policy).length?{guarded:true}:{})};}
      }
      root.ConversationMemory.init(n);
    }
  }
  function applicable(n,id){return !(n.identity.kind!=='human'&&['age','childhood','old_home','food','drink','sleep','family'].includes(id));}
  root.NpcBiography={roles,init,fact,applicable,aliases:factAliases};
})(globalThis);
