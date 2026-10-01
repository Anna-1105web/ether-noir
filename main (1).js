(function(){
"use strict";
document.documentElement.classList.add('js','pre');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const win=(p,a,b,f=.06)=>clamp((p-a)/f)*clamp((b-p)/f);

/* film grain */
(function(){const c=document.createElement('canvas');c.width=c.height=220;const x=c.getContext('2d');const d=x.createImageData(220,220);for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);document.querySelector('.grain').style.backgroundImage='url('+c.toDataURL()+')';})();

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -12% 0px'});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

if(!window.THREE){document.documentElement.classList.remove('pre');return;}
const T=THREE;

/* ================= texture + geometry helpers ================= */
function canvasTex(w,h,draw,color=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
function rrShape(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function slab(w,h,d,r,b,seg=5){const g=new T.ExtrudeGeometry(rrShape(w-2*b,h-2*b,r),{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:seg,curveSegments:12});g.center();g.computeVertexNormals();return g;}
function tracked(ctx,str,cx,y,sp){const ch=[...str];const ws=ch.map(c=>ctx.measureText(c).width);const tot=ws.reduce((a,b)=>a+b,0)+sp*(ch.length-1);let x=cx-tot/2;ctx.textAlign='left';ch.forEach((c,i)=>{ctx.fillText(c,x,y);x+=ws[i]+sp;});}
function noiseCanvas(x,w,h,base,spread,n,rmax){x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<n;i++){const v=spread[0]+Math.random()*(spread[1]-spread[0])|0;x.fillStyle=`rgba(${v},${v},${v},${Math.random()*.5})`;x.beginPath();x.arc(Math.random()*w,Math.random()*h,Math.random()*rmax,0,7);x.fill();}}

/* brushed metal: fine vertical streaks (roughness) */
const brushed=canvasTex(1024,256,(x,w,h)=>{x.fillStyle='#7a7a7a';x.fillRect(0,0,w,h);for(let i=0;i<5200;i++){const v=95+Math.random()*80|0;x.fillStyle=`rgba(${v},${v},${v},${.2+Math.random()*.5})`;x.fillRect(Math.random()*w,0,1,h);}},false);
brushed.wrapS=T.RepeatWrapping;

/* liquid glow: brighter toward the walls and the base, where the rim light passes through */
const liquidGlow=canvasTex(512,512,(x,w,h)=>{
  x.fillStyle='#000';x.fillRect(0,0,w,h);
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,170,90,.55)');g.addColorStop(.12,'rgba(255,150,70,.12)');g.addColorStop(.7,'rgba(255,140,60,.12)');g.addColorStop(1,'rgba(255,150,60,.7)');x.fillStyle=g;x.fillRect(0,0,w,h);
  g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(255,160,70,.9)');g.addColorStop(.16,'rgba(255,140,60,.1)');g.addColorStop(.84,'rgba(255,140,60,.05)');g.addColorStop(1,'rgba(255,160,70,.5)');x.fillStyle=g;x.fillRect(0,0,w,h);
});

function makeLabel(name,ink){
  return canvasTex(1024,1152,(x,w,h)=>{
    x.fillStyle=ink;x.textBaseline='alphabetic';
    x.font='400 150px Italiana, Georgia, serif';tracked(x,window.etherT('label.brand'),w/2,h*.34,40);
    x.font='400 54px "Tenor Sans", sans-serif';tracked(x,window.etherT(name),w/2,h*.435,30);
    x.globalAlpha=.8;x.font='400 26px "Tenor Sans", sans-serif';tracked(x,window.etherT('label.edp'),w/2,h*.74,11);
    x.font='400 24px "Tenor Sans", sans-serif';tracked(x,window.etherT('label.ml'),w/2,h*.93,10);
  });
}

/* ---- the bottle (procedural stand-in; replace with gltf.scene from ether_noir.glb, same pivot) ---- */
const W_=1.6,H_=1.9,D_=.98;
const BOTTOM=-H_/2-.41;
function createBottle(o){
  const g=new T.Group(), inner=new T.Group(); g.add(inner); inner.position.y=-.41;
  // heavy glass block: real transmission + attenuation gives the smoked tint and refraction
  const glass=new T.Mesh(slab(W_,H_,D_,.05,.075,6),new T.MeshPhysicalMaterial({
    color:o.glass,metalness:0,roughness:.035,transmission:1,thickness:1.25,ior:1.52,
    attenuationColor:o.att,attenuationDistance:o.attD,specularIntensity:1,envMapIntensity:o.env*.8
  }));
  inner.add(glass);
  // liquid: opaque so it is captured in the transmission pass and refracted by the walls
  const lq=liquidGlow.clone();lq.needsUpdate=true;lq.repeat.set(1/1.32,1/1.46);lq.offset.set(.5,.5);
  const liquid=new T.Mesh(slab(1.32,1.46,.64,.07,.05),new T.MeshPhysicalMaterial({
    color:o.liquid,roughness:.1,metalness:0,clearcoat:1,clearcoatRoughness:.06,
    emissive:o.glow,emissiveMap:lq,emissiveIntensity:o.ei,envMapIntensity:.5
  }));
  liquid.position.y=.16;inner.add(liquid);
  // screen-printed label on the outer face
  const label=new T.Mesh(new T.PlaneGeometry(1.24,1.395),new T.MeshBasicMaterial({map:makeLabel(o.name,o.ink),transparent:true,depthWrite:false,toneMapped:false,opacity:.94}));
  label.position.set(0,.16,D_/2+.003);label.userData.isLabel=o;inner.add(label);
  // neck + collar
  const darkMetal=new T.MeshPhysicalMaterial({color:0x0b0b0b,metalness:.9,roughness:.28,envMapIntensity:1.4});
  const neck=new T.Mesh(new T.CylinderGeometry(.27,.29,.12,64),darkMetal);neck.position.y=H_/2+.06;inner.add(neck);
  const ring=new T.Mesh(new T.CylinderGeometry(.31,.31,.025,64),new T.MeshPhysicalMaterial({color:o.ring,metalness:1,roughness:.22}));ring.position.y=H_/2+.0125;inner.add(ring);
  // thick cylindrical cap with softened edges (lathe profile)
  const r=.62,h=.68,e=.035,pts=[new T.Vector2(0,-h/2),new T.Vector2(r-e,-h/2)];
  for(let i=0;i<=6;i++){const a=-Math.PI/2+i/6*Math.PI/2;pts.push(new T.Vector2(r-e+Math.cos(a)*e,-h/2+e+Math.sin(a)*e));}
  for(let i=0;i<=6;i++){const a=i/6*Math.PI/2;pts.push(new T.Vector2(r-e+Math.cos(a)*e,h/2-e+Math.sin(a)*e));}
  pts.push(new T.Vector2(0,h/2));
  const capMat=new T.MeshPhysicalMaterial({color:o.cap,metalness:o.capMetal,roughness:1.2,roughnessMap:brushed,clearcoat:.35,clearcoatRoughness:.35,envMapIntensity:o.capEnv});
  const cap=new T.Mesh(new T.LatheGeometry(pts,160),capMat);cap.position.y=H_/2+.12+h/2;inner.add(cap);
  const seam=new T.Mesh(new T.TorusGeometry(r+.001,.004,6,160),new T.MeshBasicMaterial({color:0x000000}));seam.rotation.x=Math.PI/2;seam.position.y=cap.position.y-h/2+.07;inner.add(seam);
  return g;
}
const VARIANTS={
  noir:{name:'label.noir',glass:0xd2c6ba,att:0x70482c,attD:1.5,env:1.7,liquid:0x3a1405,glow:0xd06020,ei:.6,cap:0x070707,capMetal:.3,capEnv:.2,ring:0x6e5232,ink:'#e6d8bf'},
  ambre:{name:'label.ambre',glass:0xe8d2b8,att:0x7a3c10,attD:1.1,env:1.5,liquid:0x7a3208,glow:0xe07a28,ei:.6,cap:0x9c7a48,capMetal:1,capEnv:1.25,ring:0xc9a46a,ink:'#f2e4cc'},
  blanc:{name:'label.blanc',glass:0xffffff,att:0xf2ede4,attD:5,env:1.5,liquid:0xcfc8bb,glow:0x4a4440,ei:.15,cap:0xb5b2ad,capMetal:1,capEnv:1.25,ring:0xe0ddd8,ink:'#2a2622'}
};

/* studio environment: black room, two amber strip boxes behind (edge lines), one front strip (face streak) */
function buildEnv(renderer){
  const s=new T.Scene();s.background=new T.Color(0x000000);
  const panel=(w,h,c,p,lookAt=[0,0,0])=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(c[0],c[1],c[2]),side:T.DoubleSide}));m.position.set(...p);m.lookAt(...lookAt);s.add(m);};
  panel(1.4,9,[6,2.6,.7],[-4.5,0,-3.5]);      // back-left amber strip  → left edge rim
  panel(1.1,9,[3.2,1.35,.38],[4.5,.5,-3.2]);  // back-right amber strip → right edge rim
  panel(.16,6,[1.5,1.32,1.1],[-2.2,.6,5.4]);   // front-left hairline strip → thin vertical streak on the face
  panel(3,1.6,[.3,.24,.18],[0,7,1.5]);         // faint top
  panel(9,6,[.22,.08,.02],[0,1,-8]);           // distant warm haze
  const pm=new T.PMREMGenerator(renderer);const t=pm.fromScene(s,.015).texture;pm.dispose();return t;
}
function makeRenderer(canvas,dpr){
  const r=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setPixelRatio(Math.min(devicePixelRatio,dpr));r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;r.setClearColor(0x000000,0);
  return r;
}

/* ================= main stage ================= */
const canvas=document.getElementById('stage');
const R=makeRenderer(canvas,1.6);
const scene=new T.Scene();scene.environment=buildEnv(R);
scene.fog=new T.Fog(0x0a0807,11,30);
const cam=new T.PerspectiveCamera(30,1,.1,90);

scene.add(new T.HemisphereLight(0x3a2a1e,0x050302,.6));
const rimL=new T.SpotLight(0xff8a3a,260,30,.5,.8,2);rimL.position.set(-4.2,3.6,-4.5);scene.add(rimL);
const rimR=new T.SpotLight(0xffa860,90,30,.5,.9,2);rimR.position.set(4.5,2.2,-4);scene.add(rimR);
const key=new T.SpotLight(0xffe6c8,26,30,.32,1,2);key.position.set(2.8,5.5,6.5);scene.add(key);
const graze=new T.SpotLight(0xff9a48,12,20,.45,1,2);graze.position.set(-1.5,1.2,-5);scene.add(graze); // rakes the stone top from behind

const dotTex=canvasTex(64,64,(x,w)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,w);});
const smokeTex=canvasTex(512,512,(x,w)=>{for(let i=0;i<140;i++){const r=30+Math.random()*120,px=w/2+(Math.random()-.5)*w*.6,py=w/2+(Math.random()-.5)*w*.45;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,w);}x.globalCompositeOperation='destination-in';const m=x.createRadialGradient(w/2,w/2,w*.08,w/2,w/2,w/2);m.addColorStop(0,'#000');m.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=m;x.fillRect(0,0,w,w);});
const glowTex=canvasTex(256,256,(x,w)=>{const g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,170,90,1)');g.addColorStop(.3,'rgba(230,120,50,.4)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,w);});

/* rig: everything that travels with the bottle through the scroll story */
const rig=new T.Group();scene.add(rig);
const bottle=createBottle(VARIANTS.noir);rig.add(bottle);
[rimL,rimR,key,graze].forEach(l=>l.target=bottle);

/* backdrop: opaque so the glass refracts it; its edges are exactly the page colour */
const backTex=canvasTex(1600,960,(x,w,h)=>{
  x.fillStyle='#0a0807';x.fillRect(0,0,w,h);
  const u=w/24,cx=w/2,cy=h/2-.2*u;
  const haze=(px,py,rx,ry,stops)=>{x.save();x.translate(px,py);x.scale(rx/ry,1);const g=x.createRadialGradient(0,0,0,0,0,ry);stops.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.beginPath();x.arc(0,0,ry,0,7);x.fill();x.restore();};
  haze(cx,cy,4.6*u,3.6*u,[[0,'rgba(84,36,11,.9)'],[.45,'rgba(40,16,6,.55)'],[1,'rgba(10,8,7,0)']]);
  haze(cx-.25*u,cy+.35*u,1.9*u,1.55*u,[[0,'rgba(186,92,30,.62)'],[.55,'rgba(104,42,12,.22)'],[1,'rgba(10,8,7,0)']]);
  // smoke structure inside the light, so it never reads as a flat gradient
  for(let i=0;i<320;i++){const a=Math.random()*6.28,d=Math.pow(Math.random(),.8)*3.6*u,px=cx+Math.cos(a)*d*1.2,py=cy+Math.sin(a)*d*.8;const r=(.25+Math.random()*1.1)*u;const k=Math.max(0,1-d/(3.6*u));
    const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(${140+Math.random()*60|0},${62+Math.random()*30|0},22,${.06*k})`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(px-r,py-r,2*r,2*r);}
  for(let i=0;i<70;i++){const px=cx+(Math.random()-.5)*8*u,py=cy+(Math.random()-.5)*6*u;const r=(.5+Math.random()*1.2)*u;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(10,8,7,.35)');g.addColorStop(1,'rgba(10,8,7,0)');x.fillStyle=g;x.fillRect(px-r,py-r,2*r,2*r);}
});
const backdrop=new T.Mesh(new T.PlaneGeometry(24,14.4),new T.MeshBasicMaterial({map:backTex,toneMapped:false,fog:false}));
backdrop.position.set(-.3,.4,-7);rig.add(backdrop);

/* stone ledge + shadows (hero and final only) */
const ledge=new T.Group();rig.add(ledge);
const stoneMap=canvasTex(1024,1024,(x,w,h)=>{noiseCanvas(x,w,h,'#7c7c7c',[30,200],9000,5);for(let i=0;i<60;i++){x.strokeStyle=`rgba(40,40,40,${Math.random()*.4})`;x.lineWidth=Math.random()*2;x.beginPath();let px=Math.random()*w,py=Math.random()*h;x.moveTo(px,py);for(let j=0;j<8;j++){px+=(Math.random()-.5)*90;py+=(Math.random()-.5)*90;x.lineTo(px,py);}x.stroke();}},false);
stoneMap.wrapS=stoneMap.wrapT=T.RepeatWrapping;stoneMap.repeat.set(2,2);
const stone=new T.Mesh(slab(9,2.2,4.2,.02,.05,3),new T.MeshPhysicalMaterial({color:0x0c0a09,roughness:.82,roughnessMap:stoneMap,bumpMap:stoneMap,bumpScale:2.2,metalness:0,clearcoat:.18,clearcoatRoughness:.3,envMapIntensity:.3}));
stone.position.set(.6,BOTTOM-1.1,.35);ledge.add(stone);
const shadowTex=canvasTex(256,256,(x,w)=>{for(let i=0;i<28;i++){const k=i/28;x.fillStyle=`rgba(0,0,0,${.05})`;const p=10+k*60,r=24+(1-k)*30;x.beginPath();x.roundRect?x.roundRect(p,p*.85+20,w-2*p,w-2*(p*.85+20),r):x.rect(p,p*.85+20,w-2*p,w-2*(p*.85+20));x.fill();}},false);
const contact=new T.Mesh(new T.PlaneGeometry(2.6,1.9),new T.MeshBasicMaterial({color:0x000000,alphaMap:shadowTex,transparent:true,depthWrite:false,opacity:.95,polygonOffset:true,polygonOffsetFactor:-2}));
contact.rotation.x=-Math.PI/2;contact.position.y=BOTTOM+.004;bottle.add(contact);
const ao=new T.Mesh(new T.PlaneGeometry(5,3.2),new T.MeshBasicMaterial({color:0x000000,alphaMap:canvasTex(256,256,(x,w)=>{const g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,w);},false),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
ao.rotation.x=-Math.PI/2;ao.position.set(0,BOTTOM+.003,0);ledge.add(ao);
// warm light thrown through the glass onto the stone (fake caustic)
const caustic=new T.Mesh(new T.PlaneGeometry(2.2,1.4),new T.MeshBasicMaterial({map:glowTex,color:0xc8682a,transparent:true,opacity:.12,blending:T.AdditiveBlending,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
caustic.rotation.x=-Math.PI/2;caustic.position.set(.55,BOTTOM+.005,.95);ledge.add(caustic);

/* smoke: low on the ledge and drifting behind */
const smokes=[];
for(let i=0;i<14;i++){
  const front=i<5;
  const m=new T.SpriteMaterial({map:smokeTex,color:front?0x8a6040:0xb0602a,transparent:true,opacity:0,blending:front?T.NormalBlending:T.AdditiveBlending,depthWrite:false,fog:false});
  const s=new T.Sprite(m);const sc=front?2.4+Math.random()*2:3+Math.random()*3.5;s.scale.set(sc*1.6,sc,1);
  s.userData={x:(Math.random()-.5)*(front?4.5:7),y:front?BOTTOM+.25+Math.random()*.4:-1.2+Math.random()*2.4,z:front?.4+Math.random()*1.4:-4.5+Math.random()*2.2,o:front?.07+Math.random()*.06:.05+Math.random()*.07,sp:.015+Math.random()*.03,ph:Math.random()*6.28,rs:(Math.random()-.5)*.03,front};
  s.material.rotation=Math.random()*6.28;
  rig.add(s);smokes.push(s);
}

/* dust motes catching the amber light */
const PN=420,pp=new Float32Array(PN*3),pv=new Float32Array(PN);
for(let i=0;i<PN;i++){pp[i*3]=(Math.random()-.5)*14;pp[i*3+1]=(Math.random()-.5)*9;pp[i*3+2]=-18+Math.random()*22;pv[i]=.03+Math.random()*.08;}
const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(pp,3));
const particles=new T.Points(pg,new T.PointsMaterial({size:.028,map:dotTex,color:0xffb26a,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
scene.add(particles);

/* ---- ingredients for the notes flight ---- */
const notes=new T.Group();scene.add(notes);notes.visible=false;
function bumpy(geo,f,a){const p=geo.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=Math.sin(v.x*f)*Math.sin(v.y*f*1.13)*Math.sin(v.z*f*.91);v.multiplyScalar(1+a*n);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();return geo;}
const ING={};
{const g=new T.Group();
  const fruit=new T.Mesh(bumpy(new T.SphereGeometry(.62,96,96),46,.012),new T.MeshPhysicalMaterial({color:0x9d9a35,roughness:.5,clearcoat:.35,clearcoatRoughness:.4}));fruit.scale.set(1,.94,1);g.add(fruit);
  const top=canvasTex(512,512,(x,w)=>{const c=w/2;x.fillStyle='#6f7a24';x.beginPath();x.arc(c,c,c,0,7);x.fill();x.fillStyle='#e9e2bf';x.beginPath();x.arc(c,c,c*.9,0,7);x.fill();for(let i=0;i<11;i++){const a0=i/11*6.283+.04,a1=(i+1)/11*6.283-.04;x.fillStyle=i%2?'#d9cf6a':'#cfc35a';x.beginPath();x.moveTo(c+Math.cos((a0+a1)/2)*c*.1,c+Math.sin((a0+a1)/2)*c*.1);x.arc(c,c,c*.82,a0,a1);x.closePath();x.fill();}x.fillStyle='#efe9cc';x.beginPath();x.arc(c,c,c*.08,0,7);x.fill();});
  const side=new T.MeshStandardMaterial({color:0x8e9030,roughness:.55});
  const slice=new T.Mesh(new T.CylinderGeometry(.5,.5,.1,64),[side,new T.MeshPhysicalMaterial({map:top,roughness:.3,clearcoat:.8}),side]);
  slice.position.set(.85,-.45,.25);slice.rotation.set(1.15,0,.35);g.add(slice);
  g.userData.base=[-1.25,.45,-1.2];ING.bergamot=g;}
{const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x1d1611,roughness:.85,metalness:.05});
  for(let i=0;i<18;i++){const r=.09+Math.random()*.04;const c=new T.Mesh(bumpy(new T.SphereGeometry(r,20,20),70,.09),m);const a=Math.random()*6.28,b=Math.acos(2*Math.random()-1),d=.15+Math.random()*.38;c.position.set(Math.sin(b)*Math.cos(a)*d,Math.cos(b)*d*.7,Math.sin(b)*Math.sin(a)*d);g.add(c);}
  g.userData.base=[1.35,-.45,-4.2];ING.pepper=g;}
{const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x2c3a25,roughness:.7,flatShading:true}),stem=new T.MeshStandardMaterial({color:0x3a2a1c,roughness:.8});
  const pts=[];for(let i=0;i<8;i++)pts.push(new T.Vector3(Math.sin(i*.5)*.15,-1+i*.28,Math.cos(i*.4)*.08));
  const curve=new T.CatmullRomCurve3(pts);g.add(new T.Mesh(new T.TubeGeometry(curve,40,.025,6),stem));
  for(let i=0;i<46;i++){const t=i/46,p=curve.getPoint(t),sd=i%2?1:-1;const l=new T.Mesh(new T.ConeGeometry(.07,.32*(1-t*.5),5),m);l.position.copy(p).add(new T.Vector3(sd*.07,0,(i%3-1)*.05));l.rotation.z=sd*-.55;l.rotation.y=i*.7;g.add(l);
    if(i%6==3){const br=new T.Mesh(new T.ConeGeometry(.05,.5*(1-t),5),m);br.position.copy(p).add(new T.Vector3(sd*.24,.05,0));br.rotation.z=sd*-1.05;g.add(br);}}
  const coneM=new T.MeshStandardMaterial({color:0x5e4a33,roughness:.75,flatShading:true});
  [[.42,-.55,.15],[.55,-.25,-.12]].forEach(q=>{const c=new T.Mesh(new T.DodecahedronGeometry(.17,0),coneM);c.position.set(...q);g.add(c);});
  g.userData.base=[-1.2,0,-7.2];ING.cypress=g;}
{const g=new T.Group();
  const rings=canvasTex(512,512,(x,w)=>{const c=w/2;x.fillStyle='#8a5a34';x.fillRect(0,0,w,w);for(let r=4;r<c;r+=4+Math.random()*7){x.strokeStyle=`rgba(${70+Math.random()*30|0},${38+Math.random()*16|0},${18+Math.random()*10|0},${.35+Math.random()*.4})`;x.lineWidth=1+Math.random()*2.5;x.beginPath();for(let a=0;a<=6.3;a+=.05){const rr=r+Math.sin(a*3+r)*1.5;const px=c+Math.cos(a)*rr+r*.04,py=c+Math.sin(a)*rr;a?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();}});
  const bark=canvasTex(512,128,(x,w,h)=>{x.fillStyle='#2b1c13';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){x.fillStyle=`rgba(${60+Math.random()*40|0},${40+Math.random()*20|0},25,${Math.random()*.6})`;x.fillRect(Math.random()*w,0,1+Math.random()*3,h);}});
  bark.wrapS=T.RepeatWrapping;
  const sideM=new T.MeshStandardMaterial({map:bark,roughness:.95}),faceM=new T.MeshStandardMaterial({map:rings,roughness:.75});
  const log=new T.Mesh(new T.CylinderGeometry(.82,.86,.3,72),[sideM,faceM,faceM]);log.rotation.x=1.2;g.add(log);
  g.userData.base=[1.25,.4,-10.2];ING.cedar=g;}
{const g=new T.Group();
  const am=new T.MeshPhysicalMaterial({color:0xd9822b,emissive:0x7a3007,emissiveIntensity:.6,roughness:.12,metalness:.05,clearcoat:1,flatShading:true,envMapIntensity:2});
  g.add(new T.Mesh(bumpy(new T.IcosahedronGeometry(.72,1),3.2,.18),am));
  for(let i=0;i<7;i++){const s=new T.Mesh(new T.TetrahedronGeometry(.08+Math.random()*.12,0),am);const a=i/7*6.28;s.position.set(Math.cos(a)*1.25,Math.sin(a*1.7)*.5,Math.sin(a)*.6);s.rotation.set(a,a*2,0);g.add(s);}
  const sp=new T.Sprite(new T.SpriteMaterial({map:glowTex,transparent:true,opacity:.45,blending:T.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.set(4,4,1);sp.position.z=-.8;g.add(sp);
  g.add(new T.PointLight(0xff9a40,12,5,2));
  g.userData.base=[0,-.05,-13.4];ING.amber=g;}
Object.values(ING).forEach(g=>notes.add(g));
const noteLight=new T.DirectionalLight(0xffd2a0,2.4);noteLight.position.set(2,3,2);notes.add(noteLight);

/* ================= scroll choreography ================= */
const $=s=>document.querySelector(s);
const secFrag=$('#fragrance'),secBottle=$('#bottle'),secNotes=$('#notes'),secColl=$('#collection'),secFinal=$('#final');
const callouts=[...document.querySelectorAll('.callout')];
const stepN=$('#bs-n'),stepV=$('#bs-v');
const nTitle=$('.n-title'),nOutro=$('.n-outro'),nTrack=[...document.querySelectorAll('.n-track i')];
const nLabels={};document.querySelectorAll('.n-label').forEach(l=>nLabels[l.dataset.k]=l);
const prog=$('.progress');
let W=0,H=0,narrow=false,WP=[],coverA=0,coverB=0,B0=0,BL=1,N0=0,NL=1;
const K=['bx','by','bz','rot','bs','cx','cy','cz','tx','ty','tz','notes','glow'];
function top(el){return el.getBoundingClientRect().top+scrollY;}
function layout(){
  W=innerWidth;H=innerHeight;narrow=W<760;const asp=W/H;
  R.setSize(W,H,false);cam.aspect=asp;cam.updateProjectionMatrix();
  const base=narrow?10.4:7.2;
  const D={bx:0,by:0,bz:0,rot:0,bs:1,cx:0,cy:0,cz:base,tx:0,ty:0,tz:0,notes:0,glow:1};
  const S=(y,o)=>Object.assign({y},D,o);
  const f0=top(secFrag),fE=f0+secFrag.offsetHeight-H;
  B0=top(secBottle);BL=secBottle.offsetHeight-H;
  N0=top(secNotes);NL=secNotes.offsetHeight-H;
  const F0=top(secFinal);
  // hero framing: bottle on the right third on desktop, centred under the title on phones
  const heroX=narrow?0:Math.min(1.75,.36*asp*1.2+.2);
  let heroState={bx:heroX,by:.18,rot:-.46,cz:8,cy:.75,ty:.05};
  if(!narrow&&H<500&&W<1000)heroState=Object.assign(heroState,{cz:10.2,by:.05}); // phone in landscape
  if(narrow){
    // phones: fit the whole bottle into the free band between the headline and the button, whatever the screen height
    const tEl=document.querySelector('.hero-title'),mEl=document.querySelector('.hero-meta.hero-m');
    let t0=H*.36,t1=H*.8;
    if(tEl&&mEl){t0=tEl.getBoundingClientRect().bottom+scrollY+12;t1=mEl.getBoundingClientRect().top+scrollY-8;}
    const band=Math.max(140,t1-t0),k=2*Math.tan(Math.PI/12);
    const cz=clamp(3.05*H/(band*k),11.5,19),vis=k*cz,ty=-.3;
    heroState={by:ty+(.5-(t0+t1)/2/H)*vis-.22,rot:-.48,cz,cy:ty+.9,ty};
  }
  const fragState=narrow?{by:2.1,bz:-6,rot:-.6,glow:.45,bs:.9}:{bx:1.75,by:-.05,bs:.92,rot:-.55,glow:.75};
  const close=narrow?{cz:Math.max(5,1.75/(Math.tan(Math.PI/12)*2*asp)),cy:3.6,ty:1.25,by:.3,rot:Math.PI*2.42}:{cz:3.1,cy:1.02,ty:1.02};
  const bsN=narrow?{by:.35,cz:11}:{};      // phones: whole bottle clear of header and captions
  const nEnd=narrow?-9.6:-11.4;              // phones: stop before the amber fills the screen
  WP=[
    S(0,heroState),
    S(f0,fragState),
    S(Math.max(f0+1,fE),Object.assign({},fragState,{rot:fragState.rot-.5})),
    S(B0,Object.assign({rot:0,glow:.85},bsN)),
    S(B0+BL*.27,Object.assign({rot:Math.PI/2,cz:base*.96,glow:.85},bsN)),
    S(B0+BL*.54,Object.assign({rot:Math.PI*1.27,bs:1.04,glow:.85},bsN)),
    S(B0+BL*.82,Object.assign({rot:Math.PI*2,glow:.7},close)),
    S(B0+BL,Object.assign({rot:Math.PI*2.08,glow:.7},close)),
    S(N0+H*.15,{by:-4.6,bz:-2,rot:Math.PI*2.4,notes:1,cz:6,tz:-6,glow:0}),
    S(N0+NL,{by:-4.6,bz:-2,rot:Math.PI*2.4,notes:1,cz:nEnd,tz:nEnd-6,glow:0}),
    S(N0+NL+H,{by:-4.6,bz:-2,rot:Math.PI*2.4,notes:1,cz:nEnd,tz:nEnd-6,glow:0}),
    S(F0-H,{by:-2.2,rot:-1.4,glow:.4,bs:1.05}),
    S(F0,narrow?{by:-.3,rot:-.46,cz:13,cy:.9,ty:-.2,glow:1}:{by:.05,rot:-.46,cz:8.2,cy:.75,ty:0,glow:1})
  ];
  coverA=top(secColl);coverB=F0-H;
  const xf=narrow?.32:1;
  Object.values(ING).forEach(g=>{const b=g.userData.base;g.position.set(b[0]*xf,b[1],b[2]);});
}
function sample(s){
  let i=0;while(i<WP.length-2&&s>=WP[i+1].y)i++;
  const a=WP[i],b=WP[i+1];const t=ease(clamp((s-a.y)/Math.max(1,b.y-a.y)));
  const o={};K.forEach(k=>o[k]=lerp(a[k],b[k],t));return o;
}

let mx=0,my=0,smx=0,smy=0;
addEventListener('pointermove',e=>{mx=e.clientX/W*2-1;my=e.clientY/H*2-1;},{passive:true});

let sY=scrollY,t0=performance.now(),intro=RM?1:0;
const tmpV=new T.Vector3();
function frame(now){
  requestAnimationFrame(frame);
  const t=(now-t0)/1000;
  const y=scrollY;sY=RM?y:lerp(sY,y,.1);if(Math.abs(sY-y)<.3)sY=y;
  smx=lerp(smx,mx,.04);smy=lerp(smy,my,.04);
  prog.style.transform=`scaleX(${clamp(y/(document.documentElement.scrollHeight-H))})`;
  if(!RM&&intro<1)intro=Math.min(1,t/3.2);
  const ie=1-Math.pow(1-intro,3);
  R.toneMappingExposure=lerp(.08,1.05,ie);

  const pb=clamp((y-B0)/BL);
  const wins=[[-.2,.25],[.25,.52],[.52,.76],[.76,1.2]];
  callouts.forEach((c,i)=>c.style.setProperty('--o',win(pb,wins[i][0],wins[i][1],.06).toFixed(3)));
  const si=pb<.25?0:pb<.52?1:pb<.76?2:3;stepN.textContent='0'+(si+1);{const sv=window.etherT('step.'+si);if(stepV.textContent!==sv)stepV.textContent=sv;}
  const pn=clamp((y-N0)/NL);
  nTitle.style.setProperty('--o',(1-clamp((pn-.02)/.1)).toFixed(3));
  nOutro.style.setProperty('--o',clamp((pn-.9)/.08).toFixed(3));
  nTrack[0].style.setProperty('--f',clamp(pn/.42).toFixed(3));
  nTrack[1].style.setProperty('--f',clamp((pn-.42)/.2).toFixed(3));
  nTrack[2].style.setProperty('--f',clamp((pn-.62)/.38).toFixed(3));

  if(sY>coverA&&sY<coverB){Object.values(nLabels).forEach(l=>l.style.opacity=0);return;}

  const st=sample(sY);
  const heroW=1-clamp(sY/(H*.85)),finW=clamp((sY-coverB)/H);
  const standW=ease(Math.max(heroW,finW));            // 1 = standing on the ledge
  const sway=RM?0:Math.sin(t*.105)*.34*standW;          // slow turntable sway, label stays readable
  rig.position.set(st.bx,st.by,st.bz);rig.scale.setScalar(st.bs);
  bottle.rotation.y=st.rot+sway+smx*.12*standW-(1-ie)*.9;
  bottle.rotation.x=smy*.03*(1-standW);
  bottle.position.y=(RM?0:Math.sin(t*.8)*.03)*(1-standW)+(1-ie)*-.25;
  bottle.visible=st.by>-4.4;
  // ledge sinks away as the bottle starts to travel
  ledge.visible=standW>.01;ledge.position.y=-(1-standW)*3.2;
  contact.visible=standW>.5;contact.material.opacity=.95*clamp((standW-.5)*2);
  // backdrop light: breathing very slowly
  backdrop.visible=st.glow>.02;
  const breath=RM?1:1+Math.sin(t*.23)*.035;
  backdrop.material.color.setScalar(clamp(st.glow*ie*breath,0,1.2));
  backdrop.position.x=-.3+(RM?0:Math.sin(t*.06)*.35)-st.bx*.25;
  rimL.intensity=260*(RM?1:1+Math.sin(t*.31)*.08);graze.intensity=12*standW*ie;
  caustic.material.opacity=.12*ie*(RM?1:1+Math.sin(t*.4+1)*.15);
  smokes.forEach(s=>{const u=s.userData;s.position.set(u.x+Math.sin(t*u.sp+u.ph)*.5,u.y+(u.front?0:Math.sin(t*u.sp*.7+u.ph)*.12),u.z);if(!RM)s.material.rotation+=u.rs*.016;s.material.opacity=u.o*ie*(u.front?standW:st.glow);});
  if(!RM){const a=pg.attributes.position.array;for(let i=0;i<PN;i++){a[i*3+1]+=pv[i]*.0028;a[i*3]+=Math.sin(t*.25+i)*.0004;if(a[i*3+1]>4.5)a[i*3+1]=-4.5;}pg.attributes.position.needsUpdate=true;}
  notes.visible=st.notes>.01;
  if(notes.visible){Object.entries(ING).forEach(([k,g],i)=>{const b=g.userData.base;g.rotation.y=t*.12+i;g.rotation.x=Math.sin(t*.2+i)*.25;g.position.y=b[1]+Math.sin(t*.5+i*1.3)*.08;g.scale.setScalar(Math.max(.001,(narrow?.62:1)*st.notes));});}
  cam.position.set(st.cx+smx*.1*(1-standW*.5),st.cy-smy*.06,st.cz);
  cam.lookAt(st.tx,st.ty,st.tz);
  R.render(scene,cam);

  const inNotes=y>=N0-H*.2&&y<=N0+NL+H*.2&&notes.visible;
  Object.entries(ING).forEach(([k,g])=>{const l=nLabels[k];if(!inNotes){l.style.opacity=0;return;}
    g.getWorldPosition(tmpV);const d=cam.position.z-tmpV.z;tmpV.project(cam);
    let o=clamp((8.5-d)/2.5)*clamp((d-1.4)/1.4);if(k==='amber')o=clamp((8.5-d)/2.5);
    if(narrow)o*=clamp((pn-.08)/.06); // phones: labels wait until the section title has faded
    if(tmpV.z>1)o=0;
    const sx=(tmpV.x+1)/2*W,sy=(1-tmpV.y)/2*H;const left=tmpV.x>.05;
    l.style.opacity=o.toFixed(3);
    const lx=narrow?Math.max(16,Math.min(W-l.offsetWidth-16,sx-l.offsetWidth/2)):(left?sx-90-l.offsetWidth:sx+90);
    const ly=narrow?sy+(k==='amber'?-150:90):sy-30;
    l.style.transform=`translate(${lx}px,${ly}px)`;
  });
}

/* ================= collection: a small renderer per slot ================= */
const items=[...document.querySelectorAll('.item')];
const slots=items.map((it,i)=>{
  const cv=document.createElement('canvas');cv.className='slot-cv';cv.setAttribute('aria-hidden','true');it.querySelector('.slot').appendChild(cv);
  const r=makeRenderer(cv,1.75);const s=new T.Scene();s.environment=buildEnv(r);
  s.add(new T.HemisphereLight(0x3a2a1e,0x050302,.6));
  const a=new T.SpotLight(0xff8a3a,200,30,.5,.8,2);a.position.set(-4,3.5,-4.5);s.add(a);
  const b=new T.SpotLight(0xffe6c8,55,30,.55,1,2);b.position.set(2.8,5.5,6.5);s.add(b);
  const c=new T.SpotLight(0xffa860,80,30,.5,.9,2);c.position.set(4.5,2,-4);s.add(c);
  const v=[VARIANTS.noir,VARIANTS.ambre,VARIANTS.blanc][i];
  const bt=createBottle(v);s.add(bt);
  const camS=new T.PerspectiveCamera(28,.75,.1,40);camS.position.set(0,.35,8.2);camS.lookAt(0,0,0);
  const o={it,cv,r,s,bt,cam:camS,h:0,ht:0,w:0,hh:0};
  it.addEventListener('pointerenter',()=>o.ht=1);it.addEventListener('pointerleave',()=>o.ht=0);
  it.addEventListener('focusin',()=>o.ht=1);it.addEventListener('focusout',()=>o.ht=0);it.tabIndex=0;
  return o;
});
function frame2(now){
  requestAnimationFrame(frame2);
  const rc=secColl.getBoundingClientRect();
  if(rc.bottom<0||rc.top>H)return;
  const t=now/1000;
  slots.forEach((o,i)=>{
    const r=o.cv.getBoundingClientRect();if(r.bottom<0||r.top>H||r.width<2)return;
    if(r.width!==o.w||r.height!==o.hh){o.w=r.width;o.hh=r.height;o.r.setSize(r.width,r.height,false);o.cam.aspect=r.width/r.height;o.cam.updateProjectionMatrix();}
    o.h=lerp(o.h,o.ht,.06);
    o.bt.rotation.y=-.42+(RM?0:Math.sin(t*.22+i*2)*.16)+o.h*.7;
    o.bt.position.y=o.h*.1;
    o.r.render(o.s,o.cam);
  });
}

function resize(){layout();}
const sImg=document.getElementById('story-img');
addEventListener('scroll',()=>{const r=sImg.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>H)return;const p=(r.top+r.height/2-H/2)/H;sImg.style.transform=`scale(1.08) translateY(${(p*-4).toFixed(2)}%)`;},{passive:true});

const fontsReady=Promise.race([Promise.all([document.fonts.load('150px Italiana'),document.fonts.load('54px "Tenor Sans"')]),new Promise(r=>setTimeout(r,2500))]);
fontsReady.then(()=>{
  const redrawLabels=()=>[bottle,...slots.map(s=>s.bt)].forEach(b=>b.traverse(o=>{if(o.userData.isLabel){const v=o.userData.isLabel;o.material.map.dispose();o.material.map=makeLabel(v.name,v.ink);o.material.needsUpdate=true;}}));
  redrawLabels();document.addEventListener('ether:lang',redrawLabels);
  resize();addEventListener('resize',resize);setTimeout(resize,600);
  canvas.classList.add('on');
  requestAnimationFrame(()=>document.documentElement.classList.remove('pre'));
  t0=performance.now();
  requestAnimationFrame(frame);requestAnimationFrame(frame2);
});
})();
