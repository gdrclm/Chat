/* Coarse spatial geometry and material interactions, shared by all physical objects. */
(function(root){'use strict';
  function create(C){
    const {require:R,result:ok,props:P,qty:Q}=C;
    const target=(s,a)=>{const e=C.target(s,a);R(e,'missing_target','Назовите существующий доступный предмет.','clarification');return e;};
    const second=(s,a,e)=>a.secondaryId?C.item(s,a.secondaryId):C.match(s,a.secondary||a.text,{filter:v=>v.id!==e.id});
    const body=s=>s.world.player.body;
    function distance(a,b){return Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0),(a.z||0)-(b.z||0));}
    function visible(s,n,a={}){
      if(n.location!==s.world.player.location||n.hidden||['dead','incapacitated'].includes(n.status)||n.social.attention==='asleep')return false;
      const env=C.place(s).environment,me=body(s),light=illumination(s),cover=me.coverId&&C.item(s,me.coverId);
      if(light<.15&&!n.agency.darkvision)return false;
      if(cover&&C.available(s,cover)&&P(cover).opacity!==0&&P(cover).height>=(me.posture==='crouching'?.8:me.posture==='prone'?.3:me.height)){
        const observer=n.agency.position||{x:0,y:0,z:0},at=me.position||{x:0,y:0,z:0},p=P(cover).position;
        if(Math.min(observer.x,at.x)<=p.x&&p.x<=Math.max(observer.x,at.x))return false;
      }
      return !(/незаметно|тайно|скрытно/.test(C.norm(a.text))&&n.social.attention==='busy');
    }
    function illumination(s){const loc=C.place(s),lights=s.entities.filter(e=>!e.destroyed&&e.physical?.lit&&[s.place,'inventory'].includes(e.location));return Math.max(loc.environment.light,...lights.map(e=>P(e).brightness||.8));}
    function moveSupport(s,e){const me=body(s);me.position={...P(e).position,z:P(e).position.z+P(e).height};me.elevation=me.position.z;me.supportId=e.id;s.focus=e.id;}
    function impact(s,e,height,seen=new Set()){
      if(!e||seen.has(e.id))return;seen.add(e.id);const p=P(e),fragile=p.fragile||p.material==='glass';if(fragile){const damage=Math.max(0,height-1)*20;p.durability=Math.max(0,p.durability-damage);if(!p.durability)e.destroyed=true;C.event(s,'impact_damage',{itemId:e.id,damage});}
      const protection=p.functions.includes('protect_fragile')?p.protection||2:0;for(const child of s.entities.filter(v=>v.containerId===e.id&&!v.destroyed))impact(s,child,Math.max(0,height-protection),seen);
    }
    function handle(s,a){
      const me=body(s),where=C.place(s),env=where.environment;me.position||={x:0,y:0,z:0};
      if(a.op==='stand'){me.posture='standing';delete me.seatId;delete me.coverId;s.facts.hidden=false;return ok('Вы встаёте.','stood');}
      if(['sit','lie','crouch','crawl','squeeze','climb','jump_down','jump_gap','climb_rope','swim','dive','feel_move','breach','hold_door','wedge_door','barricade','stack_access','make_cover','exit_window','open_window'].includes(a.op)){
        let e=['swim','dive','feel_move','jump_down'].includes(a.op)?C.target(s,a):target(s,a),p=P(e);
        if(a.op==='sit'||a.op==='lie'){
          R(a.op==='sit'?/стул|скам|кресл|табурет|кровать/.test(C.norm(e.label))||p.functions.includes('seat'):/кровать|ложе|матрас/.test(C.norm(e.label))||p.functions.includes('bed'),'unsuitable_support','Эта вещь не подходит для такого положения.');
          R(p.durability>0&&p.mass*10>=me.mass,'support_weak','Опора не выдержит ваш вес.');me.posture=a.op==='sit'?'sitting':'lying';me.seatId=e.id;me.position={...p.position,z:p.position.z+p.height};me.elevation=me.position.z;s.focus=e.id;return ok('Вы '+(a.op==='sit'?'садитесь на ':'ложитесь на ')+'«'+e.label+'». Положение сохраняется.','posture_changed');
        }
        if(a.op==='crouch'){R(p.height>=.8,'cover_too_low','За этой вещью нельзя полностью укрыться.');me.posture='crouching';me.coverId=e.id;me.position={...p.position,x:p.position.x+p.width/2+.3};s.facts.hidden=!Object.values(s.world.npcs).some(n=>visible(s,n,a));return ok('Вы приседаете за «'+e.label+'». Обзор свидетелей зависит от положения и света.','cover_taken');}
        if(a.op==='crawl'||a.op==='squeeze'){
          const portal=p.portal;R(portal,'not_a_passage','У предмета нет заданного физического прохода.');const width=portal.width??p.width,height=portal.height??p.height;R(width>=me.width&&(a.op==='crawl'?height>=.35:height>=me.height*.8),'body_does_not_fit','Размеры тела не позволяют пройти.');
          me.posture=a.op==='crawl'?'prone':'sideways';C.edge(s,portal.from,portal.to,{barrierId:e.id,rpg:{mode:a.op,width,height}});R(!e.locked&&!p.blocked,'passage_blocked','Проход физически перекрыт.');const destination=s.world.locations.find(l=>l.id===(portal.from===where.id?portal.to:portal.from));const r=C.H.moveActor(s,'player',destination);R(r.status==='success',r.code,r.text);return ok(r.text,'narrow_passage_crossed');
        }
        if(a.op==='climb'||a.op==='climb_rope'){
          R(!s.world.player.overloaded,'overloaded','С таким грузом вы не сможете взобраться.');R(!s.world.player.equipment.left||!s.world.player.equipment.right,'hands_occupied','Для подъёма нужна хотя бы одна свободная рука.');
          if(a.op==='climb_rope')R(/верев|лестниц/.test(C.norm(e.label))||p.functions.includes('climb'),'not_climbable','Это не закреплённая верёвка или лестница.');
          R(p.height<=me.height+1+C.skill(s,'climbing')||p.functions.includes('climb')||p.supportedBy,'too_high','Высота требует лестницы, верёвки или дополнительной опоры.');
          R(p.mass*10>=me.mass||p.anchored||p.functions.includes('climb'),'support_weak','Опора неустойчива.');moveSupport(s,e);me.posture='standing';me.stamina=Math.max(0,me.stamina-5);return ok('Вы забираетесь на «'+e.label+'». Высота: '+me.elevation+' м.','elevation_changed');
        }
        if(a.op==='jump_down'){
          const height=me.elevation;R(height>0,'already_on_ground','Вы уже на земле.');const damage=Math.max(0,Math.floor(height-1.5));me.health=Math.max(0,me.health-damage);if(damage)me.injuries.legs=(me.injuries.legs||0)+damage;
          me.elevation=0;me.position.z=0;delete me.supportId;me.posture=damage?'prone':'standing';
          for(const id of ['left','right']){const held=C.item(s,s.world.player.equipment[id]);if(held&&!s.world.player.equipment.secured.includes(held.id)&&height>2){C.transfer(s,held,s.place);impact(s,held,height);s.world.player.equipment[id]=null;}}
          return ok('Вы спрыгиваете с высоты '+height+' м. '+(damage?'Приземление травмирует ноги.':'Приземление прошло без травмы.'),'landed',{status:damage?'partial_success':'success',completed:true});
        }
        if(a.op==='jump_gap'){
          const length=p.gap??p.width,range=1.5+C.skill(s,'athletics')*.5-(me.injuries.legs||0)*.2;R(length>0,'missing_distance','Ширина препятствия неизвестна.');R(!s.world.player.overloaded,'overloaded','Груз мешает прыжку.');
          if(length>range||p.gap===undefined&&p.height>.6+C.skill(s,'athletics')*.2){me.health=Math.max(0,me.health-2);me.injuries.legs=(me.injuries.legs||0)+1;me.posture='prone';return ok('Вы не преодолеваете расстояние и падаете, повредив ноги.','jump_failed',{status:'partial_success',completed:false});}
          me.position.x=p.position.x+length+.5;me.stamina-=5;return ok('Вы перепрыгиваете препятствие шириной '+length+' м.','gap_crossed');
        }
        if(a.op==='swim'||a.op==='dive'){
          const depth=p.depth??env.depth,current=p.current??env.current;R(depth>0,'no_water','В этом месте нет воды нужной глубины.');R(me.stamina>10&&!s.world.player.overloaded,'cannot_swim','Для плавания не хватает сил или слишком тяжёлый груз.');R(current<=2+C.skill(s,'swimming'),'current_too_strong','Течение слишком сильное.');me.posture=a.op==='dive'?'diving':'swimming';me.depth=a.op==='dive'?Math.min(depth,3+C.skill(s,'swimming')):0;me.stamina-=10;if(a.op==='dive')me.breath-=20;me.wetness=1;return ok('Вы '+(a.op==='dive'?'ныряете на '+me.depth+' м':'плывёте')+'. Течение и запас сил учтены.','water_position_changed');
        }
        if(a.op==='feel_move'){R(illumination(s)<.4,'already_lit','Освещения достаточно для обычного движения.');me.position.x+=.5;me.posture='cautious';me.stamina-=1;return ok('Вы осторожно продвигаетесь на ощупь, не получая зрительных сведений о скрытом.','tactile_movement');}
        if(a.op==='open_window'){R(/окн/.test(C.norm(e.label))||p.functions.includes('window'),'not_window','Это не окно.');R(!e.locked,'window_locked','Окно заперто.');e.opened=true;return ok('Вы открываете окно.','window_opened');}
        if(a.op==='exit_window'){
          const window=/окн/.test(C.norm(e.label))?e:s.entities.find(v=>C.available(s,v)&&/окн/.test(C.norm(v.label))&&v.opened);R(window,'missing_window','Нужно доступное открытое окно.');const w=P(window);R(window.opened||window.destroyed,'window_closed','Сначала откройте окно.');R(me.elevation>=(w.sill||1),'window_too_high','Нужно подняться до подоконника.');const portal=w.portal||{from:where.id,to:s.world.outdoorId};R(portal.to&&portal.to!==where.id,'no_window_exit','Для этого окна не задан выход.');C.edge(s,portal.from,portal.to,{barrierId:window.id,rpg:{mode:'window',width:w.width}});const r=C.H.moveActor(s,'player',s.world.locations.find(l=>l.id===(where.id===portal.from?portal.to:portal.from)));R(r.status==='success',r.code,r.text);me.elevation=0;me.position.z=0;return ok(r.text,'window_exit');
        }
        if(a.op==='breach'){const tool=second(s,a,e);R(tool&&C.available(s,tool)&&P(tool).mass+me.strength>=p.durability/10,'insufficient_force','Нужен подходящий инструмент и достаточное усилие.');R(p.portal,'no_passage_behind','Не установлено, куда ведёт пролом.');p.durability=0;e.destroyed=true;C.edge(s,p.portal.from,p.portal.to,{rpg:{source:e.id,breach:true}});return ok('В «'+e.label+'» сделан реальный проход.','passage_breached');}
        if(a.op==='hold_door'){R(e.opened,'door_closed','Сначала откройте дверь.');p.heldBy='player';s.world.player.equipment.right=e.id;return ok('Вы удерживаете дверь открытой.','door_held');}
        if(a.op==='wedge_door'||a.op==='barricade'){
          const brace=second(s,a,e);R(brace&&C.available(s,brace),'missing_brace','Нужен существующий предмет для упора.');R(!P(brace).anchored,'brace_fixed','Опорный предмет закреплён.');
          if(a.op==='wedge_door'){R(e.opened,'door_closed','Подпорка ставится в открытый проём.');p.wedgedBy=brace.id;P(brace).supports=e.id;}else{p.blocked=true;p.blockedBy=brace.id;}
          C.transfer(s,brace,s.place);return ok('«'+brace.label+'» '+(a.op==='wedge_door'?'удерживает дверь открытой.':'перекрывает проход.'),a.op==='wedge_door'?'door_wedged':'passage_barricaded');
        }
        if(a.op==='stack_access'){
          const parts=C.match(s,a.text,{all:true}).filter(v=>v.id!==e.id&&!P(v).anchored);R(parts.length>=1,'missing_supports','Нужно несколько существующих опор.');let height=0;for(const part of [e,...parts]){height+=P(part).height;P(part).supportedBy=height===P(part).height?null:[e,...parts][Math.max(0,[e,...parts].indexOf(part)-1)].id;}P(e).accessHeight=height;return ok('Опоры переставлены. Доступная высота: '+height+' м.','access_constructed');
        }
        if(a.op==='make_cover'){const parts=C.match(s,a.text,{all:true}).filter(v=>!P(v).anchored);R(parts.length>=2,'missing_materials','Нужны хотя бы два подходящих предмета.');const cover=C.add(s,'импровизированное укрытие',{location:s.place,kind:'fixed',portable:false,lineage:parts.map(v=>v.id)});Object.assign(P(cover),{height:Math.max(...parts.map(v=>P(v).height)),mass:parts.reduce((sum,v)=>sum+P(v).mass,0),opacity:1});for(const part of parts){part.supportId=cover.id;P(part).assembledInto=cover.id;}return ok('Вы собираете укрытие из имеющихся вещей. Оно занимает место и перекрывает обзор.','cover_built');}
      }
      const e=target(s,a),p=P(e),other=second(s,a,e),o=P(other);
      if(['push','pull','lift_edge'].includes(a.op)){
        R(!p.tiedTo,'object_tied','Предмет привязан. Сначала развяжите или перережьте узел.');
        R(!p.anchored,'object_fixed','Предмет закреплён.');const force=p.mass*(a.op==='lift_edge'?.5:p.friction),lever=other&&o.functions.includes('lever')&&C.available(s,other)?Math.max(1,o.length||2):1;R(force<=me.strength*lever,'too_heavy','Сил недостаточно для этого воздействия.');if(lever>1){o.wear++;o.durability=Math.max(0,o.durability-1);}
        if(a.op==='lift_edge')p.tilt=.3;else{const at=other&&!/с помощью|используя|при помощи/.test(C.norm(a.text))?o.position:null;p.position={...p.position,x:at?at.x-(a.op==='push'?.5:1):p.position.x+(a.op==='push'?1:-1)};}
        me.stamina=Math.max(0,me.stamina-2);s.focus=e.id;return ok('Вы '+({push:'толкаете',pull:'тянете',lift_edge:'приподнимаете край'}[a.op])+' «'+e.label+'».','object_displaced');
      }
      if(a.op==='topple'){R(!p.anchored&&p.mass*.5<=me.strength,'cannot_topple','Предмет закреплён или слишком тяжёл.');p.orientation='sideways';for(const child of s.entities.filter(v=>v.containerId===e.id||v.supportId===e.id)){delete child.containerId;delete child.supportId;child.location=s.place;child.hidden=false;child.known=true;P(child).position={...p.position};}return ok('Предмет опрокинут; незакреплённое содержимое выпало.','object_toppled');}
      if(a.op==='throw'){
        R(!p.tiedTo&&!p.anchored,'object_secured','Предмет сначала нужно освободить от крепления.');
        R(e.location==='inventory','not_carried','Бросить можно предмет при себе.');R(p.mass<=me.strength,'too_heavy','Предмет слишком тяжёл для броска.');R(other||a.npcId,'missing_throw_target','В кого или во что вы бросаете?','clarification');
        const n=s.world.npcs[a.npcId],to=n?n.agency.position||{}:o.position,range=distance(me.position,to),hit=range<=5+C.skill(s,'throwing')*2;
        C.transfer(s,e,s.place);p.position={...(to||me.position)};p.lastImpact={targetId:n?.id||other.id,hit,time:s.world.rpg.clock.minute};if(hit&&other)o.durability=Math.max(0,o.durability-p.mass*5);if(hit&&n){n.health=Math.max(0,n.health-1);C.H.social.record(s,'assault',{id:s.currentActionId,actor:'player',text:a.text},{targetId:n.id,ownerId:n.id,directId:n.id});}
        C.event(s,'sound',{locationId:where.id,sourceId:e.id,position:p.position,intensity:p.mass});return ok(hit?'Брошенный предмет попал в цель.':'Предмет не попал в цель и остался рядом с ней.','item_thrown',{status:hit?'success':'partial_success',completed:hit});
      }
      if(a.op==='roll'){R(p.shape==='cylinder'||p.functions.includes('roll'),'not_round','Форма не позволяет катить предмет.');R(!p.anchored,'object_fixed','Предмет закреплён.');p.position.x+=1+Math.abs(env.slope);p.velocity=Math.abs(env.slope);return ok('Предмет катится; уклон влияет на скорость.','object_rolled');}
      if(a.op==='stack'||a.op==='brace'){R(other&&other.id!==e.id,'missing_support','Нужна вторая существующая вещь.');R(o.mass*10>=p.mass&&o.width>=p.width*.5,'unstable_stack','Конструкция неустойчива.');e.supportId=other.id;p.position={...o.position,z:o.position.z+o.height};p.supportedBy=other.id;if(a.op==='brace'){o.bracedBy=e.id;p.supports=other.id;}return ok('«'+e.label+'» установлен на «'+other.label+'».','support_linked');}
      if(a.op==='tie'){const rope=C.accessibleItems(s).find(v=>/верев|шнур|канат/.test(C.norm(v.label))&&v.id!==e.id);R(rope&&other,'missing_tie_material','Нужны верёвка и опора.');R(o.anchored||o.mass>=p.mass,'anchor_unstable','Опора не удержит предмет.');const link={id:C.id(s,'knot'),a:e.id,b:other.id,ropeId:rope.id,tension:p.mass,tied:true};s.world.rpg.links.push(link);p.tiedTo=other.id;p.knotId=link.id;return ok('Предмет привязан к опоре настоящей верёвкой.','knot_tied');}
      if(['untie','loosen','cut_knot'].includes(a.op)){const link=s.world.rpg.links.find(v=>v.tied&&(v.a===e.id||v.ropeId===e.id));R(link,'no_knot','У этой вещи нет действующего узла.');if(a.op==='cut_knot'){const knife=C.accessibleItems(s).find(v=>P(v).functions.includes('cut')||/нож|меч/.test(C.norm(v.label)));R(knife,'missing_blade','Нужен режущий инструмент.');C.consume(s,C.item(s,link.ropeId));}if(a.op==='loosen')link.tension*=.5;else{link.tied=false;delete P(C.item(s,link.a)).tiedTo;}return ok('Узел '+(a.op==='loosen'?'ослаблен.':'разъединён.'),'knot_changed');}
      if(a.op==='fasten'){const fastener=other&&(/гвозд|болт|зажим/.test(C.norm(other.label))||o.functions.includes('fasten'))?other:C.accessibleItems(s).find(v=>/гвозд|болт|зажим/.test(C.norm(v.label)));R(fastener,'missing_fastener','Нужен крепёж.');R(C.accessibleItems(s).some(v=>/молот|отвертк|ключ/.test(C.norm(v.label))||P(v).functions.includes('fasten')),'missing_tool','Нужен инструмент для крепления.');p.fastenerId=fastener.id;p.anchored=true;C.transfer(s,fastener,s.place);return ok('Крепёж установлен; предмет закреплён.','fastened');}
      if(a.op==='unfasten'){R(p.fastenerId,'no_fastener','Крепёж не обнаружен.');R(C.accessibleItems(s).some(v=>P(v).functions.includes('unfasten')||/отвертк|гаечн/.test(C.norm(v.label))),'missing_tool','Нужен подходящий инструмент.');p.anchored=false;C.transfer(s,C.item(s,p.fastenerId),'inventory');delete p.fastenerId;return ok('Крепёж снят и находится при вас.','unfastened');}
      if(a.op==='damage'){const damage=C.amount(a.text,20);p.durability=Math.max(0,p.durability-damage);p.condition=p.durability? 'damaged':'broken';if(!p.durability)e.destroyed=true;C.event(s,'physical_damage',{itemId:e.id,amount:damage});if(e.ownerId&&e.ownerId!=='player')C.H.social.record(s,'damage',{id:s.currentActionId,actor:'player',text:a.text},{targetId:e.id,ownerId:e.ownerId});return ok('Прочность «'+e.label+'»: '+p.durability+'/'+p.maxDurability+'.','partially_damaged');}
      if(a.op==='assess')return ok('Материал: '+C.materialLabel(p.material)+'. Прочность '+p.durability+'/'+p.maxDurability+'. Износ '+p.wear+'. '+(p.durability>0?'Предмет ещё пригоден к работе.':'Без ремонта он не работает.'),'condition_assessed',{information:{novel:true,discoveries:[e.id+':condition'],opportunities:[]}});
      if(a.op==='heat'){R(C.accessibleItems(s).some(v=>P(v).burning||P(v).temperature>=100||P(v).functions.includes('furnace')),'no_heat_source','Нужен реальный источник тепла.');p.temperature+=C.amount(a.text,80);if(p.material==='wax'&&p.temperature>=60)p.phase='liquid';if(p.material==='metal'&&p.temperature>=700)p.malleable=true;return ok('Температура предмета: '+p.temperature+' °C.','heated');}
      if(a.op==='cool'){R(p.temperature>20,'not_hot','Предмет не раскалён.');R(other&&o.liquid?.amount>0||env.temperature<p.temperature,'no_cooling','Нет доступного способа охлаждения.');p.temperature=Math.max(env.temperature,p.temperature-80);p.malleable=false;return ok('Предмет охлаждён до '+p.temperature+' °C.','cooled');}
      if(a.op==='freeze'){R(p.liquid?.amount>0,'no_liquid','В сосуде нет жидкости.');R(env.temperature<=0||other&&o.temperature<=0,'no_cold_source','Для замерзания нужен реальный холод.');p.temperature=-1;p.liquid.phase='solid';return ok('Жидкость замёрзла; её нельзя перелить до оттаивания.','frozen');}
      if(a.op==='pour'||a.op==='transfer_liquid'){
        const liquid=p.liquid;R(liquid&&liquid.amount>0&&liquid.phase!=='solid','no_liquid','В сосуде нет доступной жидкости.');R(other,'missing_destination','Куда перелить или вылить жидкость?','clarification');const amount=C.amount(a.text,liquid.amount);R(amount<=liquid.amount,'insufficient_liquid','Столько жидкости нет.');
        if(a.op==='transfer_liquid'){R(o.capacity>0,'not_container','Вторая вещь не является сосудом.');R((o.liquid?.amount||0)+amount<=o.capacity,'container_full','Вместимости сосуда недостаточно.');R(!o.liquid||o.liquid.kind===liquid.kind,'incompatible_liquids','Смешивание этих жидкостей не задано.');o.liquid={kind:liquid.kind,amount:(o.liquid?.amount||0)+amount,phase:'liquid'};}else{o.wetness=Math.min(1,o.wetness+amount*.2);o.surfaceLiquid={kind:liquid.kind,amount};}
        liquid.amount-=amount;return ok('Перемещено жидкости: '+amount+'. В исходном сосуде осталось '+liquid.amount+'.','liquid_transferred');
      }
      if(a.op==='wet'){R(other&&o.liquid?.amount>0||env.depth>0,'no_water','Нет доступной жидкости.');p.wetness=1;if(p.material==='paper')p.durability=Math.max(0,p.durability-10);if(p.functions.includes('electronic'))p.condition='shorted';return ok('Предмет намок; его материал определяет последствия.','wetted');}
      if(a.op==='dry'){R(p.wetness>0,'not_wet','Предмет сухой.');p.wetness=0;return ok('Предмет высушен. Повреждения от воды не отменены.','dried',{time:60});}
      if(a.op==='ignite'){R(p.flammability>0&&p.wetness<.5,'not_flammable','Материал не воспламеняется в этих условиях.');R(C.accessibleItems(s).some(v=>P(v).burning||P(v).lit&&P(v).temperature>=150||P(v).functions.includes('ignite')&&!P(v).functions.includes('light')||/спичк|зажигал/.test(C.norm(v.label))),'no_ignition','Нужен источник огня.');p.lit=true;p.burning=true;p.temperature=Math.max(150,p.temperature);return ok('«'+e.label+'» горит. Огонь может распространиться на близкие сухие горючие вещи.','ignited');}
      if(a.op==='extinguish'){R(p.lit,'not_burning','Предмет не горит.');R(other&&(o.liquid?.amount>0||o.material==='sand'||o.functions.includes('extinguish')),'missing_extinguisher','Нужно доступное средство тушения.');if(o.liquid?.amount>0){o.liquid.amount=Math.max(0,o.liquid.amount-1);p.wetness=.8;}p.lit=false;p.burning=false;p.temperature=Math.min(50,p.temperature);return ok('Очаг потушен. Уже нанесённый ущерб сохраняется.','extinguished');}
      return null;
    }
    function tick(s,elapsed){
      for(const e of s.entities.filter(e=>!e.destroyed&&e.physical?.lit&&(e.physical.burning||e.physical.temperature>=100&&e.physical.flammability>0))){const p=P(e);p.durability=Math.max(0,p.durability-elapsed*.2);if(!p.durability){e.destroyed=true;p.lit=false;p.burning=false;C.event(s,'burned_down',{itemId:e.id});continue;}
        for(const other of s.entities.filter(v=>v.id!==e.id&&!v.destroyed&&v.location===e.location&&P(v).flammability>.4&&P(v).wetness<.5))if(distance(p.position,P(other).position)<1&&elapsed>=10){P(other).lit=true;P(other).burning=true;P(other).temperature=150;C.event(s,'fire_spread',{from:e.id,to:other.id});}
      }
    }
    return {handle,tick,visible,illumination,distance};
  }
  root.RpgPhysics={create};
})(globalThis);
