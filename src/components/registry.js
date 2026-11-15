/* components/registry.js — Tiny component system (no framework): a component is a function returning HTML; use('name') embeds one inside another. */
const COMPONENTS = {};
const use = name => COMPONENTS[name]();
