/* core/boot.js — Boot. */
/* ---------- boot ---------- */
$('#horizon').innerHTML = Object.entries(HORIZON).map(([k, v]) => v.replace('<svg ', `<svg data-scene="${k}" `)).join('');
if (GL.ok) document.documentElement.classList.add('gl');
document.documentElement.style.setProperty('--energy', S.energy / 100);
const introTl = render('intro', { focus:false });
FX.loader(() => { if (introTl) gsap.delayedCall(.3, () => introTl.play()); }, () => { const h = $('#h1'); if (h) h.focus({ preventScroll:true }); });
let rsz;
addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (GL.ok && S.stage !== 'field') GL.setAnchor(S.stage === 'game' ? gameAnchor() : anchorFor(S.stage)); }, 120); });
