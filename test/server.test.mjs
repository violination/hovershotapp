import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createLabServer } from '../server.mjs';

const token='test-secret-long-enough-42-characters';
async function start(t){
  const lab=createLabServer({accessToken:token,allowLocalOrigin:true});
  await new Promise(resolve=>lab.server.listen(0,'127.0.0.1',resolve));
  const port=lab.server.address().port;
  const sockets=[];
  t.after(async()=>{for(const ws of sockets)ws.terminate();await lab.close();});
  function connect(origin='http://127.0.0.1:'+port){
    const ws=new WebSocket('ws://127.0.0.1:'+port+'/ws',{origin});
    const received=[];
    const waiters=[];
    ws.on('message',buf=>{
      const msg=JSON.parse(buf.toString());
      received.push(msg);
      for(const w of [...waiters])if(w.filter(msg)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(msg);}
    });
    sockets.push(ws);
    const next=(filter,timeout=1200)=>{
      const match=received.find(filter);
      if(match)return Promise.resolve(match);
      return new Promise((resolve,reject)=>{
        const w={filter,resolve};
        w.timer=setTimeout(()=>{const index=waiters.indexOf(w);if(index>=0)waiters.splice(index,1);reject(Error('Timeout waiting for message: '+received.map(x=>x.type).join(',')));},timeout);
        waiters.push(w);
      });
    };
    const send=msg=>ws.send(JSON.stringify(msg));
    return {ws,next,send,received,open:()=>ws.readyState===WebSocket.OPEN?Promise.resolve():once(ws,'open')};
  }
  return {port,connect,lab};
}
async function auth(client,name){
  await client.open();
  client.send({type:'auth',token,name});
  return client.next(x=>x.type==='authenticated');
}
test('saúde HTTP e interface web isolada sem expor segredo',{timeout:15000},async t=>{
  const {port,connect}=await start(t);
  const health=await fetch('http://127.0.0.1:'+port+'/healthz');
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{status:'ok',service:'hover-shot-network-lab',protocol:'lab-v1'});
  const page=await fetch('http://127.0.0.1:'+port+'/lab');
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-type'),/text\/html/);
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(await page.text(),/Duas pessoas/);
  const js=await fetch('http://127.0.0.1:'+port+'/lab.js');
  assert.equal(js.status,200);
  assert.match(js.headers.get('content-type'),/javascript/);
  assert.ok(!(await js.text()).includes(token));
  const missing=await fetch('http://127.0.0.1:'+port+'/secret');
  assert.equal(missing.status,404);
  await missing.text(); // liberar a conexão keep-alive antes do teardown do servidor
  const denied=connect('https://malicious.example');
  await assert.rejects(denied.open(),/403/);
});
test('autenticação errada não autoriza salas',{timeout:15000},async t=>{
  const {connect}=await start(t);
  const c=connect();await c.open();
  c.send({type:'auth',name:'Visitante',token:'segredo-errado'});
  const [code]=await once(c.ws,'close');
  assert.equal(code,4001);
});
test('2 jogadores: criar sala, entrar, alternar turnos e impedir terceiro',{timeout:15000},async t=>{
  const {connect,lab}=await start(t);
  const a=connect();const aa=await auth(a,'Alice');
  const b=connect();const bb=await auth(b,'Bob');
  const c=connect();await auth(c,'Carol');
  a.send({type:'create_room'});
  const first=await a.next(x=>x.type==='room_state'&&x.players.length===1);
  assert.match(first.code,/^[A-F0-9]{6}$/);
  a.send({type:'fire',angle:50,power:70});
  assert.equal((await a.next(x=>x.type==='error'&&x.code==='NEED_TWO_PLAYERS')).code,'NEED_TWO_PLAYERS');
  b.send({type:'join_room',code:first.code.toLowerCase()});
  await a.next(x=>x.type==='room_state'&&x.players.length===2);
  const joined=await b.next(x=>x.type==='room_state'&&x.players.length===2);
  assert.equal(joined.turn,aa.id);
  c.send({type:'join_room',code:first.code});
  assert.equal((await c.next(x=>x.type==='error'&&x.code==='ROOM_FULL')).code,'ROOM_FULL');
  b.send({type:'fire',angle:45,power:50});
  assert.equal((await b.next(x=>x.type==='error'&&x.code==='NOT_YOUR_TURN')).code,'NOT_YOUR_TURN');
  a.send({type:'fire',angle:181,power:50});
  assert.equal((await a.next(x=>x.type==='error'&&x.code==='INVALID_SHOT')).code,'INVALID_SHOT');
  a.send({type:'fire',angle:70,power:80});
  const fired=await b.next(x=>x.type==='shot_event'&&x.shot===1);
  assert.deepEqual([fired.playerId,fired.angle,fired.power,fired.mode],[aa.id,70,80,'network_only']);
  const newTurn=await b.next(x=>x.type==='room_state'&&x.shots===1);
  assert.equal(newTurn.turn,bb.id);
  b.send({type:'fire',angle:45,power:70});
  await a.next(x=>x.type==='shot_event'&&x.shot===2);
  b.send({type:'leave_room'});
  await b.next(x=>x.type==='left_room');
  const alone=await a.next(x=>x.type==='room_state'&&x.players.length===1&&x.shots===2);
  assert.equal(alone.turn,aa.id);
  a.send({type:'leave_room'});
  await a.next(x=>x.type==='left_room');
  assert.equal(lab.rooms.size,0);
});
test('limite por conexão encerra excesso de mensagens',{timeout:15000},async t=>{
  const {connect}=await start(t);
  const c=connect();await auth(c,'Limite');
  for(let i=0;i<30;i++)if(c.ws.readyState===WebSocket.OPEN)c.send({type:'ping',clientSentAt:i});
  const [code]=await once(c.ws,'close');
  assert.equal(code,1008);
});
