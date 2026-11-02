/* ============ FX: custom cursor, magnetic buttons, tilt, liquid hover, text reveals, page curtain, loader ============ */
const FX = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = !!window.gsap;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const api = { on:hasG, reduced:REDUCED, fine };
  if (hasG) gsap.config({ nullTargetWarn:false });

  /* ---------- cursor ---------- */
  api.cursor = () => {
    if (!hasG || !fine || REDUCED) return;
    const cur = $('#cur'), dot = $('.dot', cur), ring = $('.ring', cur), lbl = $('.ring span', cur);
    document.documentElement.classList.add('has-cursor');
    gsap.set([dot, ring], { xPercent:-50, yPercent:-50 });
    const dx = gsap.quickTo(dot, 'x', { duration:.12, ease:'power3' }), dy = gsap.quickTo(dot, 'y', { duration:.12, ease:'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration:.5, ease:'power3' }), ry = gsap.quickTo(ring, 'y', { duration:.5, ease:'power3' });
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      cur.classList.add('on'); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive:true });
    document.documentElement.addEventListener('pointerleave', () => cur.classList.remove('on'));
    const SEL = '[data-cursor],a,button,label.opt,input,textarea,.battery,.grip,.mcell,.pick';
    const set = t => {
      if (!t){ cur.classList.remove('hov', 'lbl'); lbl.textContent = ''; return; }
      let text = t.getAttribute('data-cursor');
      if (text === null){
        const l = t.matches('input[type=radio],input[type=checkbox]') ? t.closest('label.opt') : null;
        text = l && l.getAttribute('data-cursor') !== null ? l.getAttribute('data-cursor') : l ? 'Pick' : t.matches('.battery,.grip,input[type=range]') ? 'Drag' : '';
      }
      if (text){ lbl.textContent = text; cur.classList.add('lbl'); cur.classList.remove('hov'); }
      else { lbl.textContent = ''; cur.classList.add('hov'); cur.classList.remove('lbl'); }
    };
    document.addEventListener('pointerover', e => set(e.target.closest ? e.target.closest(SEL) : null));
    addEventListener('pointerdown', () => cur.classList.add('down'));
    addEventListener('pointerup', () => cur.classList.remove('down'));
  };

  /* ---------- magnetic buttons ---------- */
  function magnet(root){
    if (!hasG || !fine || REDUCED) return;
    $$('.btn,.stagebtn,.brand,.fieldbtn,[data-mag]', root).forEach(el => {
      if (el._mag) return; el._mag = true;
      const xTo = gsap.quickTo(el, 'x', { duration:.7, ease:'elastic.out(1,.4)' }), yTo = gsap.quickTo(el, 'y', { duration:.7, ease:'elastic.out(1,.4)' });
      el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * .3); yTo((e.clientY - (r.top + r.height / 2)) * .38);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- 3D tilt with a glare that follows the pointer ---------- */
  function tilt(root){
    if (!hasG || REDUCED) return;
    $$('[data-tilt]', root).forEach(el => {
      if (el._tilt) return; el._tilt = true;
      const base = parseFloat(el.getAttribute('data-rot') || '0');
      gsap.set(el, { transformPerspective:900, rotation:base });
      if (!fine) return;
      const rx = gsap.quickTo(el, 'rotationX', { duration:.7, ease:'power3' }), ry = gsap.quickTo(el, 'rotationY', { duration:.7, ease:'power3' });
      el.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        ry(px * 11); rx(-py * 9);
        el.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------- liquid ripple when the pointer enters a picture ---------- */
  function liquid(root){
    if (!hasG || REDUCED || !fine) return;
    const map = $('#liquidMap'), turb = $('#liquidTurb');
    if (!map || !turb) return;
    $$('[data-liquid]', root).forEach(el => {
      if (el._lq) return; el._lq = true;
      el.addEventListener('pointerenter', () => {
        gsap.killTweensOf([map, turb]);
        el.style.filter = 'url(#liquid)';
        gsap.fromTo(turb, { attr:{ baseFrequency:'0.004 0.009' } }, { attr:{ baseFrequency:'0.012 0.022' }, duration:1.6, ease:'sine.out' });
        gsap.timeline({ onComplete:() => { el.style.filter = ''; } })
          .fromTo(map, { attr:{ scale:0 } }, { attr:{ scale:42 }, duration:.35, ease:'power2.out' })
          .to(map, { attr:{ scale:0 }, duration:1.1, ease:'elastic.out(1,.5)' });
      });
    });
  }

  /* ---------- text reveals ---------- */
  function splitWords(el){
    if (el._split) return el._split;
    const words = [];
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3){
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(p)); return; }
          const o = document.createElement('span'), i = document.createElement('span');
          o.className = 'w'; i.className = 'wi'; i.textContent = p; i.setAttribute('aria-hidden', 'true');
          o.appendChild(i); frag.appendChild(o); words.push(i);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
    });
    walk(el); el._split = words; return words;
  }
  /* builds (and primes) the entrance timeline for a freshly rendered view; returns it paused */
  api.enter = root => {
    if (!hasG || REDUCED) return null;
    const tl = gsap.timeline({ paused:true, defaults:{ ease:'power4.out' } });
    $$('[data-split]', root).forEach((el, i) => {
      const w = splitWords(el); gsap.set(w, { yPercent:118, rotate:6 });
      tl.to(w, { yPercent:0, rotate:0, duration:1.05, stagger:.06 }, .02 + i * .12);
    });
    const fades = $$('[data-fade]', root);
    if (fades.length){ gsap.set(fades, { y:30, opacity:0 }); tl.to(fades, { y:0, opacity:1, duration:.95, stagger:.08, ease:'power3.out' }, .22); }
    const pops = $$('[data-pop]', root);
    if (pops.length){ gsap.set(pops, { y:46, opacity:0, scale:.94 }); tl.to(pops, { y:0, opacity:1, scale:1, duration:1, stagger:.07, ease:'back.out(1.3)' }, .3); }
    return tl;
  };
  /* elements further down the page rise in as they scroll into view */
  let io = null;
  function rise(root){
    if (!hasG || REDUCED) return;
    const els = $$('[data-rise]', root).filter(e => !e._rise);
    if (!els.length) return;
    if (!io) io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      gsap.to(en.target, { y:0, opacity:1, duration:.9, ease:'power3.out', delay:en.target._d || 0 });
    }), { rootMargin:'0px 0px -6% 0px' });
    els.forEach((el, i) => { el._rise = true; el._d = (i % 4) * .06; gsap.set(el, { y:46, opacity:0 }); io.observe(el); });
  }

  /* ---------- marquee that speeds up with scrolling ---------- */
  function marquee(root){
    const track = $('.marquee .track', root);
    if (!track || !hasG || REDUCED) return;
    let x = 0, last = scrollY, vel = 0;
    const tick = () => {
      if (!track.isConnected){ gsap.ticker.remove(tick); return; }
      const dy = scrollY - last; last = scrollY; vel += (dy - vel) * .1;
      x -= .55 + Math.abs(vel) * .22;
      const w = track.scrollWidth / 2; if (x <= -w) x += w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    };
    gsap.ticker.add(tick);
  }

  api.bind = root => { magnet(root); tilt(root); liquid(root); rise(root); marquee(root); };

  /* ---------- page curtain: a color block with a curved lip sweeps the screen while the view swaps ---------- */
  api.curtain = (label, bg, ink, swap) => {
    if (!hasG || REDUCED){ const et = swap(); if (et) et.progress(1); return Promise.resolve(); }
    const el = $('#curtain'), panel = $('.cp', el), txt = $('.cl', el);
    const H = innerHeight, R = Math.round(H * .16);
    panel.style.height = (H + 2 * R) + 'px';
    panel.style.borderRadius = `50% / ${R}px`;
    panel.style.background = bg; txt.style.color = ink; txt.textContent = label;
    el.hidden = false;
    return new Promise(res => {
      let et = null;
      const tl = gsap.timeline({ onComplete:() => { el.hidden = true; res(); } });
      tl.set(panel, { y:H }).set(txt, { opacity:0, yPercent:50 })
        .to(panel, { y:-R, duration:.62, ease:'power3.inOut' })
        .to(txt, { opacity:1, yPercent:0, duration:.42, ease:'power3.out' }, '-=.32')
        .add(() => { et = swap(); })
        .to(txt, { opacity:0, yPercent:-50, duration:.3, ease:'power2.in' }, '+=.05')
        .to(panel, { y:-(H + 2 * R), duration:.64, ease:'power3.inOut' }, '-=.12')
        .add(() => { if (et) et.play(); }, '-=.42');
    });
  };

  /* ---------- opening loader ---------- */
  api.loader = (onCovered, onDone) => {
    const el = $('#loader'), num = $('#ldNum'), panel = $('.lp', el);
    const finish = () => { el.hidden = true; onDone && onDone(); };
    if (!hasG || REDUCED){ onCovered && onCovered(); finish(); return; }
    const H = innerHeight, R = Math.round(H * .16), o = { v:0 };
    panel.style.height = (H + R) + 'px'; panel.style.borderRadius = `0 0 50% 50% / 0 0 ${R}px ${R}px`;
    const inner = $('.ld-in', el);
    const tl = gsap.timeline({ onComplete:finish });
    tl.from('.ld-line', { opacity:0, y:18, duration:.7, stagger:.1, ease:'power3.out' }, 0)
      .to(o, { v:100, duration:1.5, ease:'power2.inOut', onUpdate:() => { num.textContent = Math.round(o.v); } }, 0)
      .to(inner, { opacity:0, y:-24, duration:.4, ease:'power2.in' }, '+=.1')
      .add(() => { onCovered && onCovered(); })
      .to(panel, { y:-(H + R), duration:.95, ease:'power3.inOut' }, '+=.0');
    return tl;
  };

  return api;
})();
