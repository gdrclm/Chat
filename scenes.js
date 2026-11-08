/* Local scenes and research: authored facts, explicit sources, persistent observations. */
(function(root){
  'use strict';
  root.StoryScenes={create(H){
    const {clean,norm,words,stem,hash,clone,addEntity,log,emit,truth,npc,here,findLocation,openGrievances,voice}=H;
    const packs={
      street:{description:'Узкая улица соединяет лавку с городом. У поворота стоит фонарь; вдоль мостовой тянется водосток.',features:[
        {key:'lamp',label:'уличный фонарь',aliases:['фонарь'],description:'На основании фонаря выбит знак: шестерня с разомкнутым зубцом.',fact:{key:'street.mark',text:'На уличном фонаре есть знак шестерни с разомкнутым зубцом.',topics:['знак','шестерня','гильдия']}},
        {key:'drain',label:'решётка водостока',aliases:['водосток','решётка'],description:'Один край решётки не закреплён. Её можно приподнять без инструмента.',fact:{key:'street.loose-grate',text:'Решётка водостока отходит с одного края.',unlocks:['сдвинуть решётку']}},
        {key:'wire',label:'моток проволоки',aliases:['проволока'],kind:'tool',portable:true,visibility:'hidden',description:'Под решёткой зацепился короткий, но целый моток проволоки.',discovery:{flag:'grate-moved'}}
      ]},
      city:{description:'У городского перекрёстка сходятся дороги к рынку, мастерской и площади. На доске объявлений висят заказы; рядом на стене вырезан знак.',features:[
        {key:'board',label:'доска объявлений',aliases:['объявления','объявление'],description:'На доске два предложения: мастер ищет помощь с механизмом, на рынке нужен доставщик. Ни одно не требует заниматься тайной лавки.',fact:{key:'city.jobs',text:'В мастерской предлагают ремонт, на рынке — доставку. Можно обратиться к нанимателям.',unlocks:['спросить о ремонте','спросить о доставке']}},
        {key:'mark',label:'знак гильдии',aliases:['знак','символ','метка'],description:'На стене вырезан знак шестерни с разомкнутым зубцом. Его назначение пока непонятно.',fact:{key:'city.mark',text:'На городской стене замечена метка шестерни с разомкнутым зубцом.',topics:['знак','шестерня','гильдия'],unlocks:['спросить мастера о знаке']}},
        {key:'sheet',label:'чистый лист бумаги',aliases:['бумага','лист'],kind:'prop',portable:true,visibility:'survey',description:'Чистый лист лежит под доской для копирования заказов.'}
      ]},
      workshop:{description:'В мастерской пахнет нагретым металлом. На верстаке разобран механизм, рядом — ящик с инструментами. Дверца кладовой прикрыта; личный ящик мастера стоит отдельно.',features:[
        {key:'bench',label:'верстак',description:'На верстаке есть тиски и место для обработки небольшой детали. Для работы нужно разрешение мастера.',fact:{key:'workshop.bench',text:'На верстаке можно изготовить штифт, если есть проволока, инструменты и разрешение.',unlocks:['изготовить штифт']}},
        {key:'mechanism',label:'повреждённый механизм',aliases:['механизм','узел','устройство','поломка'],description:'Узел разобран. Одна шестерня смещается вбок: ей не хватает удерживающего штифта.',condition:'broken',fact:{key:'repair.diagnosis',text:'Шестерня механизма смещается: удерживающий штифт отсутствует.',unlocks:['проверить комплект деталей']}},
        {key:'tools',label:'ящик с инструментами',aliases:['инструменты','ящик инструментов'],description:'В ящике лежат плоскогубцы и напильник. Ими можно обработать проволоку на верстаке после разрешения мастера.',fact:{key:'workshop.tools',text:'Плоскогубцы и напильник доступны на рабочем месте с разрешения мастера.',unlocks:['попросить разрешение на инструменты']}},
        {key:'store',label:'дверца кладовой',aliases:['кладовая','дверца'],description:'За дверцей слышно, как дребезжат металлические заготовки. Сама дверь прикрыта, а не заперта.',sound:'Прикосновение к двери заставляет звякнуть сложенные внутри обрезки металла.',fact:{key:'workshop.stock',text:'В кладовой хранятся заготовки; запасной штифт мастер уже искал и не нашёл.'}},
        {key:'private',label:'личный ящик мастера',aliases:['личный ящик','ящик мастера'],private:true,description:'Это личный ящик. Его содержимое не выставлено для общего осмотра.'}
      ]},
      market:{description:'На рынке отведено место для доставки у прилавка. На весах лежат товары, а на стойке вывешены цены. В стороне — мешок посылок с бумажными бирками.',features:[
        {key:'counter',label:'рыночный прилавок',aliases:['прилавок','товары','цены'],description:'На прилавке указаны цены: молоток — 3 монеты, цепочка и книга — по 2. Подтверждённая рекомендация мастера даёт скидку.',fact:{key:'market.prices',text:'Рекомендацию мастера можно показать торговцу для скидки на инструмент.',unlocks:['показать рекомендацию']}},
        {key:'scales',label:'торговые весы',aliases:['весы'],description:'Пустые чаши весов стоят на одном уровне. Пока нет основания считать их неисправными.',fact:{key:'market.scales',text:'Проверка пустых весов не выявила перекоса.'}},
        {key:'parcels',label:'мешок посылок',aliases:['посылки','мешок','бирки','бирка'],description:'Бирки на мешке помечены номерами маршрутов. Проще узнать условия доставки у Ники, чем трогать чужие отправления.',private:true,fact:{key:'market.delivery',text:'Ника передаёт посылку только после согласования доставки.',unlocks:['попросить доставку']}}
      ]},
      square:{description:'На площади стоят скамья, городская схема и архивная доска. Здесь собирают местные истории и принимают почту.',features:[
        {key:'map',label:'городская схема',aliases:['схема','карта города','маршруты'],description:'На схеме отмечены выходы к рынку и мастерской через городской перекрёсток. Сам рисунок не создаёт новых проходов.',fact:{key:'square.routes',text:'Рынок и мастерская связаны с площадью через город.',unlocks:['планировать обратный маршрут']}},
        {key:'archive',label:'архивная доска',aliases:['архивная доска','архив'],description:'В местной записи объясняется, что знак разомкнутой шестерни ставят у служебных проходов мастеров. Сведения пригодятся, если вы сами нашли такой знак.',fact:{key:'square.guild',text:'Разомкнутая шестерня обозначает служебный проход гильдии мастеров.',topics:['гильдия','знак'],requires:['city.mark']}},
        {key:'bench',label:'скамья',description:'Скамья стоит свободно. Её можно отодвинуть, но не стоит ожидать тайник без каких-либо оснований.',movable:true}
      ]}
    };
    const roleAliases={street:['улица'],city:['город'],workshop:['мастерская'],market:['рынок'],square:['площадь']};
    const ok=(text,code,information)=>({status:'success',code,text,information,effects:[]});
    const fail=(status,code,text)=>({status,code,text,effects:[]});
    function role(node){return node.role||Object.keys(roleAliases).find(key=>roleAliases[key].some(v=>norm(node.name)===v))||'custom';}
    function research(s){
      const p=s.world.player;p.research||={knowledge:{},observations:{},capabilities:[],properties:{},skills:{}};
      s.world.loops.exploration.observed||=[];s.world.loops.exploration.understood||=[];
      s.world.loops.social.noticed||=[];s.world.loops.social.encountered||=[];return p.research;
    }
    function fact(s,key){return research(s).knowledge[key];}
    function know(s,spec,source,locationId){
      const r=research(s),id=spec.id||spec.key;if(r.knowledge[id])return false;
      const value={id,text:spec.text,sourceId:source.id,locationId,turn:s.turn,topics:spec.topics||[],unlocks:spec.unlocks||[],story:Boolean(spec.story)};
      r.knowledge[id]=value;
      if(['city.mark','street.mark'].includes(id)&&!s.threads.some(t=>t.id==='guild-passage'))s.threads.push({id:'guild-passage',text:'Узнать смысл меток мастеров и найти связанный с ними проход.',status:'open'});
      if(id==='route.guild'){const thread=s.threads.find(t=>t.id==='guild-passage');if(thread){thread.status='resolved';thread.resolution=value.text;}}
      s.world.loops.exploration.discoveries.push(id);
      for(const cap of value.unlocks)if(!r.capabilities.includes(cap))r.capabilities.push(cap);
      if(value.story){s.clocks.discovery=Math.min(6,s.clocks.discovery+1);s.stage=Math.max(1,s.stage);}
      emit(s,'knowledge_learned',id,null,value);log(s,'discovery',value.text);return true;
    }
    function rootFact(s,p,config){
      const raw=clean(config.canon);const explicit=/^улика\s*:/imu.test(raw);
      const chosen=clean(raw.match(/^источник улики\s*:\s*(.+)$/imu)?.[1]);
      const root=s.world.locations.find(l=>l.id===s.world.startId);
      const candidates=s.entities.filter(e=>e.kind==='clue'&&(e.source==='scene'||explicit)&&(e.location===root.name||e.location==='inventory'||norm(e.label)===norm(p.object)));
      const barrier=s.entities.find(e=>e.kind==='barrier'&&e.location===root.name&&norm(e.label)===norm(p.canon['преграда']||p.barrier));
      if(barrier&&!barrier.revelationSpec){const explicitResult=p.canon['развязка'];if(explicitResult||!p.canon['преграда']&&barrier.source==='scene')barrier.revelationSpec=explicitResult||p.reveal;}
      const source=chosen?candidates.find(e=>norm(e.label).includes(norm(chosen))):candidates[0];
      for(const e of s.entities)if(e.kind==='barrier'&&e.opened)e.revelationKnown=true;
      if(source&&!source.localFacts){source.localFacts=[{key:'main.clue:'+source.id,text:p.clue,story:true,requiresOpen:/письм|конверт/.test(norm(source.label)),topics:['печать','улика']}];source.description='Источник сведений: '+source.label;}
      for(const e of s.entities.filter(e=>e.known===false&&!e.discovery))e.discovery={method:'survey'};
    }
    function init(s,p,config){
      research(s);
      if(s.world.sceneVersion===1){H.spatial.init(s);return;}
      rootFact(s,p,config);
      const urban=!['space','survival','sea'].includes(p.genre);
      for(const node of s.world.locations){
        node.scene||={description:node.id===s.world.startId?clean(config.world):'Место: '+node.name+'.',features:[],observed:{},discoveries:{},events:[],revision:0};
        const empty=node.id===s.world.startId&&/пустая|нет предметов|ничего нет/.test(norm(config.world));
        const authorObjects=node.id===s.world.startId&&/^предметы\s*:/imu.test(config.canon||'');
        const template=urban&&!empty&&!authorObjects?packs[role(node)]:null;
        if(template){
          node.scene.description=template.description;
          const owner=Object.values(s.world.npcs).find(n=>n.location===node.id);
          for(const spec of template.features){
            const e=addEntity(s,spec.label,{id:node.id+':'+spec.key,source:'local-scene',location:node.name,kind:spec.kind||'fixed',portable:Boolean(spec.portable),known:!['hidden','survey'].includes(spec.visibility),hidden:spec.visibility==='hidden',description:spec.description,localKey:spec.key,localRole:role(node),aliases:spec.aliases||[],ownerId:owner?.id||null,private:Boolean(spec.private),movable:Boolean(spec.movable),condition:spec.condition||null,sound:spec.sound||null,discovery:spec.discovery||{method:spec.visibility==='survey'?'survey':'examine'}});
            e.localFacts=spec.fact?[clone(spec.fact)]:[];node.scene.features.push(e.id);
          }
          if(owner){owner.expertise||={};if(role(node)==='workshop'){
            owner.expertise['guild.sign']={text:'Разомкнутая шестерня отмечает служебный проход. У фонаря можно найти короткую дорогу к мастерской.',requires:['city.mark','street.mark'],unlocks:['проверить служебный проход']};
            owner.expertise['repair.pin']={text:'Штифт можно сделать из проволоки на верстаке плоскогубцами и напильником.',unlocks:['изготовить штифт']};
          }}
        }
      }
      const oldWork=s.world.loops.work;
      if(oldWork.type==='repair'&&['completed','paid'].includes(oldWork.status)){const employer=s.world.npcs[oldWork.employer];const place=employer&&s.world.locations.find(l=>l.id===employer.location);const machine=place&&s.entities.find(e=>e.localKey==='mechanism'&&e.location===place.name);if(machine){machine.condition='repaired';machine.label='исправный механизм';machine.pinInstalled=true;machine.tested=true;}}
      s.world.sceneFlags||={};s.world.sceneVersion=1;H.spatial.init(s);
    }
    function node(s){return s.world.locations.find(l=>l.id===s.world.player.location);}
    function local(s,e){return e&&(e.location===s.place||e.location==='inventory'||e.location===s.world.activeNpcId)&&!e.destroyed&&H.containerAccess(s,e);}
    function isVisible(s,e){return !e.hidden&&e.known&&local(s,e);}
    function names(a,b){if(words(b).length===1&&stem(b).length>=3&&words(a).map(stem).includes(stem(b)))return true;const nouns=v=>words(v).filter(w=>!/(?:ый|ий|ая|ое|ые|ую|ой|ого|ыми|ную)$/.test(w)).map(stem);const tokens=nouns(a);return nouns(b).filter(w=>w.length>=3).some(w=>tokens.includes(w));}
    function method(text){const q=norm(text);return /слуш|прислуш/.test(q)?'listen':/загляд|под стол|под скам|обыск|ищу|поиск|обшар/.test(q)?'search':/провер|испыт|хватает|деталей/.test(q)?'check':/чита|прочита/.test(q)?'read':'examine';}
    function resolve(s,text){
      const q=norm(text),m=method(text);
      if(/хватает.*детал|комплект.*детал/.test(q))return {method:'check',entity:s.entities.find(e=>e.localKey==='mechanism'&&e.location===s.place),target:'детали'};
      let target=clean(H.normalizedInput(text)).replace(/^\s*(?:я\s+)?(?:осматриваюсь|осмотреться|оглядываюсь|оглядеться|озираюсь|осмотрюсь|осматриваю|осмотреть|осмотрю|оглядеть|исследую|исследовать|изучаю|изучить|рассматриваю|разглядываю|проверяю|проверить|слушаю|прислушиваюсь|читаю|прочитать|прочитаю|обыскиваю|ищу|заглядываю)\s*/iu,'').replace(/[.!?]+$/,'').trim();
      target=target.replace(/\s+(?:возле|около|рядом с)\s+.*$/iu,'').replace(/^(?:в|на|под|за|к)\s+/iu,'').trim();
      if(!target||/^(?:вокруг|помещение|комнату|место|все|всё|окрестности)$/iu.test(target))return {method:m==='examine'?'survey':m,scene:node(s),target:''};
      const place=findLocation(s,target);
      if(place&&(/^(?:город|мастерск|рынок|площад|улиц|лавк|сад)/.test(norm(target))||norm(target)===norm(place.name)))return {method:m==='examine'?'survey':m,scene:place,target};
      let candidates=s.entities.filter(e=>[e.label,...(e.aliases||[])].some(label=>names(target,label)));
      if(/^(?:его|ее|это|этот предмет)$/iu.test(target))candidates=s.entities.filter(e=>e.id===s.focus);
      const exact=candidates.find(e=>[e.label,...(e.aliases||[])].some(l=>norm(l)===norm(target)));
      const entity=exact||candidates.find(e=>local(s,e))||candidates[0];return {method:m,entity,target};
    }
    function availableFact(s,e,spec,m){
      if(spec.requiresOpen&&!e.opened)return false;
      if(spec.requires&&!spec.requires.every(k=>fact(s,k)))return false;
      return !spec.methods||spec.methods.includes(m);
    }
    function canReveal(s,e,m){
      const d=e.discovery||{};
      if(d.flag&&!s.world.sceneFlags[d.flag])return false;
      if(d.requires&&!d.requires.every(k=>fact(s,k)))return false;
      return !d.method||d.method===m;
    }
    function fingerprint(s,where){
      return hash(JSON.stringify({description:where.scene.description,objects:s.entities.filter(e=>e.location===where.name).map(e=>[e.id,e.known,e.hidden,e.opened,e.openingDegree,e.containerId,e.supportId,e.destroyed,e.condition,e.moved,e.pinInstalled]),actors:Object.values(s.world.npcs).filter(n=>n.location===where.id).map(n=>n.id),revision:where.scene.revision}));
    }
    function entryBlocks(s,phase='observation'){
      const where=node(s);const seen=s.entities.filter(e=>e.location===s.place&&e.known&&!e.hidden&&!e.destroyed&&H.containerAccess(s,e));
      const social=s.world.loops.social;
      for(const n of Object.values(s.world.npcs).filter(n=>n.location===where.id)){if(!social.noticed.includes(n.id))social.noticed.push(n.id);if(!social.encountered.includes(n.id))social.encountered.push(n.id);}
      const repaired=role(where)==='workshop'&&s.entities.some(e=>e.localKey==='mechanism'&&e.location===s.place&&e.condition==='repaired');
      const description=repaired?'В мастерской на верстаке работает собранный механизм. Причина прежней поломки устранена; инструменты сложены рядом.':where.scene.description;
      return [{kind:'location',locationId:where.id,phase,text:description},...(seen.length?[{kind:'visible',locationId:where.id,phase,text:'Видно: '+seen.map(e=>'«'+e.label+'»').slice(0,5).join(', ')+'.'}]:[])];
    }
    function entry(s){return entryBlocks(s).map(block=>block.text).join(' ');}
    function describe(s,e){
      if(e.localKey==='mechanism')return e.condition==='repaired'?'Механизм собран и работает ровно. Штифт удерживает шестерню; прежней поломки больше нет.':e.pinInstalled?'Штифт установлен. Осталось проверить ход механизма.':e.description;
      if(e.localKey==='bench'&&s.entities.some(v=>v.localKey==='mechanism'&&v.location===s.place&&v.condition==='repaired'))return 'На верстаке лежат следы завершённой работы; механизм уже собран. Здесь можно выполнять обслуживание.';
      if(e.localKey==='drain'&&s.world.sceneFlags['grate-moved'])return 'Решётка сдвинута. Участок водостока под ней доступен.';
      if(e.destroyed)return 'Предмет разрушен.';
      if(e.writtenText)return 'На записи: «'+e.writtenText+'».';
      if(e.evidence)return 'На носителе записано: '+e.evidence.proposition.text+'. Это содержание улики, а не доказанная истина.';
      if(e.kind==='barrier')return '«'+e.label+'» '+(e.openingDegree==='slightly'?'приоткрыт':e.opened?'открыт':e.locked?'заперт':'закрыт, но не заперт')+'.'+(e.opened&&e.openingDegree!=='slightly'?' '+H.containerText(s,e):'');
      return e.description||'«'+e.label+'»: '+(e.portable?'предмет можно переносить':'объект используется на месте')+'.';
    }
    function sourceFacts(s,e){
      if(e.evidence)return [{key:'text:'+e.id+':'+hash(e.evidence.proposition.text),text:'На «'+e.label+'» записано: '+e.evidence.proposition.text,topics:['содержание']}];
      if(e.writtenText)return [{key:'text:'+e.id+':'+hash(e.writtenText),text:'В записи: '+e.writtenText,topics:['запись']}];
      if(e.kind==='barrier'&&e.opened&&e.openingDegree!=='slightly'&&e.revelationText)return [{key:'revelation:'+e.id,text:e.contentsDefined?H.containerText(s,e):e.revelationText}];
      if(e.localKey==='mechanism'&&e.condition==='repaired')return [{key:'repair.working',text:'Механизм исправен: установленный штифт удерживает шестерню.'}];
      return e.localFacts||[];
    }
    function rememberProperties(s,e,m){
      const r=research(s),old=r.properties[e.id]||{};
      const material=/серебрян/.test(norm(e.label))?'серебро':/деревян/.test(norm(e.label))?'дерево':/медн/.test(norm(e.label))?'медь':old.material||null;
      r.properties[e.id]={...old,portable:e.portable,opened:e.opened,locked:e.locked,condition:e.condition,destroyed:e.destroyed,material,unlocks:old.unlocks||[],sourceLocationId:node(s).id,lastMethod:m,testedMethods:[...new Set([...(old.testedMethods||[]),m])]};
    }
    function inspect(s,text,semantic){
      if(semantic?.referenceError||semantic?.targetRef&&semantic.targetRef.kind!=='entity')return H.spatial.inspect(s,semantic);
      const selected=semantic?.recognized&&(semantic.targetId||semantic.locationId||semantic.target==='current_location');
      const selection=selected?{entity:semantic.targetId&&s.entities.find(e=>e.id===semantic.targetId),scene:semantic.locationId?s.world.locations.find(l=>l.id===semantic.locationId):semantic.target==='current_location'?node(s):null,method:semantic.method||'examine',target:semantic.target}:resolve(s,text),where=node(s),r=research(s),m=selection.method;
      if(selection.scene&&selection.scene.id!==where.id)return fail('refused','location_elsewhere','Для исследования места «'+selection.scene.name+'» сначала нужно туда перейти.');
      if(!selection.scene&&!selection.entity)return fail('clarification','unknown_research_target','Такого объекта здесь не установлено. Назовите существующую деталь или осмотритесь.');
      if(selection.scene){
        const before=fingerprint(s,where);const previous=where.scene.observed[m];let revealed=[];
        for(const e of s.entities.filter(e=>e.location===s.place&&!e.destroyed&&!e.known&&H.containerAccess(s,e)))if(canReveal(s,e,m)){e.known=true;e.hidden=false;revealed.push(e.label);}
        const stamp=fingerprint(s,where);
        const visible=s.entities.filter(e=>e.location===s.place&&isVisible(s,e));
        if(previous===stamp&&!revealed.length)return ok('Обстановка не изменилась.'+(visible.length?' Можно сосредоточиться на '+visible.map(e=>'«'+e.label+'»').slice(0,4).join(', ')+'.':' Доступных объектов для изучения нет.'),'already_observed',{novel:false,locationId:where.id,discoveries:[]});
        const first=!Object.keys(where.scene.observed).length;const changed=where.scene.lastObservedState&&where.scene.lastObservedState!==stamp;where.scene.observed[m]=stamp;where.scene.lastObservedState=stamp;
        if(!s.world.loops.exploration.observed.includes(where.id))s.world.loops.exploration.observed.push(where.id);
        const opportunities=visible.slice(0,6).map(e=>'изучить '+e.label);
        for(const cap of opportunities)if(!r.capabilities.includes(cap))r.capabilities.push(cap);
        const findings=[];
        for(const label of revealed){const e=s.entities.find(v=>v.label===label&&v.location===s.place);if(e&&know(s,{key:'noticed:'+e.id,text:'Замечен доступный предмет: '+e.label,unlocks:e.portable?['взять '+e.label]:[]},e,where.id))findings.push('noticed:'+e.id);}
        const actors=Object.values(s.world.npcs).filter(n=>n.location===where.id);for(const person of actors)if(!s.world.loops.social.noticed.includes(person.id))s.world.loops.social.noticed.push(person.id);
        const ambient=m==='listen'?s.entities.filter(e=>e.location===s.place&&e.sound&&!e.destroyed).map(e=>e.sound).join(' ')||'Вы прислушиваетесь. Новых звуков не обнаружено.':entry(s);
        const result=ok((changed?'С прошлого осмотра обстановка изменилась. ':'')+ambient+(revealed.length?'\nПри осмотре заметно: '+revealed.join(', ')+'.':''),'scene_observed',{novel:first||before!==stamp||previous!==stamp,locationId:where.id,discoveries:findings,opportunities});
        result.narration=[...(changed?[{kind:'change',locationId:where.id,text:'С прошлого осмотра обстановка изменилась.'}]:[]),...(m==='listen'?[{kind:'observation',locationId:where.id,text:ambient}]:entryBlocks(s)),...(revealed.length?[{kind:'findings',locationId:where.id,text:'При осмотре заметно: '+revealed.join(', ')+'.'}]:[])];return result;
      }
      const e=selection.entity;
      if(e.destroyed){
        if(e.location!==s.place)return fail('refused','source_unavailable','Прежний предмет уже использован, разрушен или изменён.');
        return ok('«'+e.label+'» разрушен. Прежнее содержимое и свойства больше нельзя использовать как раньше.','destroyed_state',{novel:false,sourceId:e.id,discoveries:[]});
      }
      if(!local(s,e))return fail('refused','target_elsewhere','«'+e.label+'» находится в другом месте.');
      if((!e.known||e.hidden)&&!canReveal(s,e,m))return fail('refused','discovery_conditions','С этой позиции содержимое недоступно. Нужен подходящий способ или открытый доступ.');
      if(!e.known||e.hidden){e.known=true;e.hidden=false;}
      if(e.private&&!permission(s,e,'private'))return privateReaction(s,e);
      s.focus=e.id;
      rememberProperties(s,e,m);
      if(m==='listen'&&!e.sound)return ok('Вы прислушиваетесь к «'+e.label+'». Новых звуков не обнаружено.','no_new_information',{novel:false,discoveries:[]});
      const discoveries=[];let details=[];
      if(m==='check'&&/детал/.test(norm(selection.target))&&e.localKey==='mechanism'){
        if(!fact(s,'repair.diagnosis'))return fail('clarification','diagnosis_required','Сначала изучите механизм и определите поломку.');
        const spec={key:'repair.missing-pin',text:'В комплекте нет подходящего штифта. Его можно изготовить из проволоки.',unlocks:['изготовить штифт из проволоки']};if(know(s,spec,e,where.id))discoveries.push(spec.key);details.push(spec.text);
      }else for(const spec of sourceFacts(s,e))if(availableFact(s,e,spec,m)){if(know(s,spec,e,where.id))discoveries.push(spec.key);details.push(spec.text);}
      if(sourceFacts(s,e).some(f=>f.requiresOpen)&&!e.opened)details.push('Содержимое закрыто. Сначала раскройте источник, чтобы читать его.');
      const key=e.id+':'+m;const state=hash(JSON.stringify([e.opened,e.openingDegree,e.destroyed,e.condition,e.moved,e.evidence,e.writtenText,describe(s,e),details]));
      if(r.observations[key]===state&&!discoveries.length&&!(e.localKey==='lamp'&&fact(s,'guild.sign')&&!fact(s,'route.guild')))return ok('Новых сведений о «'+e.label+'» нет. Последние наблюдения не изменились.','already_observed',{novel:false,discoveries:[]});
      r.observations[key]=state;rememberProperties(s,e,m);
      if(discoveries.length&&!s.world.loops.exploration.understood.includes(where.id))s.world.loops.exploration.understood.push(where.id);
      if(discoveries.includes('square.guild'))unlockGuildKnowledge(s,e,where);
      const shortcut=e.localKey==='lamp'?openShortcut(s,e):'';
      let ownerReaction='';const owner=s.world.npcs[e.ownerId];
      if(owner&&here(s,owner)&&e.localRole==='workshop'&&['bench','tools'].includes(e.localKey)){owner.memory.researchNotices||={};if(!owner.memory.researchNotices[e.id]){owner.memory.researchNotices[e.id]=s.turn;emit(s,'npc_research_reaction',owner.id,null,{itemId:e.id,kind:'public_workplace'});ownerReaction='\n'+owner.name+': «Если хотите поработать, сначала договоримся об инструментах». ';}}
      const extra=discoveries.length?'\nТеперь можно: '+[...new Set(discoveries.flatMap(id=>r.knowledge[id]?.unlocks||[]))].join('; '):'';
      return ok((m==='listen'?e.sound:describe(s,e))+(details.length?'\n'+[...new Set(details)].filter(d=>!describe(s,e).includes(d)).join('\n'):'')+(extra.endsWith(': ')?'':extra)+shortcut+ownerReaction,'object_studied',{novel:true,sourceId:e.id,locationId:where.id,discoveries,opportunities:r.capabilities.slice(-6)});
    }
    function permission(s,e,type='tools'){
      return !e.ownerId||s.world.player.permissions?.[e.ownerId]?.[type]===true;
    }
    function privateReaction(s,e){
      const owner=s.world.npcs[e.ownerId];
      if(owner&&here(s,owner)){
        owner.memory.researchWarnings||={};
        if(!owner.memory.researchWarnings[e.id]){owner.memory.researchWarnings[e.id]=s.turn;emit(s,'npc_research_reaction',owner.id,null,{itemId:e.id,reason:'private_object'});}
        return fail('refused','private_requires_permission',owner.name+': «Это личные вещи. Сначала спросите разрешение». Содержимое не открыто.');
      }
      return fail('refused','private_requires_permission','Для осмотра личного содержимого нужно разрешение владельца.');
    }
    function unlockGuildKnowledge(s,source,where){
      know(s,{key:'guild.sign',text:'Знак разомкнутой шестерни связан со служебным проходом мастеров.',unlocks:['проверить проход у фонаря']},source,where.id);
    }
    function openShortcut(s,lamp){
      if(!fact(s,'guild.sign'))return '';
      const from=s.world.locations.find(n=>role(n)==='street'),to=s.world.locations.find(n=>role(n)==='workshop');
      if(!from||!to)return '';
      if(s.world.edges.some(e=>e.from===from.id&&e.to===to.id))return '';
      s.world.edges.push({from:from.id,to:to.id,barrierId:null,sourceId:lamp.id},{from:to.id,to:from.id,barrierId:null,sourceId:lamp.id});
      const key='route.guild';know(s,{key,text:'У фонаря найден служебный проход: улица ↔ мастерская.',unlocks:['пройти в мастерскую коротким путём']},lamp,from.id);
      emit(s,'route_discovered',key,null,{from:from.id,to:to.id,sourceId:lamp.id});return '\nСмысл метки теперь понятен: найден служебный проход прямо в мастерскую. Он появился на карте.';
    }
    function interact(s,c){
      if(!/отодвига|сдвига|приподнима|передвига|постучу|стучу по|заглядыва/.test(c.lower))return null;
      if(/заглядыва/.test(c.lower))return inspect(s,c.text);
      const e=s.entities.find(v=>v.location===s.place&&!v.destroyed&&[v.label,...(v.aliases||[])].some(a=>names(c.text,a)));
      if(!e)return fail('clarification','unknown_environment_target','Такого элемента окружения здесь нет. Сначала назовите существующий объект.');
      if(/стучу по|постучу/.test(c.lower))return ok('Стук по «'+e.label+'» '+(e.sound?e.sound:'не выявляет новых особенностей. Звуки не доказывают существование тайника.'),'environment_test',{novel:false,discoveries:[]});
      if(e.localKey==='drain'){
        if(!fact(s,'street.loose-grate'))return fail('clarification','inspect_fastening_first','Сначала проверьте, как закреплена решётка.');
        if(s.world.sceneFlags['grate-moved'])return ok('Решётка уже сдвинута.','already_changed',{novel:false,discoveries:[]});
        e.moved=true;s.world.sceneFlags['grate-moved']=true;
        const wire=s.entities.find(v=>v.localKey==='wire'&&v.location===s.place);if(wire){wire.known=true;wire.hidden=false;}
        const fresh=wire&&know(s,{key:'street.wire-found',text:'Под сдвинутой решёткой найден моток проволоки.',unlocks:['взять проволоку']},wire,node(s).id);
        return ok('Решётка поддаётся. Под ней виден существовавший там моток проволоки; теперь его можно взять.','environment_changed',{novel:true,discoveries:fresh?['street.wire-found']:[]});
      }
      if(e.movable){if(e.moved)return ok('«'+e.label+'» уже отодвинута; новых деталей нет.','already_changed',{novel:false,discoveries:[]});e.moved=true;return ok('Вы отодвигаете «'+e.label+'». Под ней нет заданных предметов или тайника.','environment_changed',{novel:true,discoveries:[]});}
      return fail('refused','not_movable','«'+e.label+'» не сдвинуть таким способом. Можно изучить крепление или выбрать другой подход.');
    }
    function localOwner(s){return Object.values(s.world.npcs).find(n=>n.location===s.world.player.location);}
    function grantPermission(s,n,type='tools'){
      s.world.player.permissions||={};s.world.player.permissions[n.id]||={};s.world.player.permissions[n.id][type]=true;
      emit(s,'permission_granted',n.id,null,{type,player:'player'});
    }
    function npcInteraction(s,p,c,a){
      const n=npc(s),e=a.targetId&&s.entities.find(v=>v.id===a.targetId);
      if(!n||!here(s,n))return null;
      if(/разреш|можно.*(?:инструмент|верстак|ящик)|возьму.*инструмент/.test(c.lower)){
        const privateAccess=/личн/.test(c.lower);
        const owned=s.entities.some(item=>item.ownerId===n.id&&item.location===s.place&&(privateAccess?item.private:item.localRole==='workshop'&&['bench','tools'].includes(item.localKey)));
        if(!owned)return null;
        if(openGrievances(n).length)return fail('refused','unresolved_conflict',n.name+': «Сначала нужно уладить нашу ссору».');
        if(privateAccess&&s.trust<2)return fail('refused','private_requires_trust',n.name+': «К личным вещам я пока не готов вас допустить».');
        grantPermission(s,n,privateAccess?'private':'tools');return ok(n.name+': «Разрешаю пользоваться '+(privateAccess?'личным ящиком':'верстаком и рабочими инструментами')+'. Верните всё на место».','permission_granted',{novel:true,discoveries:[],opportunities:['пользоваться рабочим местом']});
      }
      if(/предлагаю|давай|помоги/.test(c.lower)&&/изгот[оа]в|сделать/.test(c.lower)&&(/штифт/.test(c.lower)||/его/.test(c.lower)&&n.memory.lastRecipe==='pin')&&n.expertise?.['repair.pin']){
        if(openGrievances(n).length||s.trust<0)return fail('refused','unresolved_conflict',n.name+': «Сначала уладим конфликт».');
        s.pending={kind:'joint-repair',recipe:'pin',npcId:n.id};return ok(n.name+': «Могу помочь на верстаке. Ваш материал, наши инструменты. Подтверждаете?»','joint_work_proposed',{novel:true,discoveries:[]});
      }
      if(c.intent==='agree'&&s.pending?.kind==='joint-repair'){
        if(s.pending.npcId!==n.id)return fail('refused','wrong_participant','Договорённость относится к другому мастеру.');
        if(openGrievances(n).length)return fail('refused','unresolved_conflict',n.name+': «Прежде нужно уладить ссору».');
        s.pending=null;grantPermission(s,n,'tools');return repair(s,p,{...c,question:false,lower:'изготавливаю штифт',text:'Изготавливаю штифт'});
      }
      if(c.question&&/знак|символ|метк|гильди/.test(c.lower)&&n.expertise?.['guild.sign']){
        if(!fact(s,'city.mark')&&!fact(s,'street.mark'))return ok(n.name+': «Покажите или опишите знак, который вы действительно нашли».','knowledge_context_required',{novel:false,discoveries:[]});
        const source={id:n.id};const spec=n.expertise['guild.sign'];const fresh=know(s,{key:'guild.sign',...spec},source,node(s).id);
        n.memory.discussedSign=true;return ok(n.name+': «'+spec.text+'»','local_expertise',{novel:fresh,discoveries:fresh?['guild.sign']:[]});
      }
      if(c.question&&/штифт|проволок|полом|механизм/.test(c.lower)&&n.expertise?.['repair.pin']){
        const mech=s.entities.find(v=>v.localKey==='mechanism'&&v.location===s.place);
        if(mech?.condition==='repaired')return ok(n.name+': «Механизм уже работает. Теперь его можно обслуживать, а не устранять прежнюю поломку».','current_condition',{novel:false,discoveries:[]});
        if(!fact(s,'repair.diagnosis'))return ok(n.name+': «Сначала изучите поломку на механизме».','diagnosis_required',{novel:false,discoveries:[]});
        n.memory.lastRecipe='pin';
        const hasWire=s.entities.some(e=>e.location==='inventory'&&!e.destroyed&&/проволок/.test(norm(e.label)));
        const bench=s.entities.find(e=>e.localKey==='bench'&&e.location===s.place&&!e.destroyed);
        const readiness=hasWire&&bench&&permission(s,bench)?' Всё необходимое сейчас доступно.':' Пока не хватает '+(!hasWire?'проволоки':!bench?'верстака':'разрешения на работу')+'.';
        const spec=n.expertise['repair.pin'];const fresh=know(s,{key:'repair.recipe',...spec},{id:n.id},node(s).id);
        return ok(n.name+': «'+spec.text+readiness+'»','recipe_explained',{novel:fresh,discoveries:fresh?['repair.recipe']:[]});
      }
      if((c.intent==='show'||a.intent==='show')&&e?.recommendation){
        if(!local(s,e))return fail('refused','target_elsewhere','Рекомендация находится не здесь.');
        if(!s.entities.some(item=>item.stockOwner===n.id))return ok(n.name+': «Вижу подпись мастера. Торговую скидку нужно обсуждать с продавцом на рынке».','recommendation_seen',{novel:false,discoveries:[]});
        s.world.player.discounts||={};const first=!s.world.player.discounts[n.id];s.world.player.discounts[n.id]=1;
        if(first){s.trust=Math.min(5,s.trust+1);emit(s,'trade_discount',n.id,0,1);}
        return ok(n.name+': «Подпись мастера узнаю. Для вас скидка в одну монету на эти товары».','recommendation_used',{novel:first,discoveries:[],opportunities:['купить товар со скидкой']});
      }
      if((c.intent==='show'||a.intent==='show'||c.question)&&e&&(e.kind==='clue'||e.localFacts?.length||e.writtenText)){
        if(e.evidence)return null; // The belief system handles testimony and fabricated evidence.
        n.researchKnowledge||={};
        const known=Object.values(n.researchKnowledge).filter(f=>f.sourceId===e.id);
        if(c.question&&known.length)return ok(n.name+': «Я знаю из этого источника: '+known.map(f=>f.text).join(' ')+'»','npc_source_knowledge',{novel:false,discoveries:[]});
        if(c.question&&!e.localKey)return ok(n.name+': «Я не знаю содержимого этого источника. Ваше знание само по себе не становится моим».','npc_unknown_source',{novel:false,discoveries:[]});
        if(!local(s,e))return fail('refused','target_elsewhere','Источник не находится рядом.');
        const visible=sourceFacts(s,e).filter(f=>availableFact(s,e,f,'read'));
        if(!visible.length)return ok(n.name+': «Содержимое не доступно для чтения. Сначала откройте источник».','source_unreadable',{novel:false,discoveries:[]});
        for(const f of visible)n.researchKnowledge[f.key]={...clone(f),sourceId:e.id,turn:s.turn};
        emit(s,'npc_source_read',n.id,null,{sourceId:e.id,facts:visible.map(f=>f.key)});
        return ok(n.name+': «Здесь сказано: '+visible.map(f=>f.text).join(' ')+'»','source_shared',{novel:true,discoveries:[]});
      }
      return null;
    }
    function mechanism(s){return s.entities.find(e=>e.localKey==='mechanism'&&e.location===s.place&&!e.destroyed);}
    function station(s){return s.entities.find(e=>e.localKey==='bench'&&e.location===s.place&&!e.destroyed);}
    function repair(s,p,c){
      const q=c.lower;
      const craft=/изгот[оа]в|сдела|мастерю|вытач|согну/.test(q)&&/штифт/.test(q);
      const install=/устан[оа]в|вставл|ставлю/.test(q)&&/штифт/.test(q);
      const testRun=/(?:^|[^а-я])(?:проверяю|проверить)\s+(?:ход|работу)(?:\s+(?:механизма|устройства|узла))?[.! ]*$/.test(q)||/(?:^|[^а-я])(?:запускаю|пускаю|включаю|испытываю)\s+(?:механизм|устройство|узел)/.test(q);
      const maintenance=/очища|чищу|смазыва|калибру/.test(q);
      if(c.question)return null;
      if(!craft&&!install&&!testRun&&!maintenance&&!/^(?:я )?работаю[.! ]*$/.test(q))return null;
      const mech=mechanism(s),bench=station(s);if(!mech||!bench)return fail('refused','no_workstation','Такое действие требует реального механизма и верстака в текущем месте.');
      const work=s.world.loops.work;const n=localOwner(s);
      if(n&&!permission(s,bench))return fail('refused','work_permission_required','Сначала договоритесь о работе или спросите разрешение использовать верстак.');
      if(/^(?:я )?работаю[.! ]*$/.test(q))return fail('clarification','specific_work_step','Нужен конкретный шаг: изучить механизм, проверить комплект деталей, изготовить штифт, установить его и проверить ход. Само слово «работаю» не чинит устройство.');
      if(maintenance&&mech.condition==='repaired'){
        if(work.status!=='accepted')return fail('refused','no_active_job','Сначала согласуйте обслуживание.');
        if(/калибру/.test(q)&&!mech.cleaned)return fail('clarification','clean_first','Перед калибровкой нужно очистить механизм.');
        if(/очища|чищу|смазыва/.test(q)){mech.cleaned=true;return ok('Механизм очищен. Теперь можно выполнить калибровку.','maintenance_progress',{novel:true,discoveries:[]});}
        mech.calibrated=true;work.status='completed';work.progress=2;return ok('Калибровка закончена; обслуживание выполнено. Можно получить согласованную плату.','maintenance_completed',{novel:true,discoveries:[]});
      }
      if(craft){
        if(!fact(s,'repair.diagnosis')||!fact(s,'repair.missing-pin'))return fail('clarification','diagnosis_required','Сначала изучите поломку и проверьте комплект деталей.');
        const wire=s.entities.find(e=>e.location==='inventory'&&!e.destroyed&&/проволок/.test(norm(e.label)));
        if(!wire)return fail('refused','missing_wire','При вас нет проволоки для штифта. Можно поискать материал или принести его.');
        const tools=s.entities.find(e=>e.localKey==='tools'&&e.location===s.place&&!e.destroyed);
        if(!tools)return fail('refused','missing_tools','Рабочих инструментов здесь нет.');
        wire.destroyed=true;wire.location='consumed';s.inventory=s.inventory.filter(v=>v!==wire.label);
        const pin=addEntity(s,'изготовленный штифт',{id:'pin:'+s.world.nextEvent++,location:'inventory',kind:'tool',portable:true,known:true,source:'crafted',lineage:[wire.id]});s.inventory.push(pin.label);s.focus=pin.id;
        know(s,{key:'skill.pin-making',text:'Вы умеете изготовить удерживающий штифт из проволоки на верстаке.',unlocks:['изготавливать штифты']},bench,node(s).id);research(s).skills['pin-making']=true;
        return ok('На верстаке вы делаете штифт из проволоки. Материал израсходован, штифт теперь при вас. Получено знание изготовления детали.','pin_crafted',{novel:true,discoveries:['skill.pin-making']});
      }
      if(install){
        if(mech.pinInstalled)return fail('refused','pin_already_installed','Удерживающий штифт уже установлен. Повторная установка не нужна.');
        const pin=s.entities.find(e=>e.location==='inventory'&&!e.destroyed&&/штифт/.test(norm(e.label)));
        if(!pin)return fail('refused','missing_pin','При вас нет подходящего штифта.');
        pin.location='installed:'+mech.id;s.inventory=s.inventory.filter(v=>v!==pin.label);mech.pinInstalled=true;mech.condition='assembled';
        return ok('Штифт установлен в механизм. Деталь больше не лежит отдельно в инвентаре. Осталось проверить ход.','pin_installed',{novel:true,discoveries:[]});
      }
      if(testRun){
        if(!mech.pinInstalled)return fail('refused','repair_incomplete','Механизм пока нельзя безопасно пустить: удерживающий штифт не установлен.');
        if(mech.condition==='repaired')return ok('Ход уже проверен, механизм работает. Новых результатов нет.','already_verified',{novel:false,discoveries:[]});
        mech.condition='repaired';mech.label='исправный механизм';mech.tested=true;const tools=s.entities.find(e=>e.localKey==='tools'&&e.location===s.place);if(tools)tools.tidy=true;
        if(work.status==='accepted'&&work.type==='repair'){work.status='completed';work.progress=2;}
        const first=know(s,{key:'repair.completed',text:'Механизм мастерской отремонтирован и прошёл проверку.',unlocks:['получить плату','показать рекомендацию']},mech,node(s).id);
        if(n&&first){s.trust=Math.min(5,s.trust+1);n.memory.repairDoneByPlayer=true;
          const letter=addEntity(s,'рекомендация мастера',{id:'recommendation:'+n.id,location:'inventory',kind:'clue',portable:true,known:true,source:'reward',writtenText:'Мастер подтверждает, что герой отремонтировал механизм.',recommendation:{by:n.id,for:'player'}});if(!s.inventory.includes(letter.label))s.inventory.push(letter.label);
        }
        return ok('Механизм запускается ровно. Прежняя поломка устранена. '+(n?'Мастер замечает результат и выдаёт рекомендацию: её можно показать на рынке. ':'')+(work.status==='completed'?'Работа выполнена; согласованную плату можно забрать.':''),'mechanism_repaired',{novel:true,discoveries:first?['repair.completed']:[],opportunities:['получить рекомендацию','попросить оплату']});
      }
      return null;
    }
    function write(s,c){
      if(c.intent!=='write')return null;
      const material=s.entities.find(e=>e.location==='inventory'&&!e.destroyed&&/бумаг|чистый лист/.test(norm(e.label))&&!e.writtenText);
      if(!material)return fail('refused','missing_writing_material','Для физической записи нужен чистый лист при вас. На городской доске есть бумага для копирования заказов.');
      const text=(c.text.match(/[:«]\s*([^»]+)/u)?.[1]||c.text).replace(/^\s*(?:я\s+)?(?:пишу|записываю|рисую|черчу)\s*/iu,'').trim();if(!text)return fail('clarification','missing_note_text','Что записать?');
      material.destroyed=true;material.location='consumed';s.inventory=s.inventory.filter(v=>v!==material.label);
      const note=addEntity(s,'запись героя',{id:'note:'+s.world.nextEvent++,location:'inventory',kind:'clue',portable:true,known:true,source:'player-writing',writtenText:text.slice(0,1000),lineage:[material.id]});s.inventory.push(note.label);s.focus=note.id;
      emit(s,'note_written',note.id,null,{text:note.writtenText,materialId:material.id});return ok('Вы создаёте физическую запись: «'+note.writtenText+'». Её можно читать, передать или показать. Чистый лист использован.','note_created',{novel:true,discoveries:[]});
    }
    function handle(s,p,c,config,a){
      if(c.hypothetical||c.negated)return null;
      const reaction=npcInteraction(s,p,c,a);if(reaction)return reaction;
      const writing=a.intent!=='plant_evidence'?write(s,c):null;if(writing)return writing;
      const repairResult=repair(s,p,c);if(repairResult)return repairResult;
      if(a.intent==='repair'){
        const machine=s.entities.find(e=>e.id===a.targetId);
        if(!machine)return fail('clarification','missing_repair_target','Что именно нужно починить? Назовите существующий предмет.');
        if(!local(s,machine))return fail('refused','target_elsewhere','Предмет для ремонта находится в другом месте.');
        if(machine.localKey!=='mechanism')return fail('clarification','unknown_repair_method','Для «'+machine.label+'» пока не известны поломка и способ ремонта. Уточните, что повреждено и как вы это исправляете.');
        return fail('clarification','specific_work_step',machine.condition==='repaired'?'Механизм уже работает. Для обслуживания согласуйте очистку и калибровку.':!fact(s,'repair.diagnosis')?'Сначала изучите механизм и определите поломку.':!fact(s,'repair.missing-pin')?'Проверьте комплект деталей.':'Нужны проволока, верстак и разрешение: изготовьте штифт, установите его и проверьте ход.');
      }
      const environmental=interact(s,c);if(environmental)return environmental;
      if(c.intent==='take'){
        const e=s.entities.find(v=>v.id===a.targetId);if(e?.private&&!permission(s,e,'private'))return privateReaction(s,e);
      }
      if(c.semantic?.recognized?['INSPECT','SEARCH'].includes(c.semantic.intent):/осматр|осмотр|огляд|озир|изуч|исслед|рассматри|разгляды|провер|слуш|прочита|читаю|обыски/.test(c.lower)||a.intent==='explore'){
        if(c.intent==='question'||c.speech||['claim','plant_evidence','show'].includes(a.intent))return null;
        return inspect(s,c.text,c.semantic);
      }
      return null;
    }
    function sourceLearnedAfter(s,c,a,r){
      const e=s.entities.find(v=>v.id===a.targetId);
      if(!e||r.status==='refused'||r.status==='clarification')return;
      if(e.kind==='barrier'&&e.opened&&e.revelationText&&(e.location===s.place||e.location==='inventory')){
        const key='revelation:'+e.id;const fresh=know(s,{key,text:e.revelationText},e,node(s).id);r.information={novel:fresh,sourceId:e.id,discoveries:fresh?[key]:[]};
      }
      if(e.kind==='barrier'&&e.openedWith){const tool=s.entities.find(v=>v.id===e.openedWith);if(tool){rememberProperties(s,tool,'use');const known=research(s).properties[tool.id].unlocks;if(!known.includes(e.id))known.push(e.id);}}
      if(c.intent==='open'&&e.kind==='clue'&&e.opened){
        const gained=[];for(const spec of sourceFacts(s,e))if(availableFact(s,e,spec,'read')&&know(s,spec,e,node(s).id))gained.push(spec.key);
        r.information={novel:gained.length>0,sourceId:e.id,discoveries:gained};
      }
    }
    function changed(s,before,action){
      const affected=new Set();
      for(const e of s.entities){const old=before.entities.find(v=>v.id===e.id);if(research(s).properties[e.id]&&(e.location===s.place||e.location==='inventory')){const prop=research(s).properties[e.id];prop.condition=e.condition;prop.opened=e.opened;prop.destroyed=e.destroyed;}
        if(old&&['location','opened','openingDegree','containerId','supportId','destroyed','condition','moved','pinInstalled','tidy'].every(k=>JSON.stringify(old[k])===JSON.stringify(e[k])))continue;
        for(const name of [old?.location,e.location]){const place=s.world.locations.find(n=>n.name===name);if(place)affected.add(place.id);}
      }
      for(const n of Object.values(s.world.npcs)){const old=before.relationships.find(v=>v.id===n.id);if(old&&old.location!==n.location){affected.add(old.location);affected.add(n.location);}}
      for(const id of affected){const place=s.world.locations.find(n=>n.id===id);if(!place.scene)continue;place.scene.revision++;place.scene.events.push({turn:s.turn,actionId:action.id,type:'physical_change'});place.scene.events=place.scene.events.slice(-20);}
    }
    function openedText(s,e){return sourceFacts(s,e).filter(f=>availableFact(s,e,f,'read')).map(f=>f.text).join('\n')||'В этом источнике пока нет заданных сведений.';}
    return {init,handle,inspect,entry,entryBlocks,sourceLearnedAfter,changed,openedText,fact,research,permission,grantPermission};
  }};
})(globalThis);
