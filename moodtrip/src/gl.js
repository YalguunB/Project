/* ============ GL: Three.js scene behind the UI (mood orb, shader backdrop, dust, satellites, feeling field) ============ */
const MOODS = {
  start:  { bg:'#F7F2EA', surface:'#FFFFFF', ink:'#2B2622', accent:'#BC5630', accentInk:'#FFFFFF', glow:'#F6C9A0', orb:['#FFD9B8','#E98A5C','#FFB98A'] },
  tide:   { bg:'#E5F1F2', surface:'#F7FCFC', ink:'#0F3039', accent:'#17798A', accentInk:'#FFFFFF', glow:'#8CD3DA', orb:['#CBF3F6','#4FA3B2','#8CD3DA'] },
  dusk:   { bg:'#231E3B', surface:'#2E2850', ink:'#F3EEFF', accent:'#B79CFF', accentInk:'#1A1433', glow:'#5A3FB8', orb:['#7B5AD6','#3A2A7A','#B79CFF'] },
  ember:  { bg:'#FBE8DA', surface:'#FFF8F2', ink:'#3A1E12', accent:'#C94A22', accentInk:'#FFFFFF', glow:'#F8B48A', orb:['#FFD6BC','#E0784E','#F8B48A'] },
  forest: { bg:'#E3EBDB', surface:'#F6FAF2', ink:'#1B2E20', accent:'#3A7740', accentInk:'#FFFFFF', glow:'#A5CC96', orb:['#D8EEC6','#6FA877','#A5CC96'] }
};

const GL = (() => {
  const api = { ok:false, hoverCb:null, pickCb:null };
  if (!window.THREE) return api;
  const canvas = document.getElementById('gl');
  try { const probe = document.createElement('canvas'); if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return api; } catch (e) { return api; }   // no WebGL: stay quiet and let the CSS fallback show
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' }); }
  catch (e) { return api; }
  if (!renderer || !renderer.getContext()) return api;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = THREE;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, .1, 100);
  camera.position.set(0, 0, 12);
  const V = { w:1, h:1, ww:1, wh:1 };                       // viewport px, world units at z=0
  const mouse = { nx:0, ny:0, ux:.5, uy:.5, wx:0, wy:0, down:false, speed:0, px:0, py:0, clientX:-999, clientY:-999 };
  const light = { value:new T.Vector3(.3, .6, .8) };
  const time = { value:0 };

  /* ---------- shared GLSL ---------- */
  const NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }`;

  /* ---------- backdrop: flowing mood gradient that ripples under the cursor ---------- */
  const bgMat = new T.ShaderMaterial({
    uniforms:{ uTime:time, uRes:{ value:new T.Vector2(1, 1) }, uBg:{ value:new T.Color() }, uGlow:{ value:new T.Color() }, uAccent:{ value:new T.Color() },
               uMouse:{ value:new T.Vector2(.5, .5) }, uOrb:{ value:new T.Vector2(.5, .5) }, uOrbR:{ value:.3 }, uEnergy:{ value:.35 }, uDark:{ value:0 } },
    vertexShader:'void main(){ gl_Position = vec4(position.xy, .999, 1.); }',
    fragmentShader: NOISE + `
    uniform float uTime,uOrbR,uEnergy,uDark; uniform vec2 uRes,uMouse,uOrb; uniform vec3 uBg,uGlow,uAccent;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=2.03; a*=.5; } return s; }
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;
      vec2 p=(uv-.5)*vec2(asp,1.);
      float t=uTime*(.05+.05*uEnergy);
      vec2 w=vec2(fbm(vec3(p*1.4,t)),fbm(vec3(p*1.4+4.2,t+3.)));
      float n=fbm(vec3(p*1.1+w*.9,t*1.3));
      vec3 col=mix(uBg,uGlow,smoothstep(-.35,.75,n)*mix(.5,.35,uDark));
      vec2 o=(uOrb-.5)*vec2(asp,1.);
      float d=length(p-o);
      col=mix(col,uGlow,exp(-d*d/(uOrbR*uOrbR*1.8+.02))*mix(.55,.4,uDark));
      vec2 m=(uMouse-.5)*vec2(asp,1.);
      float md=length(p-m);
      col+=uAccent*exp(-md*md*14.)*.07;
      float ring=sin(md*38.-uTime*2.)*exp(-md*5.);
      col+=uAccent*ring*.012;
      col+=(hash(gl_FragCoord.xy+fract(uTime))-.5)*.022;
      gl_FragColor=vec4(col,1.);
    }`,
    depthTest:false, depthWrite:false
  });
  const bg = new T.Mesh(new T.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  /* ---------- the orb ---------- */
  const orbU = {
    uTime:time, uAmp:{ value:.17 }, uFreq:{ value:1 }, uSpeed:{ value:.3 }, uRidge:{ value:0 }, uPulse:{ value:.03 }, uPulseRate:{ value:1.7 }, uSharp:{ value:1 },
    uRipple:{ value:0 }, uPoke:{ value:0 }, uPokeDir:{ value:new T.Vector3(0, 0, 1) }, uLight:light, uGloss:{ value:.8 },
    uColA:{ value:new T.Color() }, uColB:{ value:new T.Color() }, uColC:{ value:new T.Color() }
  };
  const orbMat = new T.ShaderMaterial({
    uniforms:orbU,
    vertexShader: NOISE + `
    uniform float uTime,uAmp,uFreq,uSpeed,uRidge,uPulse,uPulseRate,uSharp,uRipple,uPoke; uniform vec3 uPokeDir;
    varying vec3 vN; varying vec3 vV; varying float vD;
    vec3 disp(vec3 p){
      float t=uTime*uSpeed;
      float n=snoise(p*uFreq+vec3(0.,t,t*.5));
      n=mix(n,1.-abs(n)*2.,uRidge);
      float d=n*uAmp;
      d+=uRipple*snoise(p*6.+vec3(t*3.))*.045;
      d+=uPulse*pow(.5+.5*sin(uTime*uPulseRate+p.y*1.5),uSharp);
      d+=uPoke*smoothstep(.15,1.,dot(p,uPokeDir));
      return p*(1.+d);
    }
    void main(){
      vec3 p=normalize(position);
      vec3 dp=disp(p);
      vec3 h=abs(p.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.);
      vec3 tg=normalize(cross(p,h)); vec3 bt=cross(p,tg);
      float e=.03;
      vec3 p1=disp(normalize(p+tg*e)); vec3 p2=disp(normalize(p+bt*e));
      vec3 nn=normalize(cross(p1-dp,p2-dp)); if(dot(nn,p)<0.) nn=-nn;
      vN=normalize(normalMatrix*nn);
      vec4 mv=modelViewMatrix*vec4(dp,1.);
      vV=-mv.xyz; vD=length(dp)-1.;
      gl_Position=projectionMatrix*mv;
    }`,
    fragmentShader:`
    uniform vec3 uColA,uColB,uColC,uLight; uniform float uGloss,uTime;
    varying vec3 vN; varying vec3 vV; varying float vD;
    void main(){
      vec3 N=normalize(vN); vec3 V=normalize(vV); vec3 L=normalize(uLight);
      float ndl=dot(N,L); float dif=smoothstep(-.55,1.,ndl);
      vec3 col=mix(uColB,uColA,dif*.88);
      float fres=pow(1.-max(dot(N,V),0.),3.);
      vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+N.y*.45+N.x*.3+uTime*.03));
      col=mix(col,col*(.8+.4*irid),.2);
      vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),150.)*uGloss;
      float sheen=pow(max(dot(N,H),0.),14.)*.16*uGloss;
      col+=uColC*fres*.5;
      col+=uColC*pow(max(dot(N,-L),0.),2.)*.14;
      col+=vec3(1.)*(spec*.75+sheen);
      col+=vD*.22*uColC;
      gl_FragColor=vec4(col,1.);
    }`
  });
  const orb = new T.Mesh(new T.IcosahedronGeometry(1, 32), orbMat);
  orb.frustumCulled = false; scene.add(orb);

  /* ---------- small glossy bodies (bag satellites + field orbs) ---------- */
  const satVert = `varying vec3 vN; varying vec3 vV;
    void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`;
  const satFrag = `uniform vec3 uA,uB,uC,uLight; uniform float uHot; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N=normalize(vN); vec3 V=normalize(vV); vec3 L=normalize(uLight);
      float dif=smoothstep(-.4,.9,dot(N,L));
      vec3 col=mix(uB,uA,dif);
      float fres=pow(1.-max(dot(N,V),0.),2.4);
      vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),60.);
      col+=uC*fres*.75+vec3(1.)*spec*.8;
      col=mix(col,col*1.18+uC*.1,uHot);
      gl_FragColor=vec4(col,1.);
    }`;
  const satMaterial = cols => new T.ShaderMaterial({
    uniforms:{ uA:{ value:new T.Color(cols[0]) }, uB:{ value:new T.Color(cols[1]) }, uC:{ value:new T.Color(cols[2]) }, uLight:light, uHot:{ value:0 } },
    vertexShader:satVert, fragmentShader:satFrag
  });
  const bagMat = satMaterial(MOODS.start.orb);
  const SAT_GEO = {
    journal:new T.BoxGeometry(.8, 1, .24), swim:new T.TorusGeometry(.4, .17, 18, 36), paperback:new T.BoxGeometry(.72, .96, .32),
    camera:new T.CylinderGeometry(.44, .44, .38, 30), shoes:new T.ConeGeometry(.46, .92, 26), phones:new T.TorusKnotGeometry(.3, .1, 70, 10),
    sketch:new T.CylinderGeometry(.17, .17, 1.15, 18), party:new T.OctahedronGeometry(.54)
  };
  const sats = [];
  const bagGroup = new T.Group(); scene.add(bagGroup);

  /* ---------- dust ---------- */
  const DUST = REDUCED ? 140 : 420;
  const dGeo = new T.BufferGeometry();
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST * 4);
  for (let i = 0; i < DUST; i++){
    dPos[i*3] = Math.random()*2 - 1; dPos[i*3+1] = Math.random()*2 - 1; dPos[i*3+2] = Math.random()*2 - 1;
    for (let k = 0; k < 4; k++) dSeed[i*4+k] = Math.random();
  }
  dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aSeed', new T.BufferAttribute(dSeed, 4));
  const dustMat = new T.ShaderMaterial({
    uniforms:{ uTime:time, uView:{ value:new T.Vector2(1, 1) }, uPointer:{ value:new T.Vector2(99, 99) }, uColor:{ value:new T.Color() }, uDpr:{ value:1 } },
    vertexShader:`attribute vec4 aSeed; uniform float uTime,uDpr; uniform vec2 uView,uPointer; varying float vA;
      void main(){
        vec3 p=position;
        p.x+=sin(uTime*.12*(.4+aSeed.x)+aSeed.y*6.28)*.05;
        p.y=mod(p.y+1.+uTime*.006*(.3+aSeed.z)*2.,2.)-1.;
        vec2 w=p.xy*uView;
        vec2 d=w-uPointer; float f=exp(-dot(d,d)*.9);
        w+=normalize(d+vec2(1e-4))*f*.9;
        vec4 mv=viewMatrix*vec4(w,p.z*1.5,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=(1.5+aSeed.w*4.5)*uDpr*(8./-mv.z);
        vA=.25+.45*aSeed.w;
      }`,
    fragmentShader:`uniform vec3 uColor; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.15,d)*vA; if(a<.01) discard; gl_FragColor=vec4(uColor,a); }`,
    transparent:true, depthWrite:false, depthTest:false
  });
  const dust = new T.Points(dGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = -5; scene.add(dust);

  /* ---------- feeling field ---------- */
  const fieldGroup = new T.Group(); fieldGroup.visible = false; scene.add(fieldGroup);
  const fieldGeo = new T.SphereGeometry(1, 30, 22);
  const ringGeo = new T.RingGeometry(1.22, 1.3, 48);
  let fieldOrbs = [], fieldOn = false, hoverIdx = -1, fieldR = .4;
  const raycaster = new T.Raycaster();

  /* ---------- state that eases toward targets ---------- */
  const cur = { bg:new T.Color(MOODS.start.bg), glow:new T.Color(MOODS.start.glow), accent:new T.Color(MOODS.start.accent), A:new T.Color(MOODS.start.orb[0]), B:new T.Color(MOODS.start.orb[1]), C:new T.Color(MOODS.start.orb[2]), dark:0 };
  const tgt = { bg:new T.Color(MOODS.start.bg), glow:new T.Color(MOODS.start.glow), accent:new T.Color(MOODS.start.accent), A:new T.Color(MOODS.start.orb[0]), B:new T.Color(MOODS.start.orb[1]), C:new T.Color(MOODS.start.orb[2]), dark:0 };
  const P = { amp:.17, freq:1, speed:.3, ridge:0, pulse:.03, rate:1.7, sharp:1, ripple:0, gloss:.8 };
  const PT = { ...P };
  const anchor = { x:.7, y:.47, s:.8 };
  const orbS = { x:0, y:0, s:0, tx:0, ty:0, ts:0, rotX:0, rotY:0, poke:0, pokeT:0, kick:0, vis:1 };
  const perf = { t:0, n:0, q:1.75 };
  let bagIds = [], energy = .35, scrollY = 0, activeUntil = 0, hidden = false;

  const WIN_FX = { sea:{ freq:1, amp:.17, speed:.32, ridge:0 }, mountain:{ freq:1.5, amp:.27, speed:.1, ridge:.95 }, city:{ freq:2.1, amp:.15, speed:.85, ridge:.3 }, forest:{ freq:1.3, amp:.2, speed:.2, ridge:.4 } };
  const SOUND_FX = { lofi:{ pulse:.035, rate:1.7, sharp:1, ripple:0 }, brass:{ pulse:.1, rate:4.4, sharp:5, ripple:0 }, rain:{ pulse:.012, rate:2.2, sharp:1, ripple:1 }, synth:{ pulse:.06, rate:2.9, sharp:2, ripple:0 } };
  const FEEL_FX = { rested:{ amp:.8, speed:.75, gloss:.5 }, inspired:{ amp:1.1, speed:1.1, gloss:1.3 }, free:{ amp:1, speed:1.4, gloss:.9 }, close:{ amp:.9, speed:.8, gloss:.7 },
                    alive:{ amp:1.25, speed:1.5, gloss:1.1 }, lighter:{ amp:.75, speed:1.1, gloss:1 }, curious:{ amp:1, speed:1, freq:1.35, gloss:.9 }, proud:{ amp:1.05, speed:.9, gloss:1.1, scale:1.1 } };
  let feelScale = 1;

  function resize(){
    const w = innerWidth, h = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    V.w = w; V.h = h; V.wh = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.position.z; V.ww = V.wh * camera.aspect;
    bgMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    dustMat.uniforms.uView.value.set(V.ww / 2, V.wh / 2); dustMat.uniforms.uDpr.value = dpr;
    layoutField();
    api.invalidate();
  }

  /* ---------- public API ---------- */
  api.ok = true;
  api.invalidate = () => { activeUntil = performance.now() + 2600; };
  api.setMood = (name, instant) => {
    const m = MOODS[name] || MOODS.start;
    tgt.bg.set(m.bg); tgt.glow.set(m.glow); tgt.accent.set(m.accent); tgt.A.set(m.orb[0]); tgt.B.set(m.orb[1]); tgt.C.set(m.orb[2]); tgt.dark = name === 'dusk' ? 1 : 0;
    dustMat.uniforms.uColor.value.set(m.accent);
    bagMat.uniforms.uA.value.set(m.orb[0]); bagMat.uniforms.uB.value.set(m.orb[1]); bagMat.uniforms.uC.value.set(m.orb[2]);
    if (instant || REDUCED){ cur.bg.copy(tgt.bg); cur.glow.copy(tgt.glow); cur.accent.copy(tgt.accent); cur.A.copy(tgt.A); cur.B.copy(tgt.B); cur.C.copy(tgt.C); cur.dark = tgt.dark; }
    api.invalidate();
  };
  api.setAnchor = a => { anchor.x = a.x; anchor.y = a.y; anchor.s = a.s; api.invalidate(); };
  api.setTraits = t => {
    const w = WIN_FX[t.window] || WIN_FX.sea, s = SOUND_FX[t.sound] || SOUND_FX.lofi, f = FEEL_FX[t.feel] || FEEL_FX.rested;
    energy = t.energy / 100;
    PT.freq = w.freq * (f.freq || 1);
    PT.amp = w.amp * f.amp * (.55 + .9 * energy);
    PT.speed = w.speed * f.speed * (.4 + 1.6 * energy);
    PT.ridge = w.ridge;
    PT.pulse = s.pulse * (.6 + .8 * energy); PT.rate = s.rate; PT.sharp = s.sharp; PT.ripple = s.ripple;
    PT.gloss = f.gloss || .8; feelScale = f.scale || 1;
    bgMat.uniforms.uEnergy.value = energy;
    api.invalidate();
  };
  api.kick = (n = 1) => { orbS.kick = Math.min(1.4, orbS.kick + .5 * n); api.invalidate(); };
  api.setOrbVisible = v => { orbS.vis = v ? 1 : 0; api.invalidate(); };

  api.setBag = ids => {
    bagIds = ids.slice();
    sats.forEach(s => { s.dying = !ids.includes(s.id); });
    ids.forEach(id => {
      if (sats.find(s => s.id === id && !s.dying)) return;
      const mesh = new T.Mesh(SAT_GEO[id], bagMat); mesh.frustumCulled = false; bagGroup.add(mesh);
      sats.push({ id, mesh, pos:new T.Vector3(orbS.x, orbS.y, 0), vel:new T.Vector3((Math.random() - .5) * 4, 3 + Math.random() * 2, 2), sc:0, ang:Math.random() * 6.28, spd:.35 + Math.random() * .25, ph:Math.random() * 6.28, dying:false });
    });
    api.invalidate();
  };

  function layoutField(){
    const N = fieldOrbs.length; if (!N) return;
    const wide = V.w > 860;                        // wide screens keep the field right of the text column
    const ax = V.ww * (wide ? .3 : .42), ay = V.wh * (wide ? .3 : .2), cx = wide ? V.ww * .15 : 0, cy = wide ? -V.wh * .06 : -V.wh * .02;
    fieldR = Math.max(.15, Math.min(.62, Math.sqrt(.5 * ax * ay / N)));
    fieldOrbs.forEach((o, i) => {
      const r = Math.sqrt((i + .5) / N), th = i * 2.39996;
      o.home.set(cx + Math.cos(th) * r * ax, cy + Math.sin(th) * r * ay);
      o.r = fieldR * (o.mine ? 1.18 : 1);
    });
  }
  api.setField = list => {
    const keep = new Map(fieldOrbs.map(o => [o.data.id, o]));
    const next = [];
    list.forEach(d => {
      let o = keep.get(d.id);
      if (o){ keep.delete(d.id); o.data = d; }
      else {
        const m = MOODS[d.mood] || MOODS.tide, mat = satMaterial(m.orb), mesh = new T.Mesh(fieldGeo, mat);
        mesh.frustumCulled = false; fieldGroup.add(mesh);
        o = { data:d, mesh, mat, pos:new T.Vector2((Math.random() - .5) * V.ww * .3, (Math.random() - .5) * V.wh * .3), vel:new T.Vector2(), home:new T.Vector2(), sc:0, r:fieldR, ph:Math.random() * 6.28, hot:0, mine:false };
        o.mesh.userData.o = o;
      }
      o.mine = !!d.mine;
      if (o.mine && !o.ring){ o.ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color:MOODS[d.mood] ? MOODS[d.mood].accent : '#ffffff', side:T.DoubleSide, transparent:true, opacity:.9 })); o.mesh.add(o.ring); }
      if (!o.mine && o.ring){ o.mesh.remove(o.ring); o.ring = null; }
      next.push(o);
    });
    keep.forEach(o => { fieldGroup.remove(o.mesh); o.mat.dispose(); });
    fieldOrbs = next; hoverIdx = -1; layoutField(); api.invalidate();
  };
  api.setFieldMode = on => { fieldOn = on; fieldGroup.visible = on; if (!on){ hoverIdx = -1; if (api.hoverCb) api.hoverCb(null); } api.invalidate(); };

  /* ---------- pointer ---------- */
  addEventListener('pointermove', e => {
    mouse.clientX = e.clientX; mouse.clientY = e.clientY;
    mouse.ux = e.clientX / V.w; mouse.uy = 1 - e.clientY / V.h;
    mouse.nx = mouse.ux * 2 - 1; mouse.ny = mouse.uy * 2 - 1;
    mouse.wx = mouse.nx * V.ww / 2; mouse.wy = mouse.ny * V.wh / 2;
    api.invalidate();
  }, { passive:true });
  let pickNext = false;
  addEventListener('pointerdown', e => {
    mouse.down = true; mouse.clientX = e.clientX; mouse.clientY = e.clientY;
    mouse.ux = e.clientX / V.w; mouse.uy = 1 - e.clientY / V.h; mouse.nx = mouse.ux * 2 - 1; mouse.ny = mouse.uy * 2 - 1;
    mouse.wx = mouse.nx * V.ww / 2; mouse.wy = mouse.ny * V.wh / 2;
    if (!e.target.closest('button,a,input,label,textarea,.battery,.panel,.sheet')) api.kick(.6);
    if (fieldOn && api.pickCb && !e.target.closest('button,a,input,label,.detail')){
      if (e.pointerType === 'mouse'){ if (hoverIdx >= 0) api.pickCb(fieldOrbs[hoverIdx].data); } else pickNext = true;   // touch: hover is resolved on the next frame
    }
    api.invalidate();
  });
  addEventListener('pointerup', e => {
    mouse.down = false;
    if (e.pointerType !== 'mouse') setTimeout(() => { mouse.nx = mouse.ny = -5; mouse.wx = mouse.wy = -99; api.invalidate(); }, 900);
  });
  addEventListener('scroll', () => { scrollY = window.scrollY; api.invalidate(); }, { passive:true });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  addEventListener('resize', resize);

  /* ---------- frame ---------- */
  const tmpV = new T.Vector3(), ray = new T.Vector2();
  let last = performance.now();
  function ease(dt, k){ return 1 - Math.exp(-dt * k); }

  function frame(now){
    requestAnimationFrame(frame);
    if (hidden) return;
    const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now;
    if (REDUCED && now > activeUntil) return;
    if (raw < .25){                                   // adaptive quality: slow machines render fewer pixels
      perf.t += raw; perf.n++;
      if (perf.n >= 90){ const avg = perf.t / perf.n; perf.t = 0; perf.n = 0; if (avg > .036 && perf.q > .8){ perf.q = Math.max(.75, perf.q - .3); resize(); } }
    }
    time.value += REDUCED ? 0 : dt;

    /* colors */
    const kc = REDUCED ? 1 : ease(dt, 2.6);
    cur.bg.lerp(tgt.bg, kc); cur.glow.lerp(tgt.glow, kc); cur.accent.lerp(tgt.accent, kc); cur.A.lerp(tgt.A, kc); cur.B.lerp(tgt.B, kc); cur.C.lerp(tgt.C, kc);
    cur.dark += (tgt.dark - cur.dark) * kc;
    bgMat.uniforms.uBg.value.copy(cur.bg); bgMat.uniforms.uGlow.value.copy(cur.glow); bgMat.uniforms.uAccent.value.copy(cur.accent); bgMat.uniforms.uDark.value = cur.dark;
    orbU.uColA.value.copy(cur.A); orbU.uColB.value.copy(cur.B); orbU.uColC.value.copy(cur.C);

    /* light follows the cursor */
    light.value.lerp(tmpV.set(mouse.nx * 1.3, mouse.ny * 1.1 + .35, .9), ease(dt, 4));
    bgMat.uniforms.uMouse.value.lerp(ray.set(mouse.ux, mouse.uy), ease(dt, 5));
    dustMat.uniforms.uPointer.value.set(mouse.wx, mouse.wy);

    /* orb params */
    const kp = REDUCED ? 1 : ease(dt, 2.2);
    for (const k in P) P[k] += (PT[k] - P[k]) * kp;
    orbU.uAmp.value = P.amp; orbU.uFreq.value = P.freq; orbU.uSpeed.value = P.speed; orbU.uRidge.value = P.ridge;
    orbU.uPulse.value = P.pulse; orbU.uPulseRate.value = P.rate; orbU.uSharp.value = P.sharp; orbU.uRipple.value = P.ripple; orbU.uGloss.value = P.gloss;

    /* orb placement (anchor -> world), spring-eased */
    const vmin = Math.min(V.ww, V.wh), px = V.wh / V.h;
    orbS.tx = (anchor.x - .5) * V.ww + mouse.nx * .22;
    orbS.ty = (.5 - anchor.y) * V.wh + scrollY * px * .45 + mouse.ny * .16;
    orbS.ts = anchor.s * vmin * .5 * (1 + (energy - .35) * .3) * feelScale * orbS.vis;
    const ko = REDUCED ? 1 : ease(dt, 3.2);
    orbS.x += (orbS.tx - orbS.x) * ko; orbS.y += (orbS.ty - orbS.y) * ko; orbS.s += (orbS.ts - orbS.s) * ease(dt, REDUCED ? 30 : 2.4);
    orbS.kick *= Math.exp(-dt * 2.8);
    const sq = 1 + orbS.kick * .12 * Math.sin(time.value * 22);
    orb.position.set(orbS.x, orbS.y, 0); orb.scale.setScalar(Math.max(.0001, orbS.s * sq));
    orb.visible = orbS.s > .004;
    orbS.rotY += ((mouse.nx * .6) - orbS.rotY) * ease(dt, 2); orbS.rotX += ((-mouse.ny * .4) - orbS.rotX) * ease(dt, 2);
    orb.rotation.set(orbS.rotX + time.value * .03, orbS.rotY + time.value * .05, 0);
    const sx = .5 + orbS.x / V.ww, sy = .5 + orbS.y / V.wh;
    bgMat.uniforms.uOrb.value.set(sx, sy); bgMat.uniforms.uOrbR.value = orbS.s / V.wh;

    /* poke: the orb bulges toward the cursor when the cursor is over it */
    if (orb.visible && !fieldOn){
      ray.set(mouse.nx, mouse.ny); raycaster.setFromCamera(ray, camera);
      const hit = raycaster.ray.intersectSphere(hitSphere.set(orb.position, orbS.s * 1.02), tmpH);
      if (hit){ tmpV.copy(hit); orb.worldToLocal(tmpV).normalize(); orbU.uPokeDir.value.lerp(tmpV, ease(dt, 10)); orbS.pokeT = mouse.down ? .3 : .13; }
      else orbS.pokeT = 0;
    } else orbS.pokeT = 0;
    orbS.poke += (orbS.pokeT + orbS.kick * .18 - orbS.poke) * ease(dt, 7);
    orbU.uPoke.value = orbS.poke;

    /* bag satellites: springs around the orb, pushed by the cursor */
    for (let i = sats.length - 1; i >= 0; i--){
      const s = sats[i], n = sats.length;
      const R = Math.max(.8, orbS.s * 1.32) + (n > 1 ? 0 : .1), a = s.ang + time.value * s.spd + (i / Math.max(1, n)) * 6.28;
      tmpV.set(orbS.x + Math.cos(a) * R, orbS.y + Math.sin(a) * R * .55 + Math.sin(time.value * .8 + s.ph) * .12, Math.sin(a) * R * .8);
      const ax = (tmpV.x - s.pos.x) * 14, ay = (tmpV.y - s.pos.y) * 14, az = (tmpV.z - s.pos.z) * 14;
      const dx = s.pos.x - mouse.wx, dy = s.pos.y - mouse.wy, d2 = dx * dx + dy * dy, push = Math.exp(-d2 / .9) * 46;
      const dl = Math.sqrt(d2) + 1e-4;
      s.vel.x += (ax + dx / dl * push) * dt; s.vel.y += (ay + dy / dl * push) * dt; s.vel.z += az * dt;
      const damp = Math.exp(-dt * 4.6); s.vel.multiplyScalar(damp);
      s.pos.addScaledVector(s.vel, dt);
      const want = s.dying ? 0 : Math.min(vmin * .075, .6);
      s.sc += (want - s.sc) * ease(dt, s.dying ? 7 : 5);
      s.mesh.position.copy(s.pos); s.mesh.scale.setScalar(Math.max(.0001, s.sc));
      s.mesh.rotation.x += dt * (.6 + s.vel.length() * .3); s.mesh.rotation.y += dt * (.8 + s.vel.length() * .3);
      if (s.dying && s.sc < .01){ bagGroup.remove(s.mesh); sats.splice(i, 1); }
    }

    /* feeling field */
    if (fieldOn){
      const N = fieldOrbs.length;
      ray.set(mouse.nx, mouse.ny); raycaster.setFromCamera(ray, camera);
      const hits = raycaster.intersectObjects(fieldOrbs.map(o => o.mesh), false);
      const nh = hits.length ? fieldOrbs.indexOf(hits[0].object.userData.o) : -1;
      if (nh !== hoverIdx){ hoverIdx = nh; if (api.hoverCb) api.hoverCb(nh >= 0 ? fieldOrbs[nh].data : null); }
      if (pickNext){ pickNext = false; if (hoverIdx >= 0 && api.pickCb) api.pickCb(fieldOrbs[hoverIdx].data); }
      for (let i = 0; i < N; i++){
        const o = fieldOrbs[i];
        const wx = o.home.x + Math.sin(time.value * .35 + o.ph) * .35, wy = o.home.y + Math.cos(time.value * .3 + o.ph * 1.3) * .3;
        let fx = (wx - o.pos.x) * 5, fy = (wy - o.pos.y) * 5;
        const dx = o.pos.x - mouse.wx, dy = o.pos.y - mouse.wy, dd = Math.sqrt(dx * dx + dy * dy) + 1e-4, R = o.r + .55, inner = o.r * 1.05;
        if (i !== hoverIdx && dd > inner && dd < R){ const f = (R - dd) / (R - inner); fx += dx / dd * f * f * 9; fy += dy / dd * f * f * 9; }   // a nudge, never a flee: orbs stay hoverable
        for (let j = i + 1; j < N; j++){
          const q = fieldOrbs[j], ex = o.pos.x - q.pos.x, ey = o.pos.y - q.pos.y, de = Math.sqrt(ex * ex + ey * ey) + 1e-4, min = (o.r + q.r) * 1.04;
          if (de < min){ const f = (min - de) * 40; const nx = ex / de, ny = ey / de; fx += nx * f; fy += ny * f; q.vel.x -= nx * f * dt; q.vel.y -= ny * f * dt; }
        }
        o.vel.x += fx * dt; o.vel.y += fy * dt; o.vel.multiplyScalar(Math.exp(-dt * 3.6));
        o.pos.x += o.vel.x * dt; o.pos.y += o.vel.y * dt;
        o.hot += ((i === hoverIdx ? 1 : 0) - o.hot) * ease(dt, 10);
        o.sc += (o.r * (1 + o.hot * .18) - o.sc) * ease(dt, 4);
        o.mesh.position.set(o.pos.x, o.pos.y, o.hot * .6); o.mesh.scale.setScalar(Math.max(.0001, o.sc));
        o.mesh.rotation.y += dt * .3; o.mat.uniforms.uHot.value = o.hot;
        if (o.ring){ o.ring.quaternion.copy(camera.quaternion); o.ring.quaternion.premultiply(tmpQ.copy(o.mesh.quaternion).invert()); }
      }
      if (hoverIdx >= 0 && api.hoverCb){
        const o = fieldOrbs[hoverIdx]; tmpV.set(o.pos.x, o.pos.y, 0).project(camera);
        api.hoverCb(o.data, (tmpV.x * .5 + .5) * V.w, (-tmpV.y * .5 + .5) * V.h, o);
      }
    }
    renderer.render(scene, camera);
  }
  const tmpQ = new T.Quaternion(), hitSphere = new T.Sphere(), tmpH = new T.Vector3();

  resize();
  api.setMood('start', true);
  api.setTraits({ window:'sea', energy:35, sound:'lofi', feel:'rested' });
  orbS.x = orbS.tx = (anchor.x - .5) * V.ww; orbS.y = orbS.ty = (.5 - anchor.y) * V.wh;
  requestAnimationFrame(frame);
  return api;
})();
