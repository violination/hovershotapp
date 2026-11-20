// Original Hover Shot artillery physics. All gameplay outcomes are computed on the server.
export const FIELD = Object.freeze({width:1200,height:640,step:8,gravity:420,dt:0.025});
const within=(x,a,b)=>Math.max(a,Math.min(b,x));
export function makeTerrain(seed=Math.random()*10000){
  const result=[];
  for(let i=0;i<=FIELD.width/FIELD.step;i++){
    const x=i*FIELD.step;
    const h=505+Math.sin(x/83+seed)*21+Math.sin(x/197+seed*.31)*25+Math.sin(x/32+seed*.61)*5;
    result.push(Math.round(h));
  }
  return result;
}
export function ground(terrain,x){
  const s=within(x/FIELD.step,0,terrain.length-1),a=Math.floor(s),b=Math.min(a+1,terrain.length-1);
  return terrain[a]+(terrain[b]-terrain[a])*(s-a);
}
export function newMatch(members,seed=Math.random()*10000){
  const players=members.map((member,i)=>({id:member.id,name:member.name.slice(0,24),x:i?1015:185,hp:100,color:i?'#ff8b78':'#cbf57c'}));
  return {terrain:makeTerrain(seed),players,turn:players[0]?.id||null,wind:Math.floor(Math.random()*17)-8,status:players.length===2?'playing':'waiting',winner:null,shots:0,revision:0};
}
export function getPublicState(room){
  const m=room.match;
  return {type:'game_state',code:room.code,mode:room.mode,players:m.players.map(p=>({...p})),turn:m.turn,wind:m.wind,terrain:[...m.terrain],status:m.status,winner:m.winner,shots:m.shots,revision:m.revision};
}
export function trace(match,playerIndex,angle,power){
  if(!Number.isInteger(angle)||angle<5||angle>85||!Number.isInteger(power)||power<15||power>100)throw Error('INVALID_SHOT');
  const shooter=match.players[playerIndex];
  if(!shooter)throw Error('INVALID_PLAYER');
  const direction=playerIndex===0?1:-1;
  const radians=angle*Math.PI/180,velocity=110+power*5.6;
  let x=shooter.x+direction*27;
  let y=ground(match.terrain,shooter.x)-32;
  let vx=direction*velocity*Math.cos(radians),vy=-velocity*Math.sin(radians);
  const path=[{x:Math.round(x),y:Math.round(y)}];
  let impact=null,directId=null;
  for(let i=0;i<280;i++){
    x+=vx*FIELD.dt;
    y+=vy*FIELD.dt;
    vx+=match.wind*8*FIELD.dt;
    vy+=FIELD.gravity*FIELD.dt;
    if(i%3===0)path.push({x:Math.round(x),y:Math.round(y)});
    for(let p=0;p<match.players.length;p++){
      if(p===playerIndex&&i<13)continue;
      const target=match.players[p];
      if(target.hp<=0)continue;
      if(Math.hypot(x-target.x,y-(ground(match.terrain,target.x)-17))<23){
        impact={x:Math.round(x),y:Math.round(y)};
        directId=target.id;
        break;
      }
    }
    if(impact)break;
    if(x<0||x>FIELD.width||y>FIELD.height+100){
      impact={x:Math.round(within(x,0,FIELD.width)),y:Math.round(within(y,-150,FIELD.height))};
      break;
    }
    if(y>=ground(match.terrain,x)){
      impact={x:Math.round(x),y:Math.round(ground(match.terrain,x))};
      break;
    }
  }
  if(!impact)impact={x:Math.round(within(x,0,FIELD.width)),y:Math.round(within(y,-150,FIELD.height))};
  path.push({...impact});
  return {path,impact,directId};
}
export function fire(match,playerId,angle,power){
  if(match.status!=='playing')throw Error('NOT_PLAYING');
  if(match.turn!==playerId)throw Error('NOT_YOUR_TURN');
  const index=match.players.findIndex(p=>p.id===playerId);
  if(index<0)throw Error('NOT_PLAYER');
  const trajectory=trace(match,index,angle,power);
  const hit=[];
  for(const player of match.players){
    if(player.hp<=0)continue;
    const centerY=ground(match.terrain,player.x)-17;
    const distance=Math.hypot(trajectory.impact.x-player.x,trajectory.impact.y-centerY);
    let damage=trajectory.directId===player.id?43:distance<77?Math.ceil(34*(1-distance/77)):0;
    if(damage>0){
      player.hp=Math.max(0,player.hp-damage);
      hit.push({id:player.id,damage,hp:player.hp});
    }
  }
  const radius=35;
  for(let i=0;i<match.terrain.length;i++){
    const dx=Math.abs(i*FIELD.step-trajectory.impact.x);
    if(dx<radius)match.terrain[i]=Math.min(610,Math.round(match.terrain[i]+23*(1-(dx/radius)**2)));
  }
  match.shots++;
  match.revision++;
  const defeated=match.players.filter(p=>p.hp===0);
  if(defeated.length){
    match.status='finished';
    const survivors=match.players.filter(p=>p.hp>0);
    match.winner=survivors.length===1?survivors[0].id:null;
    match.turn=null;
  }else{
    match.turn=match.players[1-index].id;
    match.wind=Math.max(-8,Math.min(8,match.wind+Math.floor(Math.random()*7)-3));
  }
  return {type:'shot_result',by:playerId,angle,power,path:trajectory.path,impact:trajectory.impact,hit,shot:match.shots,revision:match.revision};
}
export function chooseCpuShot(match){
  const bot=match.players.findIndex(p=>p.id==='cpu');
  if(bot<0)throw Error('MISSING_CPU');
  const target=match.players.find(p=>p.id!=='cpu');
  let best=null;
  for(let angle=22;angle<=80;angle+=2){
    for(let power=30;power<=100;power+=2){
      const result=trace(match,bot,angle,power);
      const diff=Math.abs(result.impact.x-target.x);
      const score=(result.directId===target.id?-40:0)+diff+Math.abs(result.impact.y-ground(match.terrain,target.x))*.15;
      if(!best||score<best.score)best={angle,power,score};
    }
  }
  // Deliberate imperfection keeps the solo mode approachable.
  return {angle:within(best.angle+Math.round((Math.random()-.5)*5),5,85),power:within(best.power+Math.round((Math.random()-.5)*11),15,100)};
}
