/* Explicit speaker records; legacy action builders interpolate opaque, per-step references. */
(function(root){
  'use strict';
  let sequence=0;
  const narrator={type:'narrator'};
  function begin(s){s.currentMessages=[];s.messageNonce=++sequence+':'+Math.random().toString(36).slice(2);}
  function say(s,speaker,text,trigger,options={}){
    if(!s.currentMessages)begin(s);
    const token='\uE000'+s.messageNonce+':'+s.currentMessages.length+'\uE001';
    s.currentMessages.push({token,speaker:{...speaker},trigger,text:String(text),effects:[],...options});return token;
  }
  function finish(s,result){
    const records=s.currentMessages||[],used=new Set(),blocks=[];
    const expand=(text,metadata={})=>{
      const source=String(text||'');let at=0;
      const matches=records.map(row=>({row,index:source.indexOf(row.token)})).filter(v=>v.index>=0).sort((a,b)=>a.index-b.index);
      for(const {row,index}of matches){
        if(index<at)continue;
        const before=source.slice(at,index).trim();if(before)blocks.push({...metadata,speaker:narrator,trigger:metadata.trigger||'action_result',text:before,effects:[]});
        if(row.manner)blocks.push({kind:'manner',speaker:narrator,trigger:row.trigger,text:row.manner,effects:[]});
        const {token,manner,...message}=row;blocks.push({kind:'speech',...metadata,...message});used.add(token);at=index+token.length;
      }
      const rest=source.slice(at).trim();if(rest)blocks.push({...metadata,speaker:metadata.speaker||narrator,trigger:metadata.trigger||'action_result',text:rest,effects:metadata.effects||[]});
    };
    for(const block of result.narration||[{kind:'action',text:result.text}]){const {text,...metadata}=block;expand(text,metadata);}
    for(const row of records)if(!used.has(row.token))expand(row.token);
    for(const block of blocks)if(!block.effects?.length)block.effects=(result.effects||[]).map(effect=>effect.id);
    result.narration=blocks;result.text=plain(blocks);delete s.currentMessages;delete s.messageNonce;return result;
  }
  function plain(messages){return messages.map(row=>row.speaker?.type==='npc'?(row.speaker.name||'Персонаж')+':\n«'+row.text+'»':row.speaker?.type==='developer'?'Разработчик:\n'+row.text:row.text).join('\n\n');}
  root.StoryMessages={begin,say,finish,plain};
})(globalThis);
