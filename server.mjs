import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { attachArena } from './game/network.mjs';

const folder=resolve(fileURLToPath(new URL('.',import.meta.url)));
const assets={
  '/':{body:readFileSync(resolve(folder,'public/game.html')),type:'text/html; charset=utf-8'},
  '/play':{body:readFileSync(resolve(folder,'public/game.html')),type:'text/html; charset=utf-8'},
  '/game.css':{body:readFileSync(resolve(folder,'public/game.css')),type:'text/css; charset=utf-8'},
  '/game.js':{body:readFileSync(resolve(folder,'public/game.js')),type:'text/javascript; charset=utf-8'},
  '/lab':{body:readFileSync(resolve(folder,'public/index.html')),type:'text/html; charset=utf-8'},
  '/lab.css':{body:readFileSync(resolve(folder,'public/lab.css')),type:'text/css; charset=utf-8'},
  '/lab.js':{body:readFileSync(resolve(folder,'public/lab.js')),type:'text/javascript; charset=utf-8'}
};
const LIMITS=Object.freeze({clients:48,rooms:24,playersPerRoom:2,messagesPerWindow:20,windowMs:10_000,maxPayload:4096});
const csp="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' wss: ws:; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function equalTokens(a,b){
  if(typeof a!=='string'||a.length>256)return false;
  const left=createHash('sha256').update(a).digest();
  const right=createHash('sha256').update(b).digest();
  return timingSafeEqual(left,right);
}
function json(ws,value){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));}
function validName(value){return typeof value==='string'&&value.trim().length>=1&&value.trim().length<=24&&/^[^\x00-\x1f<>]+$/.test(value.trim());}
function validCode(value){return typeof value==='string'&&/^[A-F0-9]{6}$/.test(value);}
function fail(ws,code){json(ws,{type:'error',code});}

export function createLabServer({accessToken,allowLocalOrigin=false}={}){
  if(typeof accessToken!=='string'||accessToken.length<20)throw Error('LAB_ACCESS_TOKEN exige pelo menos 20 caracteres');
  const rooms=new Map();
  const clients=new Map();
  const wss=new WebSocketServer({noServer:true,maxPayload:LIMITS.maxPayload,perMessageDeflate:false});
  const allowedOrigins=new Set(['https://hovershot.online','https://www.hovershot.online','https://app.hovershot.online']);
  const renderHost=process.env.RENDER_EXTERNAL_HOSTNAME;
  if(renderHost&&/^[a-z0-9.-]+$/i.test(renderHost))allowedOrigins.add('https://'+renderHost);
  const configured=process.env.LAB_ALLOWED_ORIGINS||'';
  for(const origin of configured.split(',').map(x=>x.trim()).filter(Boolean)){
    if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))throw Error('LAB_ALLOWED_ORIGINS invalida');
    allowedOrigins.add(origin);
  }
  function originAllowed(origin){
    return allowedOrigins.has(origin)||
      (typeof origin==='string'&&/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin))||
      (allowLocalOrigin&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||''));
  }
  function roomState(room){
    return {type:'room_state',code:room.code,players:[...room.members.values()].map(ws=>({id:clients.get(ws).id,name:clients.get(ws).name})),turn:room.turn,shots:room.shots,mode:'network_lab_no_physics'};
  }
  function broadcast(room,message){for(const ws of room.members.values())json(ws,message);}
  function sendState(room){broadcast(room,roomState(room));}
  function leave(ws){
    const state=clients.get(ws);
    if(!state?.room)return;
    const room=rooms.get(state.room);
    state.room=null;
    if(!room)return;
    room.members.delete(state.id);
    if(!room.members.size){rooms.delete(room.code);return;}
    if(!room.members.has(room.turn))room.turn=[...room.members.keys()][0];
    sendState(room);
  }
  function assign(ws,room){
    const state=clients.get(ws);
    room.members.set(state.id,ws);
    state.room=room.code;
    sendState(room);
  }
  const server=createServer((request,response)=>{
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Cache-Control','no-store');
    response.setHeader('Content-Security-Policy',csp);
    if(request.method!=='GET'){response.writeHead(405);response.end();return;}
    const path=new URL(request.url||'/', 'http://localhost').pathname;
    if(path==='/healthz'){
      response.writeHead(200,{'Content-Type':'application/json'});
      response.end(JSON.stringify({status:'ok',service:'hover-shot-network-lab',protocol:'lab-v1'}));return;
    }
    const asset=assets[path];
    if(asset){response.writeHead(200,{'Content-Type':asset.type});response.end(asset.body);return;}
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Not found');
  });
  server.on('upgrade',(req,socket,head)=>{
    let path;
    try{path=new URL(req.url||'/', 'http://localhost').pathname;}catch{socket.destroy();return;}
    if(path==='/play-ws')return;
    if(path!=='/ws'||!originAllowed(req.headers.origin)||wss.clients.size>=LIMITS.clients){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  wss.on('connection',ws=>{
    const state={id:randomUUID(),name:null,room:null,authed:false,windowStart:Date.now(),messages:0,alive:true};
    clients.set(ws,state);
    const authTimeout=setTimeout(()=>{if(!state.authed)ws.close(4001,'Authentication required');},9000);
    authTimeout.unref();
    ws.on('pong',()=>{state.alive=true;});
    ws.on('message',(raw,isBinary)=>{
      if(isBinary){ws.close(1003,'JSON only');return;}
      const now=Date.now();
      if(now-state.windowStart>LIMITS.windowMs){state.windowStart=now;state.messages=0;}
      if(++state.messages>LIMITS.messagesPerWindow){ws.close(1008,'Rate limit');return;}
      let message;
      try{message=JSON.parse(raw.toString('utf8'));}catch{fail(ws,'INVALID_JSON');return;}
      if(!message||typeof message!=='object'||Array.isArray(message)||typeof message.type!=='string'){fail(ws,'INVALID_MESSAGE');return;}
      if(!state.authed){
        if(message.type!=='auth'||!equalTokens(message.token,accessToken)||!validName(message.name)){ws.close(4001,'Unauthorized');return;}
        state.authed=true;
        state.name=message.name.trim();
        clearTimeout(authTimeout);
        json(ws,{type:'authenticated',id:state.id,protocol:'lab-v1'});
        return;
      }
      if(message.type==='ping'){
        json(ws,{type:'pong',clientSentAt:Number.isSafeInteger(message.clientSentAt)?message.clientSentAt:null});
        return;
      }
      if(message.type==='leave_room'){leave(ws);json(ws,{type:'left_room'});return;}
      if(message.type==='create_room'){
        if(state.room){fail(ws,'ALREADY_IN_ROOM');return;}
        if(rooms.size>=LIMITS.rooms){fail(ws,'ROOM_LIMIT');return;}
        let code;
        do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
        const room={code,members:new Map(),turn:state.id,shots:0};
        rooms.set(code,room);assign(ws,room);return;
      }
      if(message.type==='join_room'){
        if(state.room){fail(ws,'ALREADY_IN_ROOM');return;}
        const code=typeof message.code==='string'?message.code.trim().toUpperCase():'';
        if(!validCode(code)){fail(ws,'INVALID_CODE');return;}
        const room=rooms.get(code);
        if(!room){fail(ws,'ROOM_NOT_FOUND');return;}
        if(room.members.size>=LIMITS.playersPerRoom){fail(ws,'ROOM_FULL');return;}
        assign(ws,room);return;
      }
      if(message.type==='fire'){
        const room=rooms.get(state.room);
        if(!room||room.members.size!==2){fail(ws,'NEED_TWO_PLAYERS');return;}
        if(room.turn!==state.id){fail(ws,'NOT_YOUR_TURN');return;}
        if(!Number.isInteger(message.angle)||message.angle<0||message.angle>180||!Number.isInteger(message.power)||message.power<1||message.power>100){fail(ws,'INVALID_SHOT');return;}
        room.shots++;
        broadcast(room,{type:'shot_event',playerId:state.id,angle:message.angle,power:message.power,shot:room.shots,mode:'network_only'});
        room.turn=[...room.members.keys()].find(id=>id!==state.id);
        sendState(room);return;
      }
      fail(ws,'UNKNOWN_ACTION');
    });
    ws.on('close',()=>{clearTimeout(authTimeout);leave(ws);clients.delete(ws);});
    ws.on('error',()=>{});
  });
  const arena=attachArena(server,{allowLocalOrigin});
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
    for(const ws of wss.clients)ws.close(1012,'Service restarting');
    return arena.close().then(()=>new Promise(resolve=>{wss.close(()=>{server.close(()=>resolve());server.closeAllConnections();});}));
  }
  return {server,close,rooms,arena,limits:LIMITS};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const token=process.env.LAB_ACCESS_TOKEN;
  const app=createLabServer({accessToken:token});
  const port=Number(process.env.PORT||10000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT invalida');
  app.server.listen(port,'0.0.0.0',()=>console.log('HOVER_SHOT_GAME_READY port='+port));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.close().finally(()=>process.exit(0));});
}
