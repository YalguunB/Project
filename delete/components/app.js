/* components/app.js — The one aggregating component: lists every part of the page in order. */
COMPONENTS['app'] = () => [
  'gl-canvas', 'backdrop', 'shell', 'tooltip', 'sheet', 'place-panel', 'curtain', 'loader', 'toast', 'live-region'
].map(use).join('\n');
