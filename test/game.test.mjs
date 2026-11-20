import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createLabServer } from '../server.mjs';
import { newMatch,fire,trace,ground,chooseCpuShot } from '../game/physics.mjs';

const token='test-secret-long-enough-42-characters';
async function setup(t){
  const app=createLabServer({accessToken:token,allowLocalOrigin:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+app.server.address().port;
  const sockets=[];
  t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();});
  const connect=async(origin=host)=>{
    const ws=new WebSocket(host.replace('http:','ws:')+'/play-ws',{origin});
    sockets.push(ws);
    const received=[],watchers=[];
    ws.on('message',buf=>{
      const msg=JSON.parse(buf.toString());received.push(msg);
      for(const item of [...watchers])if(item.predicate(msg)){
        clearTimeout(item.timer);watchers.splice(watchers.indexOf(item),1);item.resolve(msg);
      }
    });
    await once(ws,'open');
    const next=(predicate,ms=5000)=>{
      const cached=received.find(predicate);
      if(cached)return Promise.resolve(cached);
      return new Promise((resolve,reject)=>{
        const entry={predicate,resolve};
        entry.timer=setTimeout(()=>{watchers.splice(watchers.indexOf(entry),1);reject(Error('Timeout waiting for '+received.map(x=>x.type).join(',')));},ms);
        watchers.push(entry);
      });
    };
    return {ws,received,next,send:m=>ws.send(JSON.stringify(m))};
  };
  return {connect,host,app};
}
test('site abre o jogo em / e mantém /lab, CSS e JS',{timeout:15000},async t=>{
  const {host}=await setup(t);
  for(const [path,expected] of [['/','JOGAR AGORA'],['/play','JOGAR AGORA'],['/game.css','arena-frame'],['/game.js','create_solo'],['/lab','Laboratório de rede']]){
    const res=await fetch(host+path);assert.equal(res.status,200,path);
    assert.match(await res.text(),new RegExp(expected),path);
  }
});
test('física é reproduzível, validada e faz estrago controlado',{timeout:15000},()=>{
  const m=newMatch([{id:'a',name:'Alice'},{id:'b',name:'Bob'}],123);
  assert.equal(m.status,'playing');assert.equal(m.players.length,2);
  assert.equal(m.terrain.length,151);
  assert.ok(ground(m.terrain,200)>300);
  assert.throws(()=>trace(m,0,92,90),/INVALID_SHOT/);
  assert.throws(()=>fire(m,'b',45,78),/NOT_YOUR_TURN/);
  const r=fire(m,'a',45,78);
  assert.equal(r.type,'shot_result');assert.ok(r.path.length>5);
  assert.equal(m.shots,1);assert.equal(m.revision,1);assert.equal(m.turn,'b');
  assert.ok(m.players.every(p=>p.hp>=0&&p.hp<=100));
  const solo=newMatch([{id:'p',name:'Pessoa'},{id:'cpu',name:'BOT'}],345);
  const ai=chooseCpuShot(solo);
  assert.ok(ai.angle>=5&&ai.angle<=85);
  assert.ok(ai.power>=15&&ai.power<=100);
});
test('jogo solo sem token, tiro validado e resposta da CPU',{timeout:18000},async t=>{
  const {connect}=await setup(t);
  const c=await connect();
  c.send({type:'hello',name:'Solo'});
  const welcome=await c.next(m=>m.type==='welcome');
  c.send({type:'create_solo'});
  const start=await c.next(m=>m.type==='game_state'&&m.mode==='solo');
  assert.equal(start.status,'playing');
  assert.equal(start.players.length,2);
  assert.equal(start.turn,welcome.id);
  c.send({type:'fire',angle:999,power:20});
  assert.equal((await c.next(m=>m.type==='error'&&m.code==='INVALID_SHOT')).code,'INVALID_SHOT');
  c.send({type:'fire',angle:46,power:78});
  const shot=await c.next(m=>m.type==='shot_result'&&m.shot===1);
  assert.equal(shot.by,welcome.id);assert.ok(shot.path.length>5);
  const bot=await c.next(m=>m.type==='shot_result'&&m.by==='cpu',11000);
  assert.equal(bot.shot,2);assert.equal(bot.state.shots,2);
});
test('jogo 1x1 com código, controles de turno e recusa de origem externa',{timeout:18000},async t=>{
  const {connect,host}=await setup(t);
  const a=await connect();a.send({type:'hello',name:'A'});const helloA=await a.next(m=>m.type==='welcome');
  const b=await connect();b.send({type:'hello',name:'B'});const helloB=await b.next(m=>m.type==='welcome');
  const c=await connect();c.send({type:'hello',name:'C'});await c.next(m=>m.type==='welcome');
  a.send({type:'create_room'});
  const room=await a.next(m=>m.type==='game_state'&&m.status==='waiting');
  assert.match(room.code,/^[0-9A-F]{6}$/);
  b.send({type:'join_room',code:room.code.toLowerCase()});
  const start=await b.next(m=>m.type==='game_state'&&m.status==='playing');
  assert.equal(start.players.length,2);
  assert.equal(start.turn,helloA.id);
  c.send({type:'join_room',code:room.code});
  await c.next(m=>m.type==='error'&&m.code==='ROOM_FULL');
  b.send({type:'fire',angle:45,power:80});
  await b.next(m=>m.type==='error'&&m.code==='NOT_YOUR_TURN');
  a.send({type:'fire',angle:50,power:80});
  const shot=await b.next(m=>m.type==='shot_result');
  assert.equal(shot.by,helloA.id);assert.equal(shot.state.turn,helloB.id);
  const denied=new WebSocket(host.replace('http:','ws:')+'/play-ws',{origin:'https://untrusted.example'});
  await assert.rejects(once(denied,'open'),/403/);
});
