/* components/header.js — Top bar: brand, stage progress, tools. */
COMPONENTS['header'] = () => `<header class="top">
  ${use('brand')}
  <nav class="stages" id="stages" aria-label="Trip progress"></nav>
  ${use('top-right')}
</header>`;
