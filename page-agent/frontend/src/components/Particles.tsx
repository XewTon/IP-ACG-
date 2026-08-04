/*
 * 九歌 · 灵气粒子系统 + 人物消散效果
 * 5种粒子：月光尘埃 / 灵气光点 / 落花 / 人物消散 / 天气粒子
 * 天气感知 + 鼠标拖动人物 + 空闲浮动
 */
import { useEffect, useRef } from 'react'
import { WeatherSystem } from './weather'

interface DustParticle    { type:'dust'; x:number; y:number; size:number; opacity:number; vx:number; vy:number; color:string; life:number }
interface SpiritParticle  { type:'spirit'; x:number; y:number; baseY:number; size:number; opacity:number; phase:number; speed:number; color:string }
interface PetalParticle   { type:'petal'; x:number; y:number; size:number; opacity:number; rotation:number; rotSpeed:number; vy:number; vx:number; color:string }
interface RainParticle    { type:'rain'; x:number; y:number; length:number; speed:number; opacity:number }
interface SnowParticle    { type:'snow'; x:number; y:number; size:number; speed:number; wind:number; opacity:number }
interface FogParticle     { type:'fog'; x:number; y:number; size:number; opacity:number; vx:number }
interface FigureParticle  { type:'figure'; x:number; y:number; vx:number; vy:number; size:number; maxSize:number; opacity:number; maxOpacity:number; life:number; maxLife:number; color:string; blur:number; layer:number }

const weatherSys = new WeatherSystem('sunny')
function rand(min:number,max:number){ return Math.random()*(max-min)+min }
function pick<T>(arr:T[]):T{ return arr[Math.floor(Math.random()*arr.length)] }

const FIGURE_CX=0.72, FIGURE_CY=0.40, FIGURE_RW=0.18, FIGURE_RH=0.50
const FCOLORS={
  gold:['rgba(210,180,120,','rgba(200,155,60,','rgba(175,135,85,'],
  ink:['rgba(85,78,70,','rgba(62,56,50,','rgba(42,38,34,'],
  red:['rgba(165,40,42,','rgba(145,35,38,'],
}

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W=canvas.width, H=canvas.height, animId:number, lastFrame=performance.now()
    const resize=()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight}
    resize();window.addEventListener('resize',resize)

    const dusts:DustParticle[]=[], spirits:SpiritParticle[]=[], petals:PetalParticle[]=[]
    const weatherP:(RainParticle|SnowParticle|FogParticle)[]=[]
    const figureP:FigureParticle[]=[]

    let bodyX=W*FIGURE_CX, bodyY=H*FIGURE_CY, bodyW=W*FIGURE_RW, bodyH=H*FIGURE_RH
    let targetX=bodyX, targetY=bodyY, dragging=false, dragOX=0, dragOY=0

    canvas.style.pointerEvents='auto'
    canvas.addEventListener('mousedown',(e:MouseEvent)=>{
      const dx=e.clientX-bodyX, dy=e.clientY-bodyY
      if(Math.sqrt(dx*dx/(bodyW*bodyW)+dy*dy/(bodyH*bodyH))<1.8){dragging=true;dragOX=dx;dragOY=dy;canvas.style.cursor='grabbing'}
    })
    window.addEventListener('mousemove',(e:MouseEvent)=>{if(dragging){targetX=e.clientX-dragOX;targetY=e.clientY-dragOY}})
    window.addEventListener('mouseup',()=>{dragging=false;canvas.style.cursor='grab'})
    canvas.style.cursor='grab'

    for(let i=0;i<120;i++)dusts.push({type:'dust',x:rand(-0.1,1.1)*W,y:rand(0,1)*H,size:rand(0.4,1.8),opacity:rand(0.08,0.25),vx:rand(-0.15,0.15),vy:rand(-0.25,-0.05),color:Math.random()<0.6?'silver':'gold',life:rand(0,600)})
    for(let i=0;i<40;i++){const by=rand(0.1,0.9)*H;spirits.push({type:'spirit',x:rand(0.1,0.9)*W,y:by,baseY:by,size:rand(1.2,3.5),opacity:rand(0.15,0.5),phase:rand(0,Math.PI*2),speed:rand(8,15),color:Math.random()<0.5?'gold':'moon'})}
    for(let i=0;i<8;i++)petals.push({type:'petal',x:rand(0,1)*W,y:rand(-0.5,0)*H,size:rand(4,10),opacity:rand(0.25,0.55),rotation:rand(0,360),rotSpeed:rand(-0.3,0.3),vy:rand(0.15,0.4),vx:rand(-0.2,0.2),color:Math.random()<0.6?'pink':'white'})

    function spawnFigure():FigureParticle{
      const spread=Math.random()
      let sx:number,sy:number
      if(spread<0.55){sx=bodyX+rand(-bodyW*0.45,bodyW*0.55);sy=bodyY+rand(-bodyH*0.42,bodyH*0.48)}
      else if(spread<0.85){sx=bodyX+rand(-bodyW*0.25,bodyW*0.85);sy=bodyY+rand(-bodyH*0.52,bodyH*0.58)}
      else{sx=bodyX+rand(-bodyW*0.5,bodyW*1.4);sy=bodyY+rand(-bodyH*0.65,bodyH*0.75)}
      const dx=(sx-bodyX)/(bodyW*0.7),dy=(sy-bodyY)/(bodyH*0.65),d=Math.sqrt(dx*dx+dy*dy),isClose=d<0.55,isFar=d>1.4
      const cr=Math.random(),cb=cr<0.5?pick(FCOLORS.gold):cr<0.88?pick(FCOLORS.ink):pick(FCOLORS.red)
      const mx=isClose?rand(2.5,6):isFar?rand(0.3,1.3):rand(1,3.2)
      const mo=isClose?rand(0.5,0.9):isFar?rand(0.06,0.22):rand(0.18,0.5)
      const angle=Math.atan2(sy-bodyY,sx-bodyX)+rand(-0.4,0.4),spd=isClose?rand(0.06,0.22):rand(0.12,0.45)
      return{type:'figure',x:sx,y:sy,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,size:isClose?mx*0.6:0,maxSize:mx,opacity:0,maxOpacity:mo,life:0,maxLife:isClose?rand(280,520):rand(100,280),color:cb,blur:isClose?0:isFar?rand(3,9):rand(1,4),layer:isClose?0:isFar?2:1}
    }

    for(let i=0;i<180;i++){const p=spawnFigure();p.life=Math.random()*p.maxLife;p.opacity=p.maxOpacity*(0.4+Math.random()*0.6);p.size=p.maxSize*(0.4+Math.random()*0.6);if(Math.random()<0.35){p.x+=p.vx*p.life*0.4;p.y+=p.vy*p.life*0.4};figureP.push(p)}

    function drawBodyGlow(){
      if(!ctx)return
      const rim=ctx.createRadialGradient(bodyX-bodyW*0.15,bodyY-bodyH*0.05,bodyW*0.2,bodyX,bodyY,bodyH*0.65)
      rim.addColorStop(0,'rgba(200,155,60,0.05)');rim.addColorStop(0.4,'rgba(175,135,85,0.02)');rim.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=rim;ctx.fillRect(0,0,W,H)
      const body=ctx.createRadialGradient(bodyX,bodyY,bodyW*0.15,bodyX,bodyY,bodyH*0.55)
      body.addColorStop(0,'rgba(200,155,60,0.04)');body.addColorStop(0.6,'rgba(140,110,70,0.01)');body.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=body;ctx.fillRect(0,0,W,H)
    }

    function animate(now:number){
      const dt=Math.min(now-lastFrame,50)/16.67;lastFrame=now
      const weather=weatherSys.update(now)
      bodyX=W*FIGURE_CX;bodyY=H*FIGURE_CY;bodyW=W*FIGURE_RW;bodyH=H*FIGURE_RH
      if(!dragging){targetX=W*FIGURE_CX+Math.sin(now/6000)*30+Math.cos(now/8500)*15;targetY=H*FIGURE_CY+Math.cos(now/7000)*20+Math.sin(now/9200)*10}
      bodyX+=(targetX-bodyX)*0.03*dt;bodyY+=(targetY-bodyY)*0.03*dt

      ctx!.clearRect(0,0,W,H)
      drawBodyGlow()

      for(const d of dusts){d.x+=d.vx*dt;d.y+=d.vy*dt;d.life++;d.opacity=0.08+0.17*Math.sin(d.life/(200+Math.random()*300))*0.5+0.5;if(d.x<-50)d.x=W+50;if(d.x>W+50)d.x=-50;if(d.y<-50)d.y=H+50;if(d.y>H+50)d.y=-50;if(d.color==='gold')d.opacity*=weather.goldParticleBoost*0.7+0.3;ctx!.beginPath();ctx!.arc(d.x,d.y,d.size,0,Math.PI*2);ctx!.fillStyle=d.color==='gold'?`rgba(200,155,60,${d.opacity})`:`rgba(220,232,255,${d.opacity})`;ctx!.fill()}
      for(const s of spirits){s.y=s.baseY+Math.sin(now/1000/s.speed+s.phase)*40;s.x+=Math.cos(now/1000/(s.speed*1.5)+s.phase)*0.15*dt;s.opacity=0.15+0.35*(Math.sin(now/1000/s.speed*Math.PI+s.phase)*0.5+0.5);s.opacity*=weather.moonBrightness*0.6+0.4;ctx!.beginPath();ctx!.arc(s.x,s.y,s.size,0,Math.PI*2);ctx!.fillStyle=s.color==='gold'?`rgba(200,155,60,${s.opacity})`:`rgba(220,232,255,${s.opacity})`;ctx!.fill();if(s.size>1.8){ctx!.beginPath();ctx!.arc(s.x,s.y,s.size*3,0,Math.PI*2);ctx!.fillStyle=s.color==='gold'?`rgba(200,155,60,${s.opacity*0.08})`:`rgba(220,232,255,${s.opacity*0.06})`;ctx!.fill()}}
      for(const p of petals){p.y+=p.vy*dt;p.x+=p.vx*dt+Math.sin(now/8000+p.x/100)*0.2*dt;p.rotation+=p.rotSpeed*dt;if(p.y>H+30){p.y=-30;p.x=rand(0,W)}ctx!.save();ctx!.translate(p.x,p.y);ctx!.rotate(p.rotation*Math.PI/180);ctx!.fillStyle=p.color==='pink'?`rgba(210,150,160,${p.opacity})`:`rgba(240,235,230,${p.opacity})`;ctx!.beginPath();ctx!.ellipse(0,0,p.size*0.6,p.size*0.25,0,0,Math.PI*2);ctx!.fill();ctx!.restore()}

      for(let i=figureP.length-1;i>=0;i--){const p=figureP[i];if(p.life>=p.maxLife){figureP.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.life++;const t=p.life/p.maxLife;p.size=p.maxSize*(0.65+0.35*Math.sin(t*Math.PI));p.opacity=t<0.12?(t/0.12)*p.maxOpacity:t>0.72?((1-t)/0.28)*p.maxOpacity:p.maxOpacity;p.opacity*=weather.goldParticleBoost*0.5+0.5;ctx!.save();if(p.blur>0.5)ctx!.filter=`blur(${p.blur*0.55}px)`;ctx!.beginPath();ctx!.arc(p.x,p.y,Math.max(0.2,p.size),0,Math.PI*2);ctx!.fillStyle=p.color+`${p.opacity})`;ctx!.fill();if(p.layer===0&&p.size>2.2&&p.opacity>0.3){ctx!.beginPath();ctx!.arc(p.x,p.y,p.size*2.4,0,Math.PI*2);ctx!.fillStyle=p.color+`${p.opacity*0.06})`;ctx!.fill()}ctx!.restore()}
      const fc=[0,0,0];for(const p of figureP)fc[p.layer]++;if(fc[0]<75&&Math.random()<0.65)figureP.push(spawnFigure());if(fc[1]<70&&Math.random()<0.5)figureP.push(spawnFigure());if(fc[2]<35&&Math.random()<0.3)figureP.push(spawnFigure())

      const w=weather.current
      if(w==='rain'||w==='storm'){const n=w==='storm'?120:60;if(weatherP.length<n&&Math.random()<0.8)weatherP.push({type:'rain',x:rand(0,W),y:rand(-50,0),length:rand(8,18),speed:rand(4,10),opacity:rand(0.15,0.35)});for(let i=weatherP.length-1;i>=0;i--){const r=weatherP[i]as RainParticle;r.y+=r.speed*dt*weather.intensity;if(r.y>H+20){weatherP.splice(i,1);continue}ctx!.beginPath();ctx!.moveTo(r.x,r.y);ctx!.lineTo(r.x-1,r.y+r.length);ctx!.strokeStyle=`rgba(180,200,230,${r.opacity})`;ctx!.lineWidth=0.6;ctx!.stroke()}}
      else if(w==='snow'){if(weatherP.length<50&&Math.random()<0.3)weatherP.push({type:'snow',x:rand(0,W),y:-10,size:rand(1.5,5),speed:rand(0.5,1.5),wind:rand(-0.3,0.3),opacity:rand(0.3,0.7)});for(let i=weatherP.length-1;i>=0;i--){const s=weatherP[i]as SnowParticle;s.y+=s.speed*dt;s.x+=s.wind*dt;if(s.y>H+10){weatherP.splice(i,1);continue}ctx!.beginPath();ctx!.arc(s.x,s.y,s.size,0,Math.PI*2);ctx!.fillStyle=`rgba(240,245,255,${s.opacity})`;ctx!.fill()}}
      else if(w==='fog'){if(weatherP.length<15&&Math.random()<0.1)weatherP.push({type:'fog',x:rand(0,W),y:rand(H*0.4,H),size:rand(80,200),opacity:rand(0.02,0.06),vx:rand(-0.1,0.1)});for(let i=weatherP.length-1;i>=0;i--){const f=weatherP[i]as FogParticle;f.x+=f.vx*dt;f.opacity*=0.9995;if(f.opacity<0.003||f.x<-200||f.x>W+200){weatherP.splice(i,1);continue}ctx!.beginPath();ctx!.arc(f.x,f.y,f.size,0,Math.PI*2);ctx!.fillStyle=`rgba(220,230,240,${f.opacity})`;ctx!.fill()}}
      else{for(let i=weatherP.length-1;i>=0;i--){weatherP[i].opacity-=0.005*dt;if(weatherP[i].opacity<=0)weatherP.splice(i,1)}}

      animId=requestAnimationFrame(animate)
    }
    animId=requestAnimationFrame(animate)
    return()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',resize)}
  },[])

  return<canvas ref={canvasRef} style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',pointerEvents:'none',zIndex:4}}/>
}
