const $=id=>document.getElementById(id);
const canvas=$('battlefield'),ctx=canvas.getContext('2d');
const W=1200,H=640,STEP=8,GRAVITY=420,DT=.025;
let ws=null,myId=null,state=null,animation=null,pending=null,connected=false,connecting=false,leaving=false,toastTimeout=null,lastFrame=0;
const rng=n=>Math.floor((Math.sin(n*13.312+9)*43758.5453%1+1)%1*1000)/1000;
const stars=Array.from({length:78},(_,i)=>({x:rng(i+4)*W,y:rng(i+109)*245,r:.6+rng(i+330)*1.7}));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const live=()=>ws?.readyState===WebSocket.OPEN;
const send=m=>{if(live())ws.send(JSON.stringify(m));};
const own=()=>state?.players?.find(p=>p.id===myId);
const current=()=>Boolean(state?.status==='playing'&&state.turn===myId&&!animation);
const errors={ALREADY_IN_ROOM:'Você já está em uma sala.',ROOM_LIMIT:'Servidor com muitas salas. Tente novamente.',ROOM_NOT_FOUND:'Sala não encontrada. Confira o código.',ROOM_FULL:'A sala já está cheia.',INVALID_CODE:'O código deve ter 6 caracteres.',NO_ROOM:'Você não está numa sala.',NOT_PLAYING:'A partida ainda não começou.',NOT_YOUR_TURN:'Aguarde sua vez.',NOT_PLAYER:'Jogador não encontrado.',INVALID_SHOT:'Tiro inválido.',SHOT_COOLDOWN:'Aguarde a animação do disparo.',NOT_FINISHED:'A partida ainda está acontecendo.',UNKNOWN_ACTION:'Comando desconhecido.'};
function announce(message){
 const el=$('toast');el.textContent=message;el.hidden=false;
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.hidden=true;},4600);
}
function connectionStatus(text,ok=false){$('connection').classList.toggle('online',ok);$('connection').lastChild.textContent=' '+text;}
function showMenu(){
 state=null;animation=null;myId=null;connected=false;connecting=false;
 $('start-screen').hidden=false;$('end-screen').hidden=true;
 $('solo').disabled=false;$('duel').disabled=false;
 $('room-label').textContent='MODO DE JOGO · HOVER SHOT';
 $('copy-room').hidden=true;$('leave').hidden=true;
 $('stage-status').textContent='SELECIONE UM MODO DE JOGO';
 connectionStatus('Pronto para jogar');
 updateHud();
}
function openGame(action){
 if(connecting||live())return;
 const name=$('nickname').value.trim();
 if(!name){announce('Informe seu nome para começar.');$('nickname').focus();return;}
 pending=action;leaving=false;connecting=true;
 $('solo').disabled=true;$('duel').disabled=true;
 $('stage-status').textContent='CONECTANDO À ARENA…';
 connectionStatus('Conectando...');
 const protocol=location.protocol==='https:'?'wss:':'ws:';
 const sock=new WebSocket(protocol+'//'+location.host+'/play-ws');
 ws=sock;
 sock.addEventListener('open',()=>send({type:'hello',name}));
 sock.addEventListener('message',e=>{
  let m;try{m=JSON.parse(e.data);}catch{announce('Resposta inválida do servidor');return;}
  if(m.type==='welcome'){
   connected=true;connecting=false;myId=m.id;connectionStatus('Servidor online',true);
   if(pending)send(pending);pending=null;return;
  }
  if(m.type==='game_state'){state=m;animation=null;$('start-screen').hidden=true;$('end-screen').hidden=true;updateHud();return;}
  if(m.type==='shot_result'){
   animation={path:m.path,impact:m.impact,hit:m.hit,by:m.by,nextState:m.state,start:performance.now(),duration:1500};
   updateHud();return;
  }
  if(m.type==='message'){announce(m.text);return;}
  if(m.type==='pong')return;
  if(m.type==='left_room'){sock.close(1000,'left');return;}
  if(m.type==='error'){announce(errors[m.code]||'Erro: '+m.code);return;}
 });
 sock.addEventListener('close',()=>{
  if(ws!==sock)return;
  ws=null;
  if(!leaving)announce('Conexão encerrada. Se o Render hibernou, inicie novamente.');
  showMenu();
 });
 sock.addEventListener('error',()=>{if(ws===sock)announce('Falha de conexão com o servidor do jogo.');});
}
$('solo').addEventListener('click',()=>openGame({type:'create_solo'}));
$('duel').addEventListener('click',()=>openGame({type:'create_room'}));
$('join-form').addEventListener('submit',e=>{
 e.preventDefault();
 openGame({type:'join_room',code:$('code').value.trim().toUpperCase()});
});
$('leave').addEventListener('click',()=>{leaving=true;if(ws){ws.close(1000,'exit');ws=null;}showMenu();});
$('back-menu').addEventListener('click',()=>{leaving=true;if(ws){ws.close(1000,'exit');ws=null;}showMenu();});
$('rematch').addEventListener('click',()=>{send({type:'rematch'});$('end-screen').hidden=true;announce('Solicitação de revanche enviada.');});
$('copy-room').addEventListener('click',async()=>{
 if(!state)return;
 try{await navigator.clipboard.writeText(state.code);announce('Código '+state.code+' copiado!');}
 catch{announce('Compartilhe o código da sala: '+state.code);}
});
function setSlider(id,num){const e=$(id);e.value=String(clamp(num,Number(e.min),Number(e.max)));updateSlider();}
function updateSlider(){
 $('angle-val').textContent=$('angle').value+'°';
 $('power-val').textContent=$('power').value+'%';
}
for(const id of ['angle','power'])$(id).addEventListener('input',updateSlider);
function fireNow(){
 if(!current())return;
 send({type:'fire',angle:Number($('angle').value),power:Number($('power').value)});
 $('fire').disabled=true;
}
$('fire').addEventListener('click',fireNow);
document.addEventListener('keydown',e=>{
 const el=document.activeElement;
 if(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName))return;
 if(!state||!current())return;
 if(e.code==='ArrowUp'){setSlider('angle',Number($('angle').value)+1);e.preventDefault();}
 else if(e.code==='ArrowDown'){setSlider('angle',Number($('angle').value)-1);e.preventDefault();}
 else if(e.code==='ArrowRight'){setSlider('power',Number($('power').value)+1);e.preventDefault();}
 else if(e.code==='ArrowLeft'){setSlider('power',Number($('power').value)-1);e.preventDefault();}
 else if(e.code==='Space'){fireNow();e.preventDefault();}
});
function updateHud(){
 const p=state?.players||[];
 const left=p[0],right=p[1];
 $('name-left').textContent=left?.name||'JOGADOR';
 $('name-right').textContent=right?.name||'ADVERSÁRIO';
 for(const [side,player] of [['left',left],['right',right]]){
  $(`hp-${side}`).style.width=(player?.hp??100)+'%';
  $(`hp-text-${side}`).textContent=(player?.hp??100)+' HP';
 }
 $('round').textContent=state?'DISPARO '+(state.shots+1):'PARTIDA RÁPIDA';
 const wind=state?.wind??0;
 $('wind').textContent=state?'VENTO '+(wind===0?'CALMO':wind>0?'→ '+wind:'← '+Math.abs(wind)):'VENTO —';
 $('fire').disabled=!current();
 $('angle').disabled=!current();$('power').disabled=!current();
 $('copy-room').hidden=!state||state.mode!=='duel';
 $('leave').hidden=!state;
 $('room-label').textContent=!state?'MODO DE JOGO · HOVER SHOT':state.mode==='solo'?'SOLO · CONTRA BOT ATLAS':'SALA ONLINE · '+state.code;
 if(!state){
  $('turn-title').textContent='AGUARDANDO PARTIDA';$('turn-hint').textContent='Escolha um modo de jogo para começar.';
  $('stage-status').textContent='SELECIONE UM MODO DE JOGO';
  return;
 }
 if(state.status==='waiting'){
  $('turn-title').textContent='AGUARDANDO UM AMIGO';
  $('turn-hint').textContent='Compartilhe o código '+state.code+' com outra pessoa.';
  $('stage-status').textContent='SALA '+state.code+' · ESPERANDO ADVERSÁRIO';
 }else if(state.status==='finished'){
  $('turn-title').textContent=state.winner===myId?'VOCÊ VENCEU!':'PARTIDA ENCERRADA';
  $('turn-hint').textContent='Escolha revanche ou volte ao menu.';
  $('stage-status').textContent='FIM DE PARTIDA';
  if(!animation)showEnd();
 }else{
  const myTurn=state.turn===myId;
  $('turn-title').textContent=animation?'PROJÉTIL EM VOO':myTurn?'SUA VEZ DE DISPARAR':'TURNO DO ADVERSÁRIO';
  $('turn-hint').textContent=animation?'Calculando o impacto no terreno…':myTurn?'Ajuste ângulo e potência e aperte DISPARAR.':'Aguarde o próximo tiro.';
  $('stage-status').textContent=state.mode==='solo'?'DUELO CONTRA BOT ATLAS':'DUELO ONLINE · '+state.code;
 }
}
function showEnd(){
 if(!state||state.status!=='finished')return;
 const win=state.winner===myId,draw=state.winner===null;
 $('end-eyebrow').textContent='BATALHA CONCLUÍDA';
 $('end-title').textContent=draw?'EMPATE':win?'VITÓRIA!':'DERROTA';
 $('end-title').style.color=win?'#d6fc91':draw?'#f1e8a3':'#ff9d8b';
 $('end-subtitle').textContent=draw?'Ninguém resistiu ao impacto.':win?'Você dominou a arena. Quer mais uma?':'Ajuste sua estratégia e tente novamente.';
 $('end-screen').hidden=false;
}
function terrainY(terrain,x){
 const p=clamp(x/STEP,0,terrain.length-1),a=Math.floor(p),b=Math.min(a+1,terrain.length-1);
 return terrain[a]+(terrain[b]-terrain[a])*(p-a);
}
function sky(now){
 const gradient=ctx.createLinearGradient(0,0,0,H);
 gradient.addColorStop(0,'#142742');gradient.addColorStop(.48,'#345c77');gradient.addColorStop(1,'#b4938d');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 const sun=ctx.createRadialGradient(925,130,20,925,130,370);
 sun.addColorStop(0,'rgba(255,216,163,.36)');sun.addColorStop(.45,'rgba(231,171,128,.12)');sun.addColorStop(1,'rgba(231,171,128,0)');
 ctx.fillStyle=sun;ctx.fillRect(500,0,700,510);
 ctx.fillStyle='#f9dfb1';ctx.beginPath();ctx.arc(925,132,41,0,Math.PI*2);ctx.fill();
 for(const star of stars){ctx.globalAlpha=.18+Math.sin(now*.001+star.x)*.09;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,6.283);ctx.fill();}
 ctx.globalAlpha=1;
 for(const [depth,color,base,amp,offset] of [[.15,'#405d70',380,36,0],[.32,'#334c62',420,33,40],[.55,'#293c52',460,20,90]]){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=12)ctx.lineTo(x,base+Math.sin(x/87+depth*7+offset)*amp+Math.sin(x/29+depth*5)*amp*.2);
  ctx.lineTo(W,H);ctx.fill();
 }
}
function drawGround(terrain){
 if(!terrain)return;
 const grd=ctx.createLinearGradient(0,390,0,H);grd.addColorStop(0,'#6a8e72');grd.addColorStop(.2,'#3b644b');grd.addColorStop(1,'#192f32');
 ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,terrain[0]);
 for(let i=1;i<terrain.length;i++)ctx.lineTo(i*STEP,terrain[i]);
 ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=grd;ctx.fill();
 ctx.beginPath();ctx.moveTo(0,terrain[0]);
 for(let i=1;i<terrain.length;i++)ctx.lineTo(i*STEP,terrain[i]);
 ctx.strokeStyle='#c7ce88';ctx.lineWidth=5;ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,terrain[0]+5);
 for(let i=1;i<terrain.length;i++)ctx.lineTo(i*STEP,terrain[i]+5);
 ctx.strokeStyle='#4d6d4f';ctx.lineWidth=8;ctx.stroke();
 // Subtle vertical underlay marks give scale without texture assets.
 ctx.strokeStyle='#d3ddaa0d';ctx.lineWidth=1;
 for(let x=30;x<W;x+=66){const y=terrainY(terrain,x);ctx.beginPath();ctx.moveTo(x,y+12);ctx.lineTo(x,H);ctx.stroke();}
}
function drawTank(player,index,terrain,now){
 const x=player.x,y=terrainY(terrain,x)-15;
 const isMe=player.id===myId;
 const tint=index===0?'#bbee77':'#fc927e';
 const dark=index===0?'#507a3c':'#a84e4e';
 ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#00101b40';ctx.beginPath();ctx.ellipse(0,19,39,9,0,0,Math.PI*2);ctx.fill();
 // Active turn indicator.
 if(state?.turn===player.id&&state.status==='playing'){
  ctx.strokeStyle=tint;ctx.lineWidth=2;ctx.globalAlpha=.4+Math.sin(now*.004)*.18;
  ctx.beginPath();ctx.ellipse(0,6,36,25,0,0,6.283);ctx.stroke();ctx.globalAlpha=1;
 }
 const angle=(isMe&&state?.turn===myId?Number($('angle').value):45)*Math.PI/180;
 const dir=index===0?1:-1;
 ctx.save();ctx.translate(dir*4,-10);ctx.rotate(-dir*angle);
 ctx.fillStyle='#314b4a';ctx.fillRect(0,-6,42,12);
 ctx.fillStyle=tint;ctx.fillRect(15,-6,21,5);
 ctx.fillStyle='#e2f5ad';ctx.fillRect(37,-7,6,14);
 ctx.restore();
 // Tank chassis.
 ctx.fillStyle='#1c292e';ctx.beginPath();ctx.ellipse(0,7,32,14,0,0,6.283);ctx.fill();
 for(const wx of [-22,-9,9,22]){ctx.fillStyle='#34494a';ctx.beginPath();ctx.arc(wx,8,7,0,6.283);ctx.fill();ctx.fillStyle='#85989c';ctx.beginPath();ctx.arc(wx,8,2,0,6.283);ctx.fill();}
 ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-28,-11);ctx.lineTo(-17,-23);ctx.lineTo(18,-23);ctx.lineTo(29,-8);ctx.closePath();ctx.fill();
 const bodyGrad=ctx.createLinearGradient(0,-23,0,2);bodyGrad.addColorStop(0,tint);bodyGrad.addColorStop(1,dark);
 ctx.fillStyle=bodyGrad;ctx.beginPath();ctx.roundRect(-28,-14,56,17,5);ctx.fill();
 ctx.fillStyle='#d2ebcc';ctx.beginPath();ctx.roundRect(-9,-27,19,15,6);ctx.fill();
 ctx.fillStyle='#284044';ctx.beginPath();ctx.roundRect(-6,-24,13,10,4);ctx.fill();
 ctx.fillStyle=tint;ctx.beginPath();ctx.arc(0,-12,7,0,6.283);ctx.fill();
 ctx.restore();
 ctx.textAlign='center';ctx.font='800 14px Manrope, sans-serif';ctx.fillStyle='#061421a6';ctx.fillRect(x-61,y-71,122,25);
 ctx.fillStyle='#f4fbff';ctx.fillText(player.name.length>15?player.name.slice(0,14)+'…':player.name,x,y-53);
 ctx.fillStyle='#0a1620b0';ctx.fillRect(x-48,y-42,96,7);
 ctx.fillStyle=tint;ctx.fillRect(x-48,y-42,96*player.hp/100,7);
}
function drawGuide(player,index,terrain){
 if(!player||!current())return;
 const angle=Number($('angle').value)*Math.PI/180,power=Number($('power').value);
 let x=player.x+(index===0?27:-27),y=terrainY(terrain,player.x)-32;
 let vx=(index===0?1:-1)*(110+power*5.6)*Math.cos(angle),vy=-(110+power*5.6)*Math.sin(angle);
 ctx.save();ctx.fillStyle='#f8ffcd';
 for(let i=0;i<30;i++){
  x+=vx*DT;y+=vy*DT;vx+=state.wind*8*DT;vy+=GRAVITY*DT;
  if(i%3===0){ctx.globalAlpha=clamp(.7-i/45,.15,.8);ctx.beginPath();ctx.arc(x,y,3-i/24,0,6.283);ctx.fill();}
  if(y>=terrainY(terrain,x)||x<0||x>W)break;
 }
 ctx.restore();
}
function drawShot(a,now){
 if(!a)return;
 const progress=clamp((now-a.start)/1120,0,1);
 const path=a.path||[];
 const count=Math.max(1,Math.min(path.length,Math.floor(progress*(path.length-1))+1));
 ctx.save();ctx.strokeStyle='#ffdc91';ctx.lineWidth=3;ctx.shadowColor='#ffe3a7';ctx.shadowBlur=16;
 ctx.beginPath();for(let i=0;i<count;i++){const p=path[i];if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();
 const head=path[count-1];
 if(head&&progress<1){ctx.fillStyle='#fff5b5';ctx.beginPath();ctx.arc(head.x,head.y,7,0,6.283);ctx.fill();}
 if(progress>=1){
  const elapsed=now-a.start-1120,fade=clamp(1-elapsed/380,0,1);
  ctx.globalAlpha=fade;
  ctx.strokeStyle='#fff4ae';ctx.lineWidth=7;
  ctx.beginPath();ctx.arc(a.impact.x,a.impact.y,12+elapsed*.2,0,6.283);ctx.stroke();
  ctx.fillStyle='#ffe293';ctx.beginPath();ctx.arc(a.impact.x,a.impact.y,12+elapsed*.11,0,6.283);ctx.fill();
  if(a.hit?.length){ctx.font='1000 28px Manrope,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('-'+a.hit.map(x=>x.damage).reduce((x,y)=>x+y,0),a.impact.x,a.impact.y-46);}
 }
 ctx.restore();
}
function backdrop(now){
 sky(now);
 if(state?.terrain){
  drawGround(state.terrain);
  state.players.forEach((p,i)=>drawTank(p,i,state.terrain,now));
  const index=state.players.findIndex(p=>p.id===myId);
  if(index>=0)drawGuide(state.players[index],index,state.terrain);
  drawShot(animation,now);
 }else{
  const fallback=Array.from({length:151},(_,i)=>505+Math.sin(i/13)*18+Math.sin(i/29)*21);
  drawGround(fallback);
  [{id:'preview-left',name:'HOVER',x:185,hp:100},{id:'preview-right',name:'SHOT',x:1015,hp:100}].forEach((p,i)=>drawTank(p,i,fallback,now));
 }
 // Crisp field edge and depth darkening.
 const v=ctx.createLinearGradient(0,0,0,H);v.addColorStop(0,'#09142510');v.addColorStop(1,'#020c18a0');
 ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
}
function loop(now){
 ctx.clearRect(0,0,W,H);
 backdrop(now);
 if(animation&&now-animation.start>=animation.duration){
  state=animation.nextState;
  animation=null;
  updateHud();
 }
 lastFrame=now;
 requestAnimationFrame(loop);
}
updateSlider();showMenu();requestAnimationFrame(loop);
