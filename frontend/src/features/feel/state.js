"use strict";
/* features/feel/state.js — Feel: the five rounds and what has been answered. */
/* ---------- the game: five rounds on one page ---------- */
const ROUNDS = [
  { n:1, key:'Window',   title:'Pick a window.',          sub:'Which view would you want to wake up to?' },
  { n:2, key:'Battery',  title:'Drag your battery level.', sub:'How much energy do you have for this trip? Drag the battery, or use the arrow keys.' },
  { n:3, key:'Bag',      title:'What goes in your bag?',   sub:'Pick up to three things.' },
  { n:4, key:'Sound',    title:'Pick a soundtrack.',       sub:'What would be playing in your headphones?' },
  { n:5, key:'Feeling',  title:'Finish the sentence.',     sub:'Choose the feeling you want to bring home.' }
];
const PREFILLED = new Set([2, 3]); // rounds that start with a suggested answer: "Keep this" counts as answering
const touched = new Set(); // rounds the traveler has answered
let gRound = 1; // the round currently in view
let gIO = null;
