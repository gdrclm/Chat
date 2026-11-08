/* Item identity, limited hands/containers, material recipes and maintainable devices. */
(function(root){'use strict';
  function create(C){
    const {require:R,result:ok,props:P,qty:Q}=C;
    const recipes=[
      {name:'верёвка',ingredients:['волокно','волокно'],functions:['tie','climb'],tools:[],output:{material:'fiber',mass:.4,length:5}},
      {name:'факел',ingredients:['палка','ткань','масло'],functions:['light','ignite'],tools:[],output:{material:'wood',mass:.8,flammability:1,brightness:.8}},
      {name:'самодельная отмычка',ingredients:['проволока'],functions:['lockpick'],tools:['pliers'],output:{material:'metal',mass:.1}},
      {name:'деревянный стул',ingredients:['доска','доска','гвоздь'],functions:['seat'],tools:['saw','hammer'],output:{material:'wood',mass:7,height:.5,width:.5,wearable:false}},
      {name:'защитный футляр',ingredients:['доска','ткань'],functions:['protect_fragile','container'],tools:['saw'],output:{material:'wood',mass:1,capacity:4,protection:3}},
      {name:'рычаг',ingredients:['палка','камень'],functions:['lever','pry'],tools:[],output:{material:'wood',mass:2,length:2}},
      {name:'камнемёт',ingredients:['доска','верёвка','камень'],functions:['moving_device','throw'],tools:['hammer'],output:{material:'wood',mass:5,range:8,moving:true}},
      {name:'суп',ingredients:['вода','овощи'],functions:['food'],tools:['heat'],output:{material:'food',mass:1,nutrition:35,hydration:20}}
    ];
    const toolNames={saw:/пил/,hammer:/молот/,pliers:/плоскогуб|напиль|инструмент/,heat:/печь|горн|костер|плит/,forge:/горн|кузнеч/};
    const tool=(s,name,actor='player')=>C.accessibleItems(s,actor).find(e=>P(e).functions.includes(name)||toolNames[name]?.test(C.norm(e.label)));
    function recipe(s,name){return [...s.world.rpg.recipes,...recipes].find(r=>C.same(r.name,name));}
    function inferRecipe(s,name,actor,text){
      const input=String(text||'').match(/\sиз\s+(.+?)(?=\s+(?:чтобы|для|с помощью)\s+|$)/iu)?.[1];if(!input)return null;
      const parts=C.match(s,input,{inventory:actor==='player',actor,all:true}).filter(e=>e.location===C.holder(s,actor));if(!parts.length)return null;
      const rigid=parts.find(e=>['wood','metal'].includes(P(e).material)),weight=parts.find(e=>e.id!==rigid?.id&&['stone','metal'].includes(P(e).material)),q=C.norm(text);let functions,output,tools=[];
      if(/рычаг|поддева|приподним|отжима/.test(q)&&rigid&&weight){functions=['lever','pry'];output={material:P(rigid).material,length:Math.max(2,P(rigid).length||1)};}
      else if(/молот|колот|наносить удар/.test(q)&&rigid&&weight){functions=['strike'];output={material:P(weight).material,damage:Math.max(1,Math.min(3,Math.floor(P(weight).mass))),block:1};}
      else if(/контейнер|футляр|сумк|переносить вещи/.test(q)&&parts.length>=2&&parts.some(e=>['cloth','wood'].includes(P(e).material))){functions=['container'];output={material:P(parts[0]).material,capacity:parts.reduce((v,e)=>v+P(e).volume,0)*2};}
      else if(/отмыч|отпира|взламывать зам/.test(q)&&parts.some(e=>P(e).material==='metal')){functions=['lockpick'];output={material:'metal'};tools=['pliers'];}
      if(!functions)return null;
      const inferred={id:C.id(s,'inferred-recipe'),name,ingredients:parts.map(e=>e.label),functions,tools,output,time:20,inferred:true,basis:parts.map(e=>({itemId:e.id,material:P(e).material,mass:P(e).mass}))};s.world.rpg.recipes.push(inferred);s.world.rpg.blueprints.push({id:C.id(s,'blueprint'),name,recipe:C.H.clone(inferred),tested:true});return inferred;
    }
    function materials(s,ingredients,actor='player'){
      const used=new Map(),selected=[];
      for(const query of ingredients){const entry=String(query).split('*'),name=entry[0].trim(),amount=C.number(entry[1],1);const e=C.accessibleItems(s,actor).find(e=>C.same(e.label,name)&&e.location===C.holder(s,actor)&&Q(e)-(used.get(e.id)||0)>=amount);
        R(e,'missing_component','Не хватает компонента «'+name+'».');used.set(e.id,(used.get(e.id)||0)+amount);selected.push({e,amount});}
      return {selected,used};
    }
    function make(s,name,actor='player',options={}){
      const r=recipe(s,name)||inferRecipe(s,name,actor,options.text);R(r,'unknown_recipe','Для такого изделия ещё нет проверенного рецепта или функционального чертежа.','clarification');
      for(const needed of r.tools||[])R(tool(s,needed,actor),'missing_craft_tool','Не хватает инструмента: '+C.functionLabel(needed)+'.');
      const {selected,used}=materials(s,r.ingredients,actor),quality=Math.min(...selected.map(v=>P(v.e).quality||1)),lineage=selected.map(v=>v.e.id);
      const mass=selected.reduce((total,v)=>total+P(v.e).mass*v.amount,0);for(const [id,amount]of used)C.consume(s,C.item(s,id),amount);
      const retainedMass=Math.min(r.output?.mass||mass,mass),e=C.add(s,r.name,{location:C.holder(s,actor),kind:(r.functions||[]).includes('food')?'food':'tool',ownerId:actor,lineage,craftedEffort:true});Object.assign(P(e),{...r.output,functions:[...(r.functions||[])],quality,mass:retainedMass,parts:[...used].map(([id,quantity])=>({sourceId:id,label:C.item(s,id)?.label,quantity,material:P(C.item(s,id)).material,mass:P(C.item(s,id)).mass*quantity*retainedMass/mass,functions:[...P(C.item(s,id)).functions]}))});e.price=Math.max(1,Math.round(mass*quality*2));
      C.event(s,'crafted',{itemId:e.id,actorId:actor,recipeId:r.id||r.name,consumed:lineage,functions:P(e).functions});C.syncInventory(s);return e;
    }
    function dismantle(s,e,actor='player'){
      const parts=P(e).parts;R(Array.isArray(parts)&&parts.length,'no_structural_parts','У предмета нет описанных извлекаемых деталей.');R(tool(s,'unfasten',actor)||tool(s,'pliers',actor)||!P(e).fastenerId,'missing_disassembly_tool','Нужен инструмент для разборки креплений.');
      const made=[];for(const part of parts){const info=typeof part==='string'?{label:part,material:P(e).material,mass:P(e).mass/parts.length}:part,quantity=info.quantity||1;const existing=info.sourceId&&C.item(s,info.sourceId);if(existing?.destroyed&&existing.location==='consumed'&&!s.entities.some(v=>v.id!==e.id&&!v.destroyed&&P(v).parts.some(p=>p.sourceId===existing.id))){existing.destroyed=false;existing.quantity=quantity;existing.location=C.holder(s,actor);P(existing).mass=(info.mass||P(e).mass/parts.length)/quantity;delete existing.containerId;made.push(existing);}else{const output=C.add(s,info.label||C.item(s,info.sourceId)?.label||'деталь '+e.label,{location:C.holder(s,actor),lineage:[e.id],quantity,ownerId:e.ownerId});Object.assign(P(output),{material:info.material||P(e).material,mass:(info.mass||P(e).mass/parts.length)/quantity,quality:P(e).quality,functions:info.functions||[]});made.push(output);}}
      e.destroyed=true;e.location='disassembled';C.syncInventory(s);return made;
    }
    function handle(s,a){const eq=s.world.player.equipment,body=s.world.player.body;
      if(a.op==='weigh')return ok('Масса груза: '+C.weight(s)+' кг. Вместимость переноски: '+body.capacity+' кг.'+(s.world.player.overloaded?' Быстрое движение и подъём ограничены.':''),'load_assessed');
      if(a.op==='run'){R(!s.world.player.overloaded,'overloaded','С таким грузом нельзя быстро двигаться.');R(!body.injuries.legs,'leg_injury','Травма ног мешает бегу.');body.stamina=Math.max(0,body.stamina-8);body.position||={x:0,y:0,z:0};body.position.x+=5;return ok('Вы быстро перемещаетесь, расходуя силы.','ran');}
      if(['craft','craft_tool','craft_recipe','craft_rope','craft_torch','craft_lockpick','craft_furniture','craft_container','craft_moving','produce_instance'].includes(a.op)){
        const name=a.product||a.targetQuery||a.text.replace(/^(?:я )?(?:делаю|создаю|изготавливаю|собираю|мастерю|изготовить|сделать)(?: ещё один| еще один| второй)?\s+/iu,'').split(/\s+из\s+/iu)[0];const e=make(s,name,'player',{text:a.text});return ok('Из имеющихся компонентов изготовлен «'+e.label+'». Каждая вещь имеет собственное состояние.','item_crafted',{time:recipe(s,name)?.time||20,itemId:e.id});
      }
      if(a.op==='discover_recipe'){
        const parts=C.match(s,a.text,{inventory:true,all:true});R(parts.length>=2,'need_experiment_materials','Нужны хотя бы два материала для опыта.');const available=new Set(parts.map(e=>P(e).material));let candidate;
        if(available.has('wood')&&available.has('stone'))candidate=recipes.find(r=>r.name==='рычаг');else if(available.has('fiber'))candidate=recipes.find(r=>r.name==='верёвка');else if(available.has('wood')&&available.has('cloth'))candidate=recipes.find(r=>r.name==='защитный футляр');R(candidate,'no_functional_recipe','Эти свойства не дают проверенной функции. Новое изделие не объявлено работающим.','clarification');
        s.world.rpg.blueprints.push({id:C.id(s,'blueprint'),name:candidate.name,recipe:C.H.clone(candidate),tested:true});return ok('По свойствам материалов найден функциональный рецепт: '+candidate.name+'. Материалы ещё не израсходованы.','recipe_discovered');
      }
      if(a.op==='blueprint'){
        const r=recipe(s,a.product||a.targetQuery);R(r,'unknown_recipe','Для чертежа нужен известный рецепт.');const paper=C.accessibleItems(s).find(e=>/бумаг|лист|записк/.test(C.norm(e.label))&&e.location==='inventory');R(paper,'missing_paper','Нужен реальный носитель.');paper.blueprint=C.H.clone(r);paper.writtenText='Чертёж: '+r.name;return ok('Чертёж записан на «'+paper.label+'».','blueprint_written');
      }
      if(a.op==='pickpocket'){
        const n=C.person(s,a,{explicit:true});R(n&&n.location===s.world.player.location,'npc_absent','Нужно находиться рядом с владельцем карманов.');const consent=s.world.player.permissions?.[n.id]?.search,noticed=C.api.physics.visible(s,n,a)&&C.skill(s,'stealth')<2;
        if(!consent&&noticed){C.H.social.record(s,'theft_attempt',{id:s.currentActionId,actor:'player',text:a.text},{targetId:n.id,ownerId:n.id});return ok('Владелец замечает попытку обыска и препятствует ей.','pickpocket_detected',{status:'refused',completed:false});}
        const found=s.entities.find(v=>v.location===n.id&&!v.destroyed&&P(v).pocketRegion);R(found,'pockets_empty','В доступных карманах вещей не обнаружено.');C.transfer(s,found,'inventory');if(!consent)C.H.social.record(s,'theft',{id:s.currentActionId,actor:'player',text:a.text},{targetId:found.id,ownerId:n.id});return ok('Вещь извлечена из кармана; принадлежность и свидетели учитываются.','pocket_searched');
      }
      const e=C.target(s,a,{inventory:['wear','armor','equip','hold_two','pocket','put_bag','hide_clothing','sharpen','clean'].includes(a.op)})||(a.op==='repair'?s.entities.find(v=>v.destroyed&&P(v).durability===0&&[s.place,'inventory'].includes(v.location)&&C.same(v.label,a.targetQuery)):null);R(e,'missing_target','Нужен существующий доступный предмет.','clarification');const p=P(e),other=a.secondaryId?C.item(s,a.secondaryId):C.match(s,a.secondary||a.text,{filter:v=>v.id!==e.id});
      if(a.op==='wear'||a.op==='armor'){
        R(p.wearable||/плащ|одежд|рубах|брон|куртк|перчат|шлем|сапог/.test(C.norm(e.label)),'not_wearable','Этот предмет нельзя надеть.');if(a.op==='armor')R(p.armor>0||/брон/.test(C.norm(e.label)),'not_armor','У вещи нет защитных свойств.');R(!eq.worn.includes(e.id),'already_worn','Вещь уже надета.');eq.worn.push(e.id);p.wornBy='player';return ok('Вы надеваете «'+e.label+'». Защита и тепло учитываются.','equipment_worn');
      }
      if(a.op==='remove_clothes'){R(eq.worn.includes(e.id),'not_worn','Эта вещь не надета.');eq.worn=eq.worn.filter(id=>id!==e.id);delete p.wornBy;if(/оставл|кладу/.test(C.norm(a.text)))C.transfer(s,e,s.place);return ok('Вы снимаете «'+e.label+'».','equipment_removed');}
      if(a.op==='equip'||a.op==='hold_two'){
        const hand=/лев/.test(C.norm(a.text))?'left':'right';R(!eq[hand]||eq[hand]===e.id,'hand_occupied','Эта рука уже занята.');eq[hand]=e.id;
        if(a.op==='hold_two'){R(other&&other.location==='inventory'&&other.id!==e.id,'missing_second_item','Нужен второй предмет при себе.');R(!eq[hand==='left'?'right':'left'],'hands_occupied','Вторая рука занята.');eq[hand==='left'?'right':'left']=other.id;}return ok('Предметы распределены по свободным рукам.','hands_equipped');
      }
      if(a.op==='switch_hand'){const old=['left','right'].find(hand=>eq[hand]===e.id);R(old,'not_held','Предмет не находится в руке.');const dest=old==='left'?'right':'left';R(!eq[dest],'hand_occupied','Другая рука занята.');eq[dest]=e.id;eq[old]=null;return ok('Предмет переложен в другую руку.','hand_switched');}
      if(a.op==='pocket'||a.op==='hide_clothing'){
        const clothing=other&&eq.worn.includes(other.id)?other:eq.worn.map(id=>C.item(s,id)).find(v=>v&&P(v).pocketCapacity>0);R(clothing,'no_worn_pocket','Нужна надетая одежда с доступным карманом или чехлом.');const capacity=P(clothing).pocketCapacity||.5,contents=Object.values(eq.pockets).map(id=>C.item(s,id)).filter(Boolean);R(contents.filter(v=>P(v).pocketClothingId===clothing.id).reduce((sum,v)=>sum+P(v).volume,0)+p.volume<=capacity,'pocket_full','Предмет не помещается.');const region=/рукав/.test(C.norm(a.text))?'sleeve':/чехол/.test(C.norm(a.text))?'sheath':'pocket';eq.pockets[clothing.id+':'+region]=e.id;p.pocketClothingId=clothing.id;p.pocketRegion=region;if(a.op==='hide_clothing'){e.concealed=true;p.concealed=true;}for(const hand of ['left','right'])if(eq[hand]===e.id)eq[hand]=null;return ok('Предмет помещён в конкретную часть одежды.','item_pocketed');
      }
      if(a.op==='put_bag'){
        const bag=other;R(bag&&P(bag).capacity>0,'missing_bag','Нужна настоящая сумка или контейнер.');R(bag.id!==e.id,'recursive_container','Нельзя поместить вещь в саму себя.');let parent=bag;const seen=new Set([e.id]);while(parent){R(!seen.has(parent.id),'recursive_container','Это создаст цикл контейнеров.');seen.add(parent.id);parent=C.item(s,parent.containerId);}const used=s.entities.filter(v=>v.containerId===bag.id&&!v.destroyed).reduce((sum,v)=>sum+P(v).volume*Q(v),0);R(used+p.volume*Q(e)<=P(bag).capacity,'container_full','В сумке недостаточно места.');e.containerId=bag.id;e.location=bag.location;bag.opened=true;bag.openingDegree='open';return ok('Предмет помещён в сумку с учётом объёма.','item_contained');
      }
      if(a.op==='split_stack'){const count=C.amount(a.text);R(count>0&&count<Q(e),'invalid_split','Нужно отделить положительное количество меньше всей стопки.');const split=C.transfer(s,e,e.location,count);return ok('Отделено '+count+' единиц в отдельную стопку «'+split.label+'».','stack_split',{itemId:split.id});}
      if(a.op==='give_partial'){const n=C.person(s,a);C.agree(s,n);const count=C.amount(a.text);R(e.location==='inventory','not_carried','Ресурс должен быть при вас.');const moved=C.transfer(s,e,n.id,count);if(moved.ownerId==='player'||!moved.ownerId)moved.ownerId=n.id;C.event(s,'resource_given',{itemId:moved.id,npcId:n.id,quantity:count});return ok('Передано '+count+' единиц. Остаток сохраняется.','partial_resource_given');}
      if(a.op==='quality')return ok('Качество: '+p.quality+'. Износ: '+p.wear+'. Прочность: '+p.durability+'/'+p.maxDurability+'.','equipment_assessed');
      if(a.op==='sharpen'){R(p.functions.includes('cut')||/нож|меч|топор/.test(C.norm(e.label)),'not_blade','У предмета нет режущей кромки.');R(tool(s,'sharpen')||C.accessibleItems(s).some(v=>/точил|камень/.test(C.norm(v.label))&&v.id!==e.id),'missing_whetstone','Нужен точильный материал.');p.sharpness=Math.min(1,(p.sharpness||0)+.5);p.wear=Math.max(0,p.wear-10);return ok('Режущая кромка заточена.','tool_sharpened',{time:20});}
      if(a.op==='clean'){R(C.accessibleItems(s).some(v=>P(v).liquid?.amount>0||/ткань|щетк/.test(C.norm(v.label))),'missing_cleaning_material','Нужны вода, ткань или щётка.');p.dirt=0;p.cleanliness=100;return ok('Снаряжение очищено. Износ и повреждения не отменены.','equipment_cleaned',{time:10});}
      if(a.op==='pickpocket'){
        const n=C.person(s,a,{explicit:true});R(n&&n.location===s.world.player.location,'npc_absent','Нужно находиться рядом с владельцем карманов.');const consent=s.world.player.permissions?.[n.id]?.search;const noticed=C.api.physics.visible(s,n,a)&&C.skill(s,'stealth')<2;
        if(!consent&&noticed){C.H.social.record(s,'theft_attempt',{id:s.currentActionId,actor:'player',text:a.text},{targetId:e.id,ownerId:n.id});return ok('Владелец замечает попытку обыска и препятствует ей.','pickpocket_detected',{status:'refused',completed:false});}
        const found=s.entities.find(v=>v.location===n.id&&!v.destroyed&&v.physical?.pocketRegion);R(found,'pockets_empty','В доступных карманах вещей не обнаружено.');C.transfer(s,found,'inventory');if(!consent)C.H.social.record(s,'theft',{id:s.currentActionId,actor:'player',text:a.text},{targetId:found.id,ownerId:n.id});return ok('Вещь извлечена из кармана; принадлежность и свидетели учитываются.','pocket_searched');
      }
      if(a.op==='secure'){eq.secured.push(e.id);return ok('Предмет закреплён на снаряжении и не выпадет при обычном падении.','equipment_secured');}
      if(a.op==='dismantle'||a.op==='salvage'){const parts=dismantle(s,e);return ok('Разборка дала реальные детали: '+parts.map(e=>e.label).join(', ')+'.','item_disassembled',{time:20});}
      if(a.op==='work_wood'){R(p.material==='wood','wrong_material','Нужно дерево.');R(tool(s,'saw')||tool(s,'cut'),'missing_cutting_tool','Нужен деревообрабатывающий инструмент.');p.shape=/паз/.test(C.norm(a.text))?'grooved':/доск/.test(C.norm(a.text))?'board':'shaped';p.wear+=2;return ok('Деревянная заготовка обработана; форма изменена.','wood_worked',{time:20});}
      if(a.op==='smelt'){R(p.material==='metal'||p.material==='ore','wrong_material','Нужен металл или руда.');const furnace=tool(s,'forge')||tool(s,'furnace');R(furnace&&P(furnace).temperature>=700,'furnace_not_hot','Нужна печь с достаточной температурой.');p.phase='liquid';p.temperature=P(furnace).temperature;if(p.material==='ore')p.material='metal';return ok('Металл расплавлен в подходящем оборудовании.','metal_smelted',{time:30});}
      if(a.op==='forge'){R(p.material==='metal'&&p.temperature>=700,'metal_not_malleable','Металл должен быть разогрет для ковки.');R(tool(s,'hammer'),'missing_hammer','Нужен молот.');p.shape=a.product||'forged_part';p.malleable=true;p.durability=Math.min(p.maxDurability,p.durability+10);return ok('Раскалённая деталь выкована.','metal_forged',{time:20});}
      if(a.op==='mold_key'){
        const mold=C.accessibleItems(s).find(v=>P(v).material==='wax'||P(v).functions.includes('mold'));R(mold&&e.unlocks?.length,'missing_key_mold','Нужны исходный рабочий ключ и материал для слепка.');P(mold).keyProfile={unlocks:[...e.unlocks],sourceId:e.id,quality:Math.min(P(mold).quality,p.quality)};return ok('Слепок хранит профиль именно этого ключа.','key_mold_created');
      }
      if(a.op==='copy_key'){
        const mold=C.accessibleItems(s).find(v=>P(v).keyProfile),metal=C.accessibleItems(s).find(v=>P(v).material==='metal'&&v.id!==mold?.id);R(mold&&metal&&tool(s,'pliers'),'missing_key_material','Нужны сохранённый слепок, металл и инструмент обработки.');const profile=P(mold).keyProfile;C.consume(s,metal);const key=C.add(s,'копия ключа',{kind:'tool',ownerId:'player',unlocks:[...profile.unlocks],lineage:[mold.id,profile.sourceId,metal.id]});P(key).quality=profile.quality;return ok('Новый экземпляр ключа соответствует снятому профилю.','key_copied',{itemId:key.id,time:30});
      }
      if(a.op==='repair'||a.op==='diagnose'){
        if(a.op==='diagnose'){R(p.durability<p.maxDurability||p.missingParts?.length||p.condition,'no_fault','Неисправность не обнаружена.');p.diagnosis={damage:p.maxDurability-p.durability,missing:[...(p.missingParts||[])],methods:[p.missingParts?.length?'replace_parts':'patch','rebuild']};return ok('Диагноз: повреждение '+p.diagnosis.damage+', отсутствует '+p.diagnosis.missing.join(', ')+'. Доступны технологии: '+p.diagnosis.methods.join(', ')+'.','fault_diagnosed');}
        R(p.durability<p.maxDurability||e.destroyed||p.condition==='broken','not_damaged','Предмет не нуждается в таком ремонте.');R(tool(s,'repair')||tool(s,'pliers'),'missing_repair_tools','Нужен подходящий инструмент.');const missing=p.missingParts||[];for(const name of missing){const part=C.match(s,name,{inventory:true});R(part,'missing_part','Не хватает детали: '+name+'.');}
        const material=C.accessibleItems(s).find(v=>v.id!==e.id&&v.location==='inventory'&&(P(v).material===p.material||P(v).functions.includes('repair_material')));R(material||missing.length,'missing_repair_material','Нужен ремонтный материал или замена детали.');if(material)C.consume(s,material);for(const name of missing)C.consume(s,C.match(s,name,{inventory:true}));p.missingParts=[];p.durability=p.maxDurability;p.condition='working';e.destroyed=false;e.condition='repaired';C.event(s,'repaired',{itemId:e.id,method:a.method||'material_repair'});for(const n of Object.values(s.world.npcs))for(const g of n.grievances)if(!g.resolved&&g.kind==='damage'&&g.requiredItemId===e.id)g.reparation=true;return ok('Предмет восстановлен с расходом настоящих материалов.','generic_repair_completed',{time:30});
      }
      if(a.op==='power'){R(other&&P(other).energy>0,'missing_energy_source','Нужен заряженный источник энергии.');R(p.functions.includes('device')||p.moving,'not_device','Предмет не является устройством.');p.powerSourceId=other.id;p.powered=true;return ok('Источник подключён; устройство получает энергию.','device_powered');}
      if(a.op==='configure'){R(p.functions.includes('device')||p.moving,'not_device','Это не настраиваемое устройство.');const settings=C.values(a.settings||a.text.split(':').slice(1).join(':'));R(Object.keys(settings).length,'missing_settings','Какие параметры нужно установить? Используйте название и значение.','clarification');p.settings={...(p.settings||{}),...settings};return ok('Параметры устройства изменены.','device_configured');}
      if(a.op==='modify'){
        R(other,'missing_component','Нужна реальная добавляемая деталь.');const added=P(other).functions||[];R(added.length,'component_has_no_function','У детали нет функции для добавления.');p.functions=[...new Set([...p.functions,...added])];p.mass+=P(other).mass;p.parts.push({sourceId:other.id,label:other.label,material:P(other).material,mass:P(other).mass});C.consume(s,other);return ok('Конструкция изменена. Прежние функции сохранены, добавлены функции детали.','item_modified');
      }
      return null;
    }
    return {handle,make,recipe,recipes,dismantle,tool};
  }
  root.RpgCrafting={create};
})(globalThis);
