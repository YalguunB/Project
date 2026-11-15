/* components/overlays.js — The aggregating component: gathers every overlay (tooltip, sheet, place panel, curtain, loader, toast, live region). */
COMPONENTS['overlays'] = () => [
  'tooltip', 'sheet', 'place-panel', 'curtain', 'loader', 'toast', 'live-region'
].map(use).join('\n');
