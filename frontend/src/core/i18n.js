/* core/i18n.js — Language switch (English / Mongolian) without touching every template.

   The page is written in English. When another language is on:
     - screens are translated as HTML before they are put on the page (I18N.html, used by render), so headings that FX splits into
       words are translated whole, not word by word;
     - everything else the page changes later (toasts, sheets, review lists, labels set with textContent) is translated by a
       MutationObserver right after it changes, before the browser paints.
   Only text nodes and the attributes people read (aria-label, placeholder, title, alt, aria-valuetext, data-cursor) change.
   Elements marked translate="no" and form fields are left alone, and so is anything that has no translation.

   Strings live in frontend/src/i18n/<lang>.js. In the console, MT_I18N.missing() lists English seen on the page without a translation. */
const I18N = (() => {
  const KEY = 'moodtrip:lang';
  const PACKS = { mn:{ strings:typeof MN_STRINGS !== 'undefined' ? MN_STRINGS : {}, rules:typeof MN_RULES !== 'undefined' ? MN_RULES : [],
                       short:typeof MN_SHORT !== 'undefined' ? MN_SHORT : null } };
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'aria-valuetext', 'data-cursor'];
  const SKIP = 'script,style,textarea,input,select,[translate="no"],[contenteditable]';
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) || (/^mn\b/i.test(navigator.language || '') ? 'mn' : 'en'); } catch (e) {}
  if (lang !== 'en' && !PACKS[lang]) lang = 'en';

  /* ---------- the dictionary: exact keys, case-insensitive keys, templates with {0}, rules ---------- */
  let exact, lower, tpls, rules, memo;
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(){
    exact = new Map(); lower = new Map(); tpls = []; memo = new Map();
    const p = PACKS[lang]; rules = p ? p.rules : [];
    if (!p) return;
    Object.entries(p.strings).forEach(([k, v]) => {
      if (/\{\d\}/.test(k)) {
        const re = new RegExp('^' + reEsc(k).replace(/\\\{(\d)\\\}/g, '((?:(?! · ).)+?)') + '$');
        tpls.push({ re, out:v, lit:k.replace(/\{\d\}/g, '').length, order:[...k.matchAll(/\{(\d)\}/g)].map(m => +m[1]) });
      } else { exact.set(k, v); lower.set(k.toLowerCase(), v); }
    });
    tpls.sort((a, b) => b.lit - a.lit);                 // the most specific template wins
  }
  /* Mongolian case endings for a name that was put into a sentence: genitive, dative, accusative */
  const VOWEL = /[аэиоуөүяеёюы]$/i;
  function ending(word, c){
    if (!/[а-яөүё]/i.test(word)) return word + { gen:'-ийн', dat:'-д', acc:'-г' }[c];   // still in English: keep it readable
    const w = word.replace(/\s+$/, '');
    if (c === 'gen') return w + (VOWEL.test(w) ? 'гийн' : /н$/i.test(w) ? 'ы' : 'ийн');
    if (c === 'dat') return w + (VOWEL.test(w) || /[нмлр]$/i.test(w) ? 'д' : /[дт]$/i.test(w) ? 'ад' : 'т');
    return w + (VOWEL.test(w) ? 'г' : /н$/i.test(w) ? 'ыг' : 'ийг');
  }
  const plain = v => /^[\d\s$€%.,:+–\-/#≈()]*$/.test(v);
  const part = (v, d) => plain(v) ? v : (tr(v, d + 1) ?? v);
  function tr(s, d = 0){
    if (!s || d > 4) return null;
    if (memo.has(s)) return memo.get(s);
    let out = null;
    if (exact.has(s)) out = exact.get(s);
    else if (lower.has(s.toLowerCase())) { const v = lower.get(s.toLowerCase()); out = /^[a-z]/.test(s) ? v.charAt(0).toLowerCase() + v.slice(1) : v; }
    if (out == null) for (const [re, fn] of rules) { const m = re.exec(s); if (m) { out = fn(m, x => part(x, d)); break; } }
    if (out == null) for (const t of tpls) {
      const m = t.re.exec(s); if (!m) continue;
      const vals = {}; t.order.forEach((n, i) => { vals[n] = m[i + 1]; });
      out = t.out.replace(/\{(\d)(?::(gen|dat|acc))?\}/g, (_, n, c) => { const v = part(vals[n], d); return c ? ending(v, c) : v; });
      break;
    }
    if (out == null) for (const sep of [' · ', ', ', ' and ']) {           // lists: translate each part
      if (!s.includes(sep)) continue;
      const bits = s.split(sep), got = bits.map(b => tr(b.trim(), d + 1));
      if (got.some(x => x != null)) { out = bits.map((b, i) => got[i] ?? b).join(sep === ' and ' ? ', ' : sep); break; }
    }
    if (out == null) { const m = /^(.*?)([.!?:,]+)$/.exec(s); if (m && m[1]) { const t = tr(m[1], d + 1); if (t != null) out = t + m[2]; } }
    memo.set(s, out);
    return out;
  }

  /* ---------- applying it to the page ---------- */
  const textOrig = new WeakMap(), attrOrig = new WeakMap(), missing = new Set();
  const latin = /[A-Za-z]/, CYR = /[а-яёөү]/i;
  function doText(n){
    const v = n.nodeValue; if (!v || !latin.test(v)) return;
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const core = v.replace(/\s+/g, ' ').trim(); if (!core || CYR.test(core)) return;   // already translated
    const short = PACKS[lang].short && p.closest('.mcell, input[name="month"] + .face') && PACKS[lang].short[core];
    const out = short || tr(core); if (out == null) { missing.add(core); return; }
    textOrig.set(n, v);
    const lead = /^\s*/.exec(v)[0], trail = /\s*$/.exec(v)[0];
    n.nodeValue = lead + out + trail;
  }
  function doAttrs(el){
    if (el.closest(SKIP) && !el.matches('input,textarea')) return;      // a field's placeholder and label still count
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v || !latin.test(v) || CYR.test(v)) continue;
      const out = tr(v.trim()); if (out == null) { missing.add(v.trim()); continue; }
      const o = attrOrig.get(el) || {}; o[a] = v; attrOrig.set(el, o);
      el.setAttribute(a, out);
    }
  }
  function walk(root){
    if (lang === 'en' || !root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType === 1) doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function restore(root){
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) {
      if (n.nodeType === 3) { const o = textOrig.get(n); if (o != null) { n.nodeValue = o; textOrig.delete(n); } }
      else { const o = attrOrig.get(n); if (o) { Object.entries(o).forEach(([a, v]) => n.setAttribute(a, v)); attrOrig.delete(n); } }
    }
  }
  let obs = null;
  function observe(){
    if (obs) obs.disconnect();
    if (lang === 'en') return;
    obs = new MutationObserver(list => {
      obs.disconnect();                                  // our own edits must not wake the observer again
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
      }
      obs.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS });
    });
    obs.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS });
  }
  function paintSwitch(){
    const b = document.getElementById('langBtn'); if (!b) return;
    b.textContent = lang === 'en' ? 'МН' : 'EN';
    b.setAttribute('lang', lang === 'en' ? 'mn' : 'en');
    b.setAttribute('aria-label', lang === 'en' ? 'Монгол хэл рүү шилжих' : 'Switch to English');
    b.title = b.getAttribute('aria-label');
  }

  /* words that CSS draws with content: they read a custom property, set here */
  function cssWords(){ document.documentElement.style.setProperty('--t-budget', JSON.stringify(api.tr('Budget'))); }
  compile();
  const api = {
    get lang(){ return lang; },
    tr:s => lang === 'en' ? s : (tr(s) ?? s),
    /* translate a screen's HTML before it goes on the page */
    html(h){
      if (lang === 'en') return h;
      const t = document.createElement('template'); t.innerHTML = h; walk(t.content); return t.innerHTML;
    },
    start(){ document.documentElement.lang = lang; cssWords(); walk(document.body); observe(); paintSwitch(); },
    set(next, rerender){
      if (next === lang || (next !== 'en' && !PACKS[next])) return;
      if (obs) obs.disconnect();
      restore(document.body);                            // back to English first, so every language starts from the same text
      lang = next; compile();
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      document.documentElement.lang = lang; cssWords();
      if (rerender) rerender();                          // the current screen is rebuilt in the new language
      walk(document.body); observe(); paintSwitch();
    },
    missing:() => [...missing].sort()
  };
  window.MT_I18N = { missing:api.missing, lang:() => lang };
  return api;
})();
