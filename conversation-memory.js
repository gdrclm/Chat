/* Per-NPC semantic history, separate from contact status and world truth. */
(function(root){
  'use strict';
  function init(n){
    n.conversation||={version:1,activeTopic:null,focusEntityId:n.id,lastClaimId:null,lastClaim:null,lastQuestion:null,pendingFollowUp:null,conversationDepth:0,disclosedFacts:[],discussedTopics:{},unresolvedQuestions:[],history:[],pendingNpcQuestion:null,askedQuestions:{},declinedQuestions:[],relationshipCredits:[],lastInitiativeTurn:-20};
    return n.conversation;
  }
  function remember(n,request,response,turn){
    const m=init(n),id=request.topicId||'unresolved';
    const same=m.activeTopic===id;m.activeTopic=request.topicId||m.activeTopic;m.focusEntityId=n.id;m.lastQuestion=request.raw;
    m.conversationDepth=same?m.conversationDepth+1:1;
    m.pendingFollowUp=request.followUp||null;
    const discussed=m.discussedTopics[id]||={count:0,firstTurn:turn,facts:[],modes:[]};discussed.count++;if(response.mode==='truthful')discussed.truthfulCount=(discussed.truthfulCount||0)+1;discussed.lastTurn=turn;discussed.lastFacet=request.facet||request.followUp||null;
    for(const fact of response.facts||[]){
      if(!discussed.facts.includes(fact.id))discussed.facts.push(fact.id);
      if(response.mode==='truthful'&&!m.disclosedFacts.includes(fact.id))m.disclosedFacts.push(fact.id);
    }
    if(!discussed.modes.includes(response.mode))discussed.modes.push(response.mode);
    m.lastClaim=response.claim||null;m.lastClaimId=response.claim?.id||null;
    if(response.mode==='unknown'){
      if(!m.unresolvedQuestions.some(q=>q.topicId===id&&q.facet===(request.followUp||request.facet||null)))m.unresolvedQuestions.push({topicId:id,facet:request.followUp||request.facet||null,text:request.raw,turn});
      m.unresolvedQuestions=m.unresolvedQuestions.slice(-20);
    }else if(response.mode==='truthful')m.unresolvedQuestions=m.unresolvedQuestions.filter(q=>q.topicId!==id);
    m.history.push({turn,kind:'question',topicId:id,facet:request.followUp||request.facet||null,question:request.raw,responseMode:response.mode,factIds:(response.facts||[]).map(f=>f.id),claim:response.claim?.text||null});m.history=m.history.slice(-80);
  }
  function ask(n,type,text,turn){const m=init(n);m.pendingNpcQuestion={id:n.id+':'+turn+':'+type,type,text,askedTurn:turn};m.askedQuestions[type]=(m.askedQuestions[type]||0)+1;m.lastInitiativeTurn=turn;return text;}
  function answer(n,type,text,turn,declined=false){const m=init(n);if(declined&&!m.declinedQuestions.includes(type))m.declinedQuestions.push(type);m.history.push({turn,kind:declined?'declined':'player_answer',topicId:type,text});m.history=m.history.slice(-80);m.pendingNpcQuestion=null;}
  root.ConversationMemory={init,remember,ask,answer};
})(globalThis);
