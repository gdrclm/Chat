/* Stable traits shape disclosure and wording; relationship scores remain in social.js. */
(function(root){
  'use strict';
  const axes=['sociability','warmth','assertiveness','openness','curiosity','patience','impulsivity','directness','irony','caution'];
  const aliases={общительность:'sociability',теплота:'warmth',доминантность:'assertiveness',откровенность:'openness',любопытство:'curiosity',терпение:'patience',импульсивность:'impulsivity',прямолинейность:'directness',ироничность:'irony',осторожность:'caution'};
  const presets={merchant:{assertiveness:.65,caution:.65},memory_merchant:{openness:.3,curiosity:.7,caution:.75},craftsman:{directness:.85,patience:.7},guard:{assertiveness:.85,caution:.8,directness:.8},scholar:{curiosity:.85,patience:.8,caution:.7},aristocrat:{assertiveness:.8,openness:.25},rogue:{irony:.7,caution:.85,openness:.25},healer:{warmth:.8,patience:.85},traveler:{sociability:.75,openness:.7},hermit:{sociability:.15,openness:.2,warmth:.3},artist:{sociability:.8,impulsivity:.7},official:{directness:.75,caution:.75},inventor:{curiosity:.85,patience:.6},courier:{sociability:.65,caution:.55},resident:{}};
  const norm=value=>String(value||'').toLowerCase().replace(/ё/g,'е');
  const hash=text=>[...text].reduce((n,char)=>(n*31+char.charCodeAt(0))>>>0,19);
  function create(n,role,overrides={}){
    const p=Object.fromEntries(axes.map((axis,index)=>[axis,.38+(hash(n.id+':'+axis+':'+index)%19)/100]));Object.assign(p,presets[role]||{});
    const text=norm(n.description);
    for(const [pattern,values]of [[/добр|дружелюб|забот|ласков/,{warmth:.85}],[/мягк|терпелив/,{patience:.85}],[/сдержан/,{sociability:.3,openness:.25}],[/молчалив|немногослов/,{sociability:.15,openness:.2}],[/холод|суров/,{warmth:.2}],[/ирон|сарказм|язв|юмор/,{irony:.8}],[/любопыт/,{curiosity:.85}],[/откровен|общител|словоохот/,{sociability:.85,openness:.8}],[/горд|властн/,{assertiveness:.9}],[/робк|трус|пуглив/,{assertiveness:.2,caution:.85}],[/вспыльчив|импульсив/,{impulsivity:.85,patience:.2}],[/прямолин/,{directness:.9}],[/подозрител|наблюдател|осторожн/,{caution:.85}]])if(pattern.test(text))Object.assign(p,values);
    for(const [key,value]of Object.entries(overrides)){const axis=aliases[norm(key)]||key;if(axes.includes(axis)&&Number.isFinite(Number(value)))p[axis]=Math.max(0,Math.min(1,Number(value)));}
    return {...p,version:1};
  }
  function frame(n){
    const r=n.social.relationship,p=n.personality;
    if(r.fear>=3&&r.hostility<4)return 'afraid';
    if(r.hostility>=3)return 'hostile';
    if(n.grievances.some(g=>!g.resolved))return 'conflict';
    if(r.suspicion>=2)return 'suspicious';
    if(n.social.cautious)return 'reconciled';
    if(n.trust>=3)return 'trusted';
    if(r.respect>=3&&n.trust<1)return 'respected';
    if(r.affection>=2||p.warmth>.7&&n.trust>0)return 'friendly';
    return 'neutral';
  }
  function compose({npc:n,parts,topic,repeat=0,mode='truthful',relationship=frame(n)}){
    const p=n.personality;let text=parts.filter(Boolean).join(' ');
    if(mode==='truthful'&&repeat>0){
      const reference=topic==='name'?(repeat>2&&p.irony>.6?'Имя никуда не делось. ':'Мы уже представлялись. '):repeat>2&&p.patience<.4?'Я отвечал на этот вопрос. ':'Как уже говорилось: ';
      text=reference+(text||'Ответ прежний.');
    }
    if(relationship==='afraid'&&!/не трогайте|не приближайтесь/.test(text))text+=' Пожалуйста, не трогайте мои вещи.';
    else if(relationship==='respected'&&topic==='trust')text+=' Ваше умение я уважаю, но личное доверие — отдельный вопрос.';
    if(/[ая]$/iu.test(n.name)&&!/^(?:Никита|Илья|Кузьма|Савва|Лука)$/iu.test(n.name)){const forms={выбрал:'выбрала',отвечал:'отвечала',мог:'могла',готов:'готова',знал:'знала',говорил:'говорила',наблюдал:'наблюдала',запомнил:'запомнила',увидел:'увидела',начал:'начала',спокоен:'спокойна',занят:'занята',расположен:'расположена',уверен:'уверена'};text=text.replace(/[А-Яа-яЁё]+/gu,word=>forms[norm(word)]||word);}
    return {text,manner:relationship==='afraid'?'Голос заметно тише.':p.warmth>.75&&relationship==='friendly'?'В голосе слышно участие.':p.directness>.8&&repeat===0?'Ответ короткий и деловой.':''};
  }
  root.NpcPersonality={axes,presets,aliases,create,frame,compose};
})(globalThis);
