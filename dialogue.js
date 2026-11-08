/* Contact, conversation and justified initiative are independent from physical presence. */
(function(root){
  'use strict';
  const norm=text=>String(text||'').toLowerCase().replace(/ё/g,'е');
  const reactions=new Set(['witness_event','private_boundary','permission_request','plot_initiative','greeting_requested','reparation','source_shared']);
  function create(H){
    const {emit}=H;
    const here=(s,n)=>Boolean(n&&n.location===s.world.player.location&&!n.hidden&&!['incapacitated','dead'].includes(n.status)&&n.agency?.activity!=='sleeping');
    function init(s){
      const migrating=s.world.dialogueVersion!==1;
      if(migrating){s.world.boundNpcId=s.world.activeNpcId||s.world.primaryNpcId;s.world.activeNpcId=null;s.world.dialogueVersion=1;}
      for(const n of Object.values(s.world.npcs))n.dialogueState||={status:migrating&&s.world.loops.social.contacts.includes(n.id)?'ended':'undiscovered',contactTurn:null,lastTrigger:null,initiatives:[]};
      if(s.world.activeNpcId&&!here(s,s.world.npcs[s.world.activeNpcId]))close(s,'separated');
    }
    function notice(s,n){if(n?.dialogueState.status==='undiscovered'){n.dialogueState.status='noticed';n.dialogueState.noticedTurn=s.turn;}}
    function start(s,n,trigger='player_addressed'){
      if(!here(s,n))return false;notice(s,n);const state=n.dialogueState;
      if(s.world.activeNpcId&&s.world.activeNpcId!==n.id)close(s,'switched');
      if(state.status!=='active'){state.contactTurn??=s.turn;state.startedTurn=s.turn;state.status='active';emit(s,'dialogue_started',n.id,null,{trigger});}
      if(!s.world.loops.social.contacts.includes(n.id))s.world.loops.social.contacts.push(n.id);
      state.lastTrigger=trigger;s.world.activeNpcId=n.id;return true;
    }
    function close(s,reason='ended'){
      const n=s.world.npcs[s.world.activeNpcId];if(n){n.dialogueState.status=['attention_shift','working'].includes(reason)?'suspended':'ended';n.dialogueState.endedTurn=s.turn;n.dialogueState.lastTrigger=reason;emit(s,'dialogue_ended',n.id,null,{reason});}
      s.world.activeNpcId=null;
    }
    function active(s,n){return Boolean(here(s,n)&&s.world.activeNpcId===n.id&&n.dialogueState.status==='active');}
    function addressed(c,a){
      if(a.conversation)return true;
      if(c.negated||c.hypothetical||['negated','hypothetical','report'].includes(c.semantic?.mode))return false;
      if(a.intent==='request_permission')return true;
      if(c.semantic?.recognized&&c.semantic.intent!=='TALK'&&['question','intention','hypothetical','negated','report'].includes(c.semantic.mode))return false;
      if(a.intent==='return_property'&&/незаметно|тайно/.test(norm(c.originalText||c.text)))return false;
      if(a.intent==='goal')return /поговор|познаком|побесед/.test(norm(c.originalText||c.text));
      return ['greet','talk','question','identity','name','remember','thanks','apology','help','bargain','insult','threat','claim','agree','refuse','select_npc','find_job','collect_pay','buy','give','show','deliver_job','request_plan','request_npc','borrow','rent','pay_fine','return_property','compensate','confess','report_event','promise'].includes(a.intent)||c.speech;
    }
    function before(s,c,a){
      if(a.semantic?.unsupportedVerb&&!a.conversation)return;
      if(a.intent==='end_dialogue'){close(s,'ended');return;}
      if(['move','return','approach','work','repair','repair_craft','repair_install','inspect'].includes(a.intent)&&!addressed(c,a)){if(s.world.activeNpcId)close(s,['move','return'].includes(a.intent)?'separated':a.intent==='work'?'working':'attention_shift');return;}
      if(!addressed(c,a))return;
      const id=a.intent==='request_npc'?a.actor:a.recipientId||s.world.boundNpcId;
      if(id!=='player')start(s,s.world.npcs[id],'player_addressed');
    }
    function canSpeak(s,n,trigger){return here(s,n)&&(active(s,n)||reactions.has(trigger));}
    function say(s,n,text,trigger='dialogue',options={}){
      if(!canSpeak(s,n,trigger))return '';
      if(/[ая]$/iu.test(n.name)&&!/^(?:Никита|Илья|Кузьма|Савва|Лука)$/iu.test(n.name)){const endings={видел:'видела',заметил:'заметила',услышал:'услышала',готов:'готова',получил:'получила',запомнил:'запомнила'};text=text.replace(/[А-Яа-яЁё]+/gu,word=>endings[norm(word)]||word);}
      notice(s,n);
      if(reactions.has(trigger)&&!active(s,n)){
        n.dialogueState.initiatives.push({turn:s.turn,trigger});n.dialogueState.initiatives=n.dialogueState.initiatives.slice(-20);s.world.lastInitiatorId=n.id;
      }
      return root.StoryMessages.say(s,{type:'npc',id:n.id,name:n.name},text,trigger,{locationId:n.location,...options});
    }
    return {init,notice,start,close,active,addressed,before,canSpeak,say,here};
  }
  root.StoryDialogue={create};
})(globalThis);
