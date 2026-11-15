/* ============ FX: text reveals, page curtain and loader ============ */
const FX = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = !!window.gsap;
  const api = { on:hasG, reduced:REDUCED };
  if (hasG) gsap.config({ nullTargetWarn:false });

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

  api.bind = root => { rise(root); marquee(root); };

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
