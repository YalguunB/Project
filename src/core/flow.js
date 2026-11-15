/* core/flow.js — Navigation actions: moving between screens. */
ACT.start = () => go('game');
ACT.skip = () => go('budget');
ACT.next = () => go(ORDER[ORDER.indexOf(S.stage) + 1]);
ACT.back = () => go(ORDER[ORDER.indexOf(S.stage) - 1]);
ACT.restart = () => go('game', { force:true, before:resetAnswers });
ACT.change = () => go('game');
ACT.tomatches = () => go('matches');
/* language switch: the current screen is rebuilt in the new language, already in place (no entrance animation) */
ACT.lang = () => I18N.set(I18N.lang === 'en' ? 'mn' : 'en', () => { const tl = render(S.stage, { focus:false }); if (tl) tl.progress(1); });
