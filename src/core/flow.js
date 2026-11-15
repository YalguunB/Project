/* core/flow.js — Navigation actions: moving between screens. */
ACT.start = () => go('game');
ACT.skip = () => go('budget');
ACT.next = () => go(ORDER[ORDER.indexOf(S.stage) + 1]);
ACT.back = () => go(ORDER[ORDER.indexOf(S.stage) - 1]);
ACT.restart = () => go('game', { force:true, before:resetAnswers });
ACT.change = () => go('game');
ACT.tomatches = () => go('matches');
