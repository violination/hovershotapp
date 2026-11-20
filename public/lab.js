const $=id=>document.getElementById(id);
let socket=null,playerId=null,room=null,authenticated=false,pingTimer=null;
const errors={INVALID_JSON:'Mensagem inválida',INVALID_MESSAGE:'Mensagem incorreta',ALREADY_IN_ROOM:'Saia da sala atual antes de criar outra',ROOM_LIMIT:'Limite de salas no laboratório',ROOM_NOT_FOUND:'Sala não encontrada',ROOM_FULL:'Esta sala já tem dois jogadores',INVALID_CODE:'Código de sala inválido',NEED_TWO_PLAYERS:'São necessários dois jogadores',NOT_YOUR_TURN:'Aguarde seu turno',INVALID_SHOT:'Ângulo ou força inválidos',UNKNOWN_ACTION:'Ação desconhecida'};
function log(text){
 const li=document.createElement('li');li.textContent=new Date().toLocaleTimeString('pt-BR')+' · '+text;
 $('events').prepend(li);
 while($('events').children.length>50)$('events').lastElementChild.remove();
}
function update(){
 const online=Boolean(socket&&socket.readyState===WebSocket.OPEN&&authenticated);
 $('connection-status').textContent=online?'Conectado':'Desconectado';
 $('connection-status').classList.toggle('connected',online);
 $('connect').disabled=online||Boolean(socket&&socket.readyState===WebSocket.CONNECTING);
 $('create-room').disabled=!online||Boolean(room);
 $('join-room').disabled=!online||Boolean(room);
 $('leave-room').disabled=!online||!room;
 $('room-info').hidden=!room;
 $('fire').disabled=!online||!room||room.players.length!==2||room.turn!==playerId;
 if(!room){$('turn-message').textContent='Conecte duas pessoas na mesma sala para testar os turnos.';return;}
 if(room.players.length!==2){$('turn-message').textContent='Aguardando segundo jogador…';return;}
 $('turn-message').textContent=room.turn===playerId?'Sua vez de enviar comando de teste.':'Aguardando o comando do outro jogador.';
}
function send(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
function renderRoom(){
 if(!room){$('active-room').textContent='';$('players').replaceChildren();update();return;}
 $('active-room').textContent=room.code;
 $('players').replaceChildren();
 for(const player of room.players){
  const li=document.createElement('li');
  li.textContent=player.name+(player.id===playerId?' (você)':'')+(player.id===room.turn?' · turno':'');
  $('players').append(li);
 }
 update();
}
$('connect-form').addEventListener('submit',event=>{
 event.preventDefault();
 if(socket?.readyState===WebSocket.OPEN)return;
 const token=$('access-token').value;
 const name=$('nickname').value.trim();
 if(token.length<20||!name){log('Informe sua chave e seu nome.');return;}
 authenticated=false;playerId=null;room=null;renderRoom();
 const protocol=location.protocol==='https:'?'wss:':'ws:';
 const ws=new WebSocket(protocol+'//'+location.host+'/ws');
 socket=ws;update();
 log('Conectando ao servidor…');
 ws.addEventListener('open',()=>{send({type:'auth',token,name});$('access-token').value='';});
 ws.addEventListener('message',event=>{
  let message;try{message=JSON.parse(event.data);}catch{log('Resposta inválida do servidor');return;}
  if(message.type==='authenticated'){
   authenticated=true;playerId=message.id;
   log('Autenticado. Agora você pode criar ou entrar em uma sala.');
   pingTimer=setInterval(()=>send({type:'ping',clientSentAt:Date.now()}),15000);
   send({type:'ping',clientSentAt:Date.now()});update();return;
  }
  if(message.type==='room_state'){
   const previous=room?.code;
   room=message;
   if(previous!==room.code)log('Sala '+room.code+' aberta. Compartilhe o código com outro jogador.');
   else log('Sala atualizada: '+room.players.length+'/2 jogadores, '+room.shots+' comandos.');
   renderRoom();return;
  }
  if(message.type==='shot_event'){log('Tiro de rede #'+message.shot+' · ângulo '+message.angle+'°, força '+message.power+'%.');return;}
  if(message.type==='pong'){if(Number.isSafeInteger(message.clientSentAt))$('latency').textContent=Math.max(0,Date.now()-message.clientSentAt)+' ms';return;}
  if(message.type==='left_room'){room=null;renderRoom();log('Você saiu da sala.');return;}
  if(message.type==='error'){log('Aviso: '+(errors[message.code]||message.code));return;}
 });
 ws.addEventListener('close',event=>{
  if(socket!==ws)return;
  clearInterval(pingTimer);authenticated=false;playerId=null;room=null;socket=null;
  renderRoom();$('latency').textContent='—';
  log('Conexão encerrada'+(event.code===4001?' (chave incorreta ou autenticação inválida)':'')+'. Para reconectar, informe a chave novamente.');
 });
 ws.addEventListener('error',()=>log('Erro de rede. Verifique o endereço do servidor e a conexão.'));
});
$('create-room').addEventListener('click',()=>send({type:'create_room'}));
$('join-form').addEventListener('submit',event=>{
 event.preventDefault();send({type:'join_room',code:$('room-code').value.trim().toUpperCase()});
});
$('leave-room').addEventListener('click',()=>send({type:'leave_room'}));
$('fire-form').addEventListener('submit',event=>{
 event.preventDefault();
 send({type:'fire',angle:Number($('angle').value),power:Number($('power').value)});
});
$('copy-code').addEventListener('click',async()=>{
 if(!room)return;
 try{await navigator.clipboard.writeText(room.code);log('Código da sala copiado.');}
 catch{log('Copie o código mostrado na sala para o segundo jogador.');}
});
update();
log('Laboratório de rede pronto. Nenhum jogo foi modificado.');
