"use strict";
/* components/mount.js — Replaces every <div data-component="x"> in body.html with that component's HTML. Must run before any other code looks up an element. */
for (const host of document.querySelectorAll('[data-component]')){
  const t = document.createElement('template');
  t.innerHTML = use(host.dataset.component);
  host.replaceWith(t.content);
}
