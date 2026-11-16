/* features/account/account.js — Account: the top-bar button, the sign-in / sign-up sheet and the account menu.
   No email and no password reset in this prototype: a username and a password (see backend/worker.js, "accounts"). */
const ICON_USER = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="5.5" r="3"/><path d="M2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2" stroke-linecap="round"/></svg>';
let authMode = 'login';
function paintAccountBtn(){
  const b = $('#acctBtn'); if (!b) return;
  b.hidden = !BE.canAccount;
  const a = BE.account;
  const h = `${ICON_USER}${a ? `<span translate="no">${esc(a.name)}</span>` : '<span>Sign in</span>'}`;
  if (b.dataset.h !== h){ b.dataset.h = h; b.innerHTML = h; }
  b.setAttribute('aria-label', a ? `Account: ${a.name}` : 'Sign in or create an account');
  b.classList.toggle('on', !!a);
}
function openSheetWith(html){
  sheetFor = null; sheetOpener = document.activeElement;
  $('#shBody').innerHTML = html;
  const wrap = $('#sheet'); wrap.hidden = false;
  if (FX.on && !FX.reduced){ gsap.fromTo('.sheet-bd', { opacity:0 }, { opacity:1, duration:.3 }); gsap.fromTo('.sheet', { y:50, opacity:0, scale:.97 }, { y:0, opacity:1, scale:1, duration:.55, ease:'power4.out' }); }
  FX.bind(wrap);
  const first = $('#shBody input:not([type=hidden]), #shBody textarea'); (first || $('.sheet')).focus();
}
function authHTML(){
  const login = authMode === 'login';
  return `<div><p class="label accent">Your account</p><h2 class="heading" id="shTitle">${login ? 'Welcome back' : 'Create an account'}</h2>
    <p class="small muted" style="margin-top:8px">${login ? 'Sign in to see your saved plans and reviews on any device.' : 'Keep plans in your account and post reviews under your name. What you already saved in this browser comes with you.'}</p></div>
    <div class="seg" role="tablist" aria-label="Sign in or create an account">
      <button type="button" role="tab" class="seg-b" data-act="authmode" data-m="login" aria-selected="${login}">Sign in</button>
      <button type="button" role="tab" class="seg-b" data-act="authmode" data-m="signup" aria-selected="${!login}">Create account</button>
    </div>
    <form id="authForm" class="rform" novalidate>
      <label class="tfield"><span class="label muted">Username</span><input class="tinput" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.\\-]{3,24}" placeholder="e.g. yalguun"></label>
      <label class="tfield"><span class="label muted">Password</span><input class="tinput" type="password" name="password" autocomplete="${login ? 'current-password' : 'new-password'}" required minlength="8" maxlength="200" placeholder="${login ? '' : 'At least 8 characters'}"></label>
      ${login ? '' : '<p class="fine">There is no email and no password reset in this prototype, so keep your password somewhere safe.</p>'}
      <p class="notice" id="aerr" hidden></p>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" data-act="closesheet">Cancel</button><button class="btn btn-primary" type="submit" id="asub">${login ? 'Sign in' : 'Create account'}</button></div>
    </form>`;
}
function openAuth(mode){ if (mode) authMode = mode; openSheetWith(authHTML()); }
function accountMenuHTML(){
  const a = BE.account;
  return `<div><p class="label accent">Your account</p><h2 class="heading" id="shTitle" translate="no">@${esc(a.name)}</h2>
    <p class="small muted" style="margin-top:8px">Your plans, reviews and comments are saved to this account.</p></div>
    <div class="menu-list">
      <button type="button" class="menu-item" data-act="myplans"><b>My plans</b><small>Open, rename, delete, and review the places you went</small></button>
      <button type="button" class="menu-item" data-act="logout"><b>Sign out</b><small>This browser starts over as an anonymous traveler</small></button>
    </div>
    <div class="sheet-foot"><button type="button" class="btn btn-secondary" data-act="closesheet">Close</button></div>`;
}
async function submitAuth(form){
  const err = $('#aerr'), btn = $('#asub'), u = form.elements.username.value.trim(), p = form.elements.password.value;
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(u)){ err.textContent = BE.explain({ code:'bad_username' }); err.hidden = false; form.elements.username.focus(); return; }
  if (p.length < 8){ err.textContent = BE.explain({ code:'bad_password' }); err.hidden = false; form.elements.password.focus(); return; }
  btn.disabled = true; err.hidden = true; const label = btn.textContent; btn.textContent = authMode === 'login' ? 'Signing in…' : 'Creating…';
  try {
    if (authMode === 'login') await BE.login(u, p); else await BE.signup(u, p);
    closeSheet(); toast(authMode === 'login' ? `Signed in as ${BE.account.name}.` : `Welcome, ${BE.account.name}. Your account is ready.`);
  } catch (e) { err.textContent = BE.explain(e); err.hidden = false; btn.disabled = false; btn.textContent = label; }
}
