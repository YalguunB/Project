/* features/account/index.js — Account: entry points. */
ACT.account = () => BE.account ? openSheetWith(accountMenuHTML()) : openAuth('login');
ACT.signin = () => openAuth('login');
ACT.authmode = el => { authMode = el.dataset.m; $('#shBody').innerHTML = authHTML(); FX.bind($('#shBody')); const i = $('#shBody input'); if (i) i.focus(); };
ACT.logout = async () => { closeSheet(true); await BE.logout(); toast('Signed out. This browser is a new anonymous traveler now.'); if (S.stage === 'plans') go('intro'); };
BE.on(paintAccountBtn);
