import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { newMatch, getPublicState, fire, chooseCpuShot } from './physics.mjs';

const LIMITS=Object.freeze({clients:48,rooms:24,maxPayload:4096,maxMessages:20,windowMs:10000});
const code=()=>randomBytes(3).toString('hex').toUpperCase();
const validName=s=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=22&&/^[^<>\x00-\x1f]+$/.test(s.trim());
const validCode=s=>typeof s==='string'&&/^[A-F0-9]{6}$/.test(s);
const push=(socket,data)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));};

export function attachArena(server,{allowLocalOrigin=false}={}){
  const rooms=new Map(),clients=new Map(),wss=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:LIMITS.maxPayload});
  function originAllowed(origin){
    const renderHost=process.env.RENDER_EXTERNAL_HOSTNAME;
    return origin==='https://app.hovershot.online'||origin==='https://hovershot.online'||
      origin==='https://www.hovershot.online'||
      (typeof origin==='string'&&/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin))||
      (renderHost&&origin==='https://'+renderHost)||
      (allowLocalOrigin&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||''));
  }
  server.on('upgrade',(req,socket,head)=>{
    let path;try{path=new URL(req.url||'/', 'http://localhost').pathname;}catch{return;}
    if(path!=='/play-ws')return;
    if(!originAllowed(req.headers.origin)||wss.clients.size>=LIMITS.clients){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  function broadcast(room,data){for(const ws of room.members.values())push(ws,data);}
  function notify(room){broadcast(room,getPublicState(room));}
  function refresh(room){
    const members=[...room.members.values()].map(ws=>({id:clients.get(ws).id,name:clients.get(ws).name}));
    if(room.mode==='solo')members.push({id:'cpu',name:'BOT ATLAS'});
    room.match=newMatch(members);
    room.readyAt=0;
    room.rematchVotes.clear();
    notify(room);
  }
  function remove(ws){
    const state=clients.get(ws);
    if(!state?.room)return;
    const room=rooms.get(state.room);
    state.room=null;
    if(!room)return;
    room.members.delete(state.id);
    if(room.timer){clearTimeout(room.timer);room.timer=null;}
    if(!room.members.size){rooms.delete(room.code);return;}
    refresh(room);
  }
  function roomJoin(ws,room){
    const state=clients.get(ws);
    room.members.set(state.id,ws);
    state.room=room.code;
    refresh(room);
  }
  function create(ws,mode){
    const client=clients.get(ws);
    if(client.room){push(ws,{type:'error',code:'ALREADY_IN_ROOM'});return;}
    if(rooms.size>=LIMITS.rooms){push(ws,{type:'error',code:'ROOM_LIMIT'});return;}
    let roomCode;
    do{roomCode=code();}while(rooms.has(roomCode));
    const room={code:roomCode,mode,members:new Map(),match:null,timer:null,readyAt:0,rematchVotes:new Set()};
    rooms.set(roomCode,room);
    roomJoin(ws,room);
  }
  function handleFire(ws,message){
    const client=clients.get(ws),room=rooms.get(client.room);
    if(!room){push(ws,{type:'error',code:'NO_ROOM'});return;}
    if(Date.now()<room.readyAt){push(ws,{type:'error',code:'SHOT_COOLDOWN'});return;}
    let result;
    try{result=fire(room.match,client.id,message.angle,message.power);}
    catch(error){push(ws,{type:'error',code:error.message||'INVALID_SHOT'});return;}
    room.readyAt=Date.now()+1550;
    broadcast(room,{...result,state:getPublicState(room)});
    if(room.mode==='solo'&&room.match.status==='playing'&&room.match.turn==='cpu'){
      room.timer=setTimeout(()=>{
        room.timer=null;
        if(!rooms.has(room.code)||room.match.status!=='playing'||room.match.turn!=='cpu')return;
        const shot=chooseCpuShot(room.match);
        const botResult=fire(room.match,'cpu',shot.angle,shot.power);
        room.readyAt=Date.now()+1550;
        broadcast(room,{...botResult,state:getPublicState(room)});
      },1750);
      room.timer.unref();
    }
  }
  wss.on('connection',ws=>{
    const state={id:randomUUID(),name:null,room:null,ready:false,windowStart:Date.now(),count:0,alive:true};
    clients.set(ws,state);
    const handshake=setTimeout(()=>{if(!state.ready)ws.close(1008,'Hello required');},9000);
    handshake.unref();
    ws.on('pong',()=>{state.alive=true;});
    ws.on('message',(raw,isBinary)=>{
      if(isBinary){ws.close(1003,'JSON only');return;}
      const now=Date.now();
      if(now-state.windowStart>LIMITS.windowMs){state.windowStart=now;state.count=0;}
      if(++state.count>LIMITS.maxMessages){ws.close(1008,'Rate limit');return;}
      let message;
      try{message=JSON.parse(raw.toString());}
      catch{push(ws,{type:'error',code:'INVALID_JSON'});return;}
      if(!message||typeof message!=='object'||Array.isArray(message)){push(ws,{type:'error',code:'INVALID_MESSAGE'});return;}
      if(!state.ready){
        if(message.type!=='hello'||!validName(message.name)){ws.close(1008,'Invalid name');return;}
        state.name=message.name.trim();
        state.ready=true;
        clearTimeout(handshake);
        push(ws,{type:'welcome',id:state.id,protocol:'hover-arena-v1'});
        return;
      }
      switch(message.type){
        case 'ping':push(ws,{type:'pong',sent:Number.isSafeInteger(message.sent)?message.sent:null});return;
        case 'create_solo':create(ws,'solo');return;
        case 'create_room':create(ws,'duel');return;
        case 'join_room':{
          if(state.room){push(ws,{type:'error',code:'ALREADY_IN_ROOM'});return;}
          const roomCode=typeof message.code==='string'?message.code.trim().toUpperCase():'';
          if(!validCode(roomCode)){push(ws,{type:'error',code:'INVALID_CODE'});return;}
          const room=rooms.get(roomCode);
          if(!room||room.mode!=='duel'){push(ws,{type:'error',code:'ROOM_NOT_FOUND'});return;}
          if(room.members.size>=2){push(ws,{type:'error',code:'ROOM_FULL'});return;}
          roomJoin(ws,room);return;
        }
        case 'leave_room':remove(ws);push(ws,{type:'left_room'});return;
        case 'fire':handleFire(ws,message);return;
        case 'rematch':{
          const room=rooms.get(state.room);
          if(!room||room.match.status!=='finished'){push(ws,{type:'error',code:'NOT_FINISHED'});return;}
          room.rematchVotes.add(state.id);
          if(room.mode==='solo'||room.rematchVotes.size===2)refresh(room);
          else broadcast(room,{type:'message',text:'Aguardando o adversário aceitar a revanche…'});
          return;
        }
        default:push(ws,{type:'error',code:'UNKNOWN_ACTION'});
      }
    });
    ws.on('close',()=>{clearTimeout(handshake);remove(ws);clients.delete(ws);});
    ws.on('error',()=>{});
  });
  const heartbeat=setInterval(()=>{
    for(const ws of wss.clients){
      const state=clients.get(ws);
      if(!state?.alive){ws.terminate();continue;}
      state.alive=false;ws.ping();
    }
  },30000);
  heartbeat.unref();
  function close(){
    clearInterval(heartbeat);
    for(const room of rooms.values())if(room.timer)clearTimeout(room.timer);
    for(const ws of wss.clients)ws.terminate();
    return new Promise(resolve=>wss.close(resolve));
  }
  return {wss,rooms,close,limits:LIMITS};
}
