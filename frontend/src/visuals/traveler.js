"use strict";
/* ============ TRAVELER: the floating explorer that stands in for the old mood orb ============
   Built from simple shapes (no model file to download): a little aviator in a leather helmet and goggles, a backpack with a
   bedroll, a scarf that trails behind, mittens and boots. It floats where the orb was and reads the same state:
   - colors: suit = the mood's light tone, helmet and backpack = its mid tone, bedroll = its glow, scarf = the accent
   - energy and the chosen sound set how fast it bobs and paddles; "kick" (every answer in the game) makes it wave
   - it turns its head toward the pointer; on touch screens it looks around by itself
   The material is a soft "clay" shader: wrapped light, warm shadows, a gentle rim, almost no shine. */
function buildTraveler(T, light){
  const vert = `varying vec3 vN; varying vec3 vV;
    void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`;
  const frag = `uniform vec3 uCol,uRim,uLight; uniform float uGloss;
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N=normalize(vN); vec3 V=normalize(vV); vec3 L=normalize(uLight);
      float w=dot(N,L)*.5+.5;
      float dif=smoothstep(.08,.95,w);
      vec3 col=uCol*mix(.58,1.04,dif);
      col=mix(col,col*vec3(1.,.86,.78),(1.-dif)*.4);            // warm, earthy shadows
      float fres=pow(1.-max(dot(N,V),0.),2.6);
      vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),36.)*uGloss;
      col+=uRim*fres*.32+vec3(1.)*spec*.22;
      gl_FragColor=vec4(col,1.);
    }`;
  const rim = { value:new T.Color('#E2B47E') };
  const mats = [];
  const clay = (c, gloss = .35) => { const m = new T.ShaderMaterial({ uniforms:{ uCol:{ value:new T.Color(c) }, uRim:rim, uLight:light, uGloss:{ value:gloss } }, vertexShader:vert, fragmentShader:frag }); mats.push(m); return m; };
  const M = {
    suit:clay('#EBCB9F'), suitShade:clay('#D9B486'), leather:clay('#A9653A'), pack:clay('#8E5634'), roll:clay('#D6A46C'),
    scarf:clay('#A3502C'), skin:clay('#E7B48D', .2), cheek:clay('#E39A7E', .1), ink:clay('#2F261D', .6), lens:clay('#3E5A57', 1.6),
    brass:clay('#C9A15E', 1.2), boot:clay('#4A3426', .5), white:clay('#FBF7EF', .2)
  };
  const SPH = new T.SphereGeometry(1, 36, 26), SPH_LO = new T.SphereGeometry(1, 20, 14);
  const blob = (mat, sx, sy, sz, x = 0, y = 0, z = 0, parent, geo = SPH) => {
    const m = new T.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.frustumCulled = false; (parent || root).add(m); return m;
  };
  const piv = (x, y, z, parent) => { const g = new T.Group(); g.position.set(x, y, z); (parent || root).add(g); return g; };

  const root = new T.Group();            // placed and scaled like the orb
  const body = piv(0, -.12, 0);          // everything that bobs and leans
  /* torso: a soft pear in the suit color, a belt, a chest pocket */
  blob(M.suit, .5, .56, .44, 0, 0, 0, body);
  blob(M.suitShade, .51, .09, .45, 0, -.18, 0, body);
  blob(M.brass, .07, .06, .03, 0, -.18, .45, body);
  blob(M.suitShade, .14, .12, .05, -.2, .16, .38, body);
  /* backpack with a bedroll on top */
  blob(M.pack, .4, .44, .22, 0, .04, -.42, body);
  blob(M.leather, .3, .14, .08, 0, -.16, -.6, body);
  const roll = new T.Mesh(new T.CylinderGeometry(.14, .14, .78, 24), M.roll); roll.rotation.z = Math.PI / 2; roll.position.set(0, .5, -.42); body.add(roll);
  blob(M.leather, .15, .15, .02, -.2, .5, -.42, body).rotation.y = Math.PI / 2;
  blob(M.leather, .15, .15, .02, .2, .5, -.42, body).rotation.y = Math.PI / 2;
  /* straps over the shoulders */
  [-1, 1].forEach(s => { const st = blob(M.leather, .07, .2, .05, s * .25, .3, .27, body); st.rotation.z = s * .15; st.rotation.x = -.5; });

  /* scarf: a ring around the neck and a tail that trails and waves */
  const neck = piv(0, .46, 0, body);
  blob(M.scarf, .4, .13, .36, 0, 0, 0, neck);
  const tail = [];
  for (let i = 0; i < 5; i++) tail.push(blob(M.scarf, .1 - i * .01, .075 - i * .006, .035, 0, 0, 0, neck, SPH_LO));

  /* head: face, cheeks, eyes, then the leather aviator helmet, ear flaps and goggles up on the forehead */
  const head = piv(0, .78, 0, body);
  blob(M.skin, .44, .42, .42, 0, 0, 0, head);
  blob(M.cheek, .08, .05, .03, -.24, -.1, .35, head); blob(M.cheek, .08, .05, .03, .24, -.1, .35, head);
  const eyes = [blob(M.ink, .05, .075, .03, -.13, -.01, .4, head), blob(M.ink, .05, .075, .03, .13, -.01, .4, head)];
  blob(M.white, .016, .02, .01, -.115, .02, .43, head); blob(M.white, .016, .02, .01, .145, .02, .43, head);
  blob(M.ink, .05, .018, .02, 0, -.17, .39, head);                                  // a small smile line
  const helmet = new T.Mesh(new T.SphereGeometry(1, 36, 22, 0, Math.PI * 2, 0, Math.PI * .5), M.leather);
  helmet.scale.set(.475, .475, .475); helmet.position.set(0, .01, -.02); helmet.rotation.x = -.42; head.add(helmet);   // front edge above the eyes, back covers the nape
  blob(M.leather, .1, .2, .14, -.42, -.12, -.03, head); blob(M.leather, .1, .2, .14, .42, -.12, -.03, head);
  const strap = new T.Mesh(new T.TorusGeometry(.47, .03, 10, 48), M.pack); strap.rotation.x = Math.PI / 2 - .5; strap.position.y = .13; head.add(strap);
  [-1, 1].forEach(s => {
    const ring = new T.Mesh(new T.TorusGeometry(.105, .032, 14, 32), M.brass); ring.position.set(s * .145, .3, .38); ring.rotation.x = -.62; head.add(ring);
    const lens = blob(M.lens, .09, .09, .035, s * .145, .3, .38, head); lens.rotation.x = -.62;
  });

  /* arms (pivot at the shoulder) with mittens, legs (pivot at the hip) with boots */
  const arm = s => { const p = piv(s * .46, .22, 0, body); blob(M.suit, .13, .3, .13, s * .06, -.24, 0, p); blob(M.leather, .13, .12, .12, s * .1, -.52, .02, p); return p; };
  const leg = s => { const p = piv(s * .2, -.45, 0, body); blob(M.suitShade, .15, .24, .15, 0, -.18, 0, p); blob(M.boot, .16, .12, .22, 0, -.42, .05, p); return p; };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);

  root.rotation.y = -.22;                   // a slight three-quarter view, turned toward the page
  const look = { x:0, y:0, tx:0, ty:0, idle:0 };
  let wave = 0, blink = 0, nextBlink = 2;

  return {
    group:root,
    setColors(A, B, C, accent){
      M.suit.uniforms.uCol.value.copy(A); M.suitShade.uniforms.uCol.value.copy(A).multiplyScalar(.9);
      M.leather.uniforms.uCol.value.copy(B); M.pack.uniforms.uCol.value.copy(B).multiplyScalar(.82);
      M.roll.uniforms.uCol.value.copy(C); M.scarf.uniforms.uCol.value.copy(accent); rim.value.copy(C);
    },
    /* pointer in -1..1 screen units relative to the traveler; null = no pointer (touch, or it left the window) */
    lookAt(dx, dy){ if (dx === null){ look.idle = 1; return; } look.idle = 0; look.tx = Math.max(-1, Math.min(1, dx)); look.ty = Math.max(-1, Math.min(1, dy)); },
    wave(){ wave = 1; },
    /* t: scene time, dt: seconds, speed: how lively (energy and sound), still: reduced motion */
    update(t, dt, speed, still){
      const s = still ? 0 : 1, k = 1 - Math.exp(-dt * 4);
      if (look.idle){ look.tx = Math.sin(t * .4) * .6; look.ty = Math.sin(t * .27) * .25; }
      look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;
      const sp = .7 + speed * 1.6;
      body.position.y = -.12 + Math.sin(t * 1.1 * sp) * .06 * s;
      body.rotation.z = Math.sin(t * .7 * sp) * .05 * s;
      body.rotation.x = .06 + Math.sin(t * .9 * sp + 1) * .04 * s;
      body.rotation.y = look.x * .15;
      head.rotation.y = look.x * .38; head.rotation.x = -look.y * .22; head.rotation.z = -look.x * .05;
      /* arms paddle the air; a wave lifts the right arm high */
      wave *= Math.exp(-dt * 1.6);
      armL.rotation.z = -.35 - Math.sin(t * 1.4 * sp) * .18 * s; armL.rotation.x = Math.sin(t * 1.4 * sp + 1) * .25 * s;
      armR.rotation.z = .35 + Math.sin(t * 1.4 * sp + 2) * .18 * s + wave * 2.1; armR.rotation.x = Math.sin(t * 1.4 * sp + 3) * .25 * s - wave * .3;
      armR.rotation.y = wave * Math.sin(t * 14) * .5;
      /* legs drift and kick slowly, like treading water */
      legL.rotation.x = Math.sin(t * 1.2 * sp) * .32 * s; legR.rotation.x = Math.sin(t * 1.2 * sp + Math.PI) * .32 * s;
      legL.rotation.z = -.08; legR.rotation.z = .08;
      /* the scarf tail trails behind and ripples */
      tail.forEach((m, i) => {
        const d = i + 1, ph = t * 3.2 * sp - i * .7;
        m.position.set(.16 + d * .075 - look.x * d * .025, -.05 - d * .03 + Math.sin(ph) * .03 * d * s, -.22 - d * .07);
        m.rotation.z = Math.sin(ph) * .4 * s;
      });
      /* blinking */
      nextBlink -= dt; if (nextBlink < 0){ blink = 1; nextBlink = 2.5 + Math.random() * 3; }
      blink = Math.max(0, blink - dt * 9); const e = 1 - Math.sin(Math.min(1, blink) * Math.PI) * .9;
      eyes.forEach(m => { m.scale.y = .075 * e; });
    }
  };
}
