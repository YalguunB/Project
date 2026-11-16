"use strict";
/* features/planner/route-map.js — Planner: the route map (OpenFreeMap tiles drawn with MapLibre GL).

   - No key and no account: OpenFreeMap's public tiles. MapLibre adds the map credit (OpenFreeMap, OpenMapTiles, OpenStreetMap).
   - MapLibre (about 1 MB) is served from this site (/vendor) and loaded only when a plan is on screen, so nobody else pays for it.
     It is the CSP build: its worker is a normal file on this site, so the page's Content-Security-Policy needs no blob: workers.
   - The planner redraws itself on every edit; the map element is kept and moved into the new slot, so the map is built once.
   - Pins come from data/places/geo.js and are approximate. Stops with no single place (a spa, a café of your choice) are not pinned.
   - Only when window.MT_MAP is set (frontend/vendor is served by the backend). */
const MAP_ON = !!window.MT_MAP;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const MAP_LIB = '/vendor/maplibre-5.24.1/';
const DAY_COLORS = ['#A3502C', '#356660', '#B7862A', '#5D6E2F', '#7A4A63', '#B0603C', '#3F5E7A', '#7C5A3A'];   // earth tones, one per day
const dayColor = k => DAY_COLORS[k % DAY_COLORS.length];
let mapLib = null, mapEl = null, routeMap = null, routeReady = false, mapDestId = null, mapDay = -1, mapMarkers = [];

function loadMapLib(){
  if (mapLib) return mapLib;
  mapLib = new Promise((ok, no) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MAP_LIB + 'maplibre-gl.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = MAP_LIB + 'maplibre-gl-csp.js'; js.async = true;
    js.onload = () => { try { window.maplibregl.setWorkerUrl(MAP_LIB + 'maplibre-gl-csp-worker.js'); ok(window.maplibregl); } catch (e) { no(e); } };
    js.onerror = () => { mapLib = null; no(new Error('load')); };
    document.head.appendChild(js);
  });
  return mapLib;
}
/* every pinned stop of the plan, per day, in plan order */
function routePoints(){
  const g = GEO[S.dest.id] || { p:{} };
  return S.plan.days.map((day, k) => day.stops.map((s, i) => ({ s, k, i, ll:!s.custom && g.p[s.title] })).filter(x => x.ll));
}
function routePanelHTML(){
  if (!MAP_ON) return '';
  const pts = routePoints(), pinned = pts.reduce((n, d) => n + d.length, 0), total = S.plan.days.reduce((n, d) => n + d.stops.length, 0);
  if (mapDay >= S.plan.days.length) mapDay = -1;
  return `<div class="panel route-panel" data-pop>
    <div class="cost-top"><div><p class="label muted">Your route · ${esc(S.dest.name)}</p><p class="title" style="margin-top:4px">Where each day takes you</p></div>
      <div class="route-days" role="group" aria-label="Show on the map">
        <button type="button" class="rday" data-act="mapday" data-day="-1" aria-pressed="${mapDay < 0}">All days</button>
        ${S.plan.days.map((_, k) => `<button type="button" class="rday" data-act="mapday" data-day="${k}" aria-pressed="${mapDay === k}" style="--dc:${dayColor(k)}"><i aria-hidden="true"></i>Day ${k + 1}</button>`).join('')}
      </div></div>
    <div id="routeMapSlot" class="route-slot"></div>
    <p class="fine">${pinned} of ${total} stops are on the map. Pins are approximate, and stops that are not one place (a spa, a café of your choice) are left off. Tap a pin for the place.</p>
  </div>`;
}
async function mountRouteMap(){
  if (!MAP_ON) return;
  const slot = $('#routeMapSlot'); if (!slot) return;
  if (!mapEl){
    mapEl = document.createElement('div'); mapEl.className = 'route-map';
    mapEl.setAttribute('role', 'region'); mapEl.setAttribute('aria-label', 'Map of your route'); mapEl.setAttribute('translate', 'no');
    mapEl.innerHTML = '<p class="route-wait fine">Loading the map…</p>';
  }
  slot.appendChild(mapEl);
  if (routeMap){ routeMap.resize(); paintRoute(mapDestId !== S.dest.id); return; }
  let lib;
  try { lib = await loadMapLib(); } catch (e) { mapEl.innerHTML = '<p class="route-wait fine">The map could not load right now. The plan below works without it.</p>'; return; }
  if (routeMap || !mapEl.isConnected || !S.dest) return;
  mapEl.innerHTML = '';
  const g = GEO[S.dest.id];
  routeMap = new lib.Map({ container:mapEl, style:MAP_STYLE, center:g ? [g.c[1], g.c[0]] : [0, 20], zoom:g ? g.z : 1.5,
    cooperativeGestures:true, attributionControl:{ compact:true }, fadeDuration:0 });
  routeMap.addControl(new lib.NavigationControl({ showCompass:false }), 'top-right');
  routeMap.on('load', () => { routeReady = true; paintRoute(true); });
}
function paintRoute(fit){
  if (!routeMap || !routeReady || !S.plan || !S.dest) return;
  const lib = window.maplibregl, days = routePoints(), show = (k) => mapDay < 0 || mapDay === k;
  mapMarkers.forEach(m => m.remove()); mapMarkers = [];
  days.forEach((list, k) => list.forEach((x, n) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'rmk'; el.dataset.act = 'place'; el.dataset.id = x.s.id;
    el.style.setProperty('--dc', dayColor(k)); el.textContent = n + 1; el.hidden = !show(k);
    el.setAttribute('aria-label', `Day ${k + 1}, stop ${n + 1}: ${x.s.title}`); el.title = `Day ${k + 1} · ${x.s.title}`;
    mapMarkers.push(new lib.Marker({ element:el, anchor:'center' }).setLngLat([x.ll[1], x.ll[0]]).addTo(routeMap));
  }));
  const lines = { type:'FeatureCollection', features:days.map((list, k) => ({ type:'Feature', properties:{ c:dayColor(k), on:show(k) ? 1 : 0 },
    geometry:{ type:'LineString', coordinates:list.map(x => [x.ll[1], x.ll[0]]) } })).filter(f => f.geometry.coordinates.length > 1) };
  const src = routeMap.getSource('route');
  if (src) src.setData(lines);
  else {
    routeMap.addSource('route', { type:'geojson', data:lines });
    routeMap.addLayer({ id:'route', type:'line', source:'route', layout:{ 'line-cap':'round', 'line-join':'round' },
      paint:{ 'line-color':['get', 'c'], 'line-width':3, 'line-opacity':['*', 0.75, ['get', 'on']], 'line-dasharray':[1.5, 1.5] } });
  }
  if (fit || mapDestId !== S.dest.id){
    mapDestId = S.dest.id;
    const vis = days.flatMap((list, k) => show(k) ? list : []);
    if (vis.length){
      const b = new lib.LngLatBounds(); vis.forEach(x => b.extend([x.ll[1], x.ll[0]]));
      routeMap.fitBounds(b, { padding:48, maxZoom:15, duration:FX.reduced ? 0 : 700 });
    } else { const g = GEO[S.dest.id]; if (g) routeMap.jumpTo({ center:[g.c[1], g.c[0]], zoom:g.z }); }
  }
}
