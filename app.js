

 /*============================================================================
   1) DATA — Data model（locationKuala Lumpur）
   ----------------------------------------------------------------------------
   An array of objects is the natural shape for a list of records.
   ============================================================================ */
const STOPS = [

  { id:1001, name:"KLCC, Jalan Ampang",              lat:3.1578, lng:101.7123, routes:["100","T780","U26","40"] },
  { id:1002, name:"Bukit Bintang, Jalan Bukit Bintang", lat:3.1466, lng:101.7099, routes:["58","T780","U88"] },
  { id:1003, name:"KL Sentral, Jalan Stesen Sentral", lat:3.1339, lng:101.6869, routes:["40","100","U69"] },
  { id:1004, name:"Chow Kit, Jalan Raja Laut",       lat:3.1665, lng:101.6976, routes:["40","58","T780"] },
  { id:1005, name:"Masjid India, Jalan Melayu",      lat:3.1496, lng:101.6984, routes:["40","U26","58","100"] },
  { id:1006, name:"Pasar Seni, Jalan Cheng Lock",    lat:3.1440, lng:101.6957, routes:["40","U26","100","U69"] },
  { id:1007, name:"Dang Wangi, Jalan Sultan Ismail", lat:3.1579, lng:101.7056, routes:["U26","100","T780"] },
  { id:1008, name:"Ampang Park, Jalan Ampang",       lat:3.1617, lng:101.7176, routes:["100","U88"] },
  { id:1009, name:"Jalan Imbi, Berjaya Times Square",lat:3.1444, lng:101.7112, routes:["58","T780","U88"] },
  { id:1010, name:"Titiwangsa, Jalan Pahang",        lat:3.1749, lng:101.7072, routes:["40","T780"] },
];

// Route data：
const ROUTES = [
  {
    id:"40",
    name:"Titiwangsa → KL Sentral",
    color:"#1a2340",
    freq:10,
    stopIds:[1010,1004,1005,1006,1003]
  },

  {
    id:"U26",
    name:"KLCC → Pasar Seni",
    color:"#e6304a",
    freq:12,
    stopIds:[1001,1007,1005,1006]
  },

  {
    id:"100",
    name:"KL Sentral → Ampang Park",
    color:"#4dabf7",
    freq:15,
    stopIds:[1003,1006,1005,1007,1001,1008]
  },

  {
    id:"58",
    name:"Chow Kit → Bukit Bintang",
    color:"#845ef7",
    freq:8,
    stopIds:[1004,1005,1006,1009,1002]
  },

  {
    id:"T780",
    name:"Titiwangsa → Bukit Bintang",
    color:"#f59f00",
    freq:9,
    stopIds:[1010,1004,1007,1001,1009,1002]
  }
];

STOPS.forEach(stop => {
  stop.routes = ROUTES
    .filter(route => route.stopIds.includes(stop.id))
    .map(route => route.id);
});


const stopById  = id => STOPS.find(s => s.id === id);
const routeById = id => ROUTES.find(r => r.id === id);


const BUSES = [];
let lastT = Date.now();   

function initBuses() {
  const defs = [
    { id:"B01", routeId:"40", si:0, prog:.2 },
    { id:"B02", routeId:"40", si:2, prog:.6 },

    { id:"B03", routeId:"U26", si:1, prog:.4 },

    { id:"B04", routeId:"100", si:0, prog:.3 },
    { id:"B05", routeId:"100", si:3, prog:.7 },

    { id:"B06", routeId:"58", si:2, prog:.5 },

    { id:"B07", routeId:"T780", si:1, prog:.2 }
  ];

  defs.forEach(d => {
    const route = routeById(d.routeId);

    BUSES.push({
      ...d,
      route,
      speed:0.0015 + Math.random()*0.0005,
      marker:null,
      heading:0,

      direction:1,
      waiting:0
    });
  });
}

/* ============================================================================
   2) SIMULATION — Bus simulation
   ----------------------------------------------------------------------------
   We have no real GPS, so we fake buses moving between a route's stops.
     si   = which segment (stop index)
     prog = progress 0→1 along the segment
   ============================================================================ */
function busPos(bus) {

  const sids = bus.route.stopIds;

  const from = stopById(sids[bus.si]);
  const to = stopById(sids[bus.si + bus.direction]);

  if (!from || !to) return null;

  return {
    lat: from.lat + (to.lat - from.lat) * bus.prog,
    lng: from.lng + (to.lng - from.lng) * bus.prog,
    fromStop: from,
    toStop: to
  };
}


function busHeading(bus) {

  const sids = bus.route.stopIds;

  const from = stopById(sids[bus.si]);
  const to = stopById(sids[bus.si + bus.direction]);

  if (!from || !to) return 0;

  const dy = to.lat - from.lat;
  const dx = to.lng - from.lng;

  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}


function etaMin(bus, targetId) {

  const stops = bus.route.stopIds;

  if (!stops.includes(targetId))
    return null;

  const targetIndex = stops.indexOf(targetId);

  let segments = 0;

  if (bus.direction === 1) {

    if (targetIndex < bus.si)
      return null;

    segments = targetIndex - bus.si;

  } else {

    if (targetIndex > bus.si)
      return null;

    segments = bus.si - targetIndex;
  }

  const segM = 2;

  return Math.round(
    (1 - bus.prog) * segM +
    (segments - 1) * segM
  );
}


/* ============================================================================
   3) MAP — Leaflet/The map
   ============================================================================ */
let map;

function initMap() {
  // Create map, set center + zoom.
  // zoomControl:false → 關掉內建縮放鈕，因為我們自己做了好看的按鈕。
  map = L.map('map', { zoomControl:false, attributionControl:true })
         .setView([3.1490, 101.7020], 15);

  // Base map tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom:19, subdomains:'abcd',
    attribution:'&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(map);

 // Draw each route as a dashed polyline + label
ROUTES.forEach(route => {
  const coords = route.stopIds
    .map(id => {
      const s = stopById(id);
      return s ? [s.lat, s.lng] : null;
    })
    .filter(Boolean);

  const poly = L.polyline(coords, {
    color: route.color,
    weight: 3,
    opacity: 0.45,
    dashArray: '6 5'
  }).addTo(map);

  // Add route label (permanent tooltip)
  poly.bindTooltip(route.id, {
    permanent: true,
    direction: 'center',
    className: 'route-label'
  });
});

  // Add a marker for every stop.
STOPS.forEach(s => {
  s.marker = L.marker([s.lat, s.lng], { icon: stopIcon() })
    .addTo(map)
    .bindTooltip(s.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -10],
      className: 'stop-label'
    })
    .on('click', () => selectStop(s.id));
});

  // User's location (a demo fixed point).
  L.marker([3.1490, 101.7050], {
    icon: L.divIcon({ className:'', html:'<div class="upulse-ring"><div class="upulse-dot"></div></div>', iconSize:[74,74], iconAnchor:[37,37] }),
    zIndexOffset:-20,
  }).addTo(map);

  // Add a marker for every bus.
  initBuses();
  BUSES.forEach(bus => {
    const p = busPos(bus); if (!p) return;
    bus.heading = busHeading(bus);
    bus.marker = L.marker([p.lat, p.lng], {
      icon: busIcon(bus.route.color, bus.heading),
      zIndexOffset:100,                              
    }).addTo(map);
  });

  // Wire up the custom map buttons.
  document.getElementById('zinBtn').onclick  = () => map.zoomIn();
  document.getElementById('zoutBtn').onclick = () => map.zoomOut();
  document.getElementById('locBtn').onclick  = () => map.flyTo([3.1490, 101.7050], 16, { duration:.8 });
}

// Stop icon
function stopIcon(color = '#1a2340') {
  return L.divIcon({
    className:'',
    html:`<div class="stop-pin" style="background:${color}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
          </div>`,
    iconSize:[26,26], iconAnchor:[13,13],
  });
}

// Bus icon
// A teardrop badge + white bus glyph + a rotating direction arrow + pulsing ring.
function busIcon(color, heading = 0) {
  return L.divIcon({
    className:'',
    html:`<div class="bus-pin">
            <div class="ring"></div>
            <div class="arrow" style="transform:rotate(${heading}deg)"></div>
            <div class="badge" style="background:${color}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.2-.8-.5-1.1l-1.5-1.5c-.5-.5-1.2-.8-1.9-.8H5.4c-.7 0-1.4.3-1.9.8L2 13c-.3.3-.5.7-.5 1.1V18h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
            </div>
          </div>`,
    iconSize:[38,38], iconAnchor:[19,19],
  });
}


/* ============================================================================
   4) ANIMATION — Animation loop
   ----------------------------------------------------------------------------
   requestAnimationFrame
   We advance buses a little each frame; multiplying by dt keeps speed stable.
   ============================================================================ */
function tick() {

  const now = Date.now();
  const dt = (now - lastT) / 1000;
  lastT = now;

  BUSES.forEach(bus => {

    if (bus.waiting > 0) {
      bus.waiting -= dt;
      return;
    }

    bus.prog += bus.speed * dt * 25;

    if (bus.prog >= 1) {

      bus.prog = 0;

      bus.si += bus.direction;

      const lastIndex = bus.route.stopIds.length - 1;

      if (bus.si >= lastIndex) {

        bus.si = lastIndex;
        bus.direction = -1;
        bus.waiting = 5;

      } else if (bus.si <= 0) {

        bus.si = 0;
        bus.direction = 1;
        bus.waiting = 5;
      }

      bus.heading = busHeading(bus);

      if (bus.marker) {
        bus.marker.setIcon(
          busIcon(bus.route.color, bus.heading)
        );
      }
    }

    const p = busPos(bus);

    if (p && bus.marker) {
      bus.marker.setLatLng([p.lat, p.lng]);
    }
  });

  if (selStop !== null) {
    liveETA();
  }

  requestAnimationFrame(tick);
}


/* ============================================================================
   5) STATE-UI state
   ----------------------------------------------------------------------------
   A few variables remember the current view; the UI is rebuilt from them.
   ============================================================================ */
let activeTab = 'nearby';     // current tab
let selStop   = null;         // selected stop id
let searchQuery = '';         // current search text
const favs    = new Set();    // set of favorited stop ids

// Switch tab.
function switchTab(tab) {
  activeTab = tab;
  if (tab !== 'nearby' && tab !== 'stops') selStop = null;  // 離開站牌頁就取消選取
  syncTabUI();
  render();
}

// Sync active styles on both tab bars.
function syncTabUI() {
  document.querySelectorAll('.tab-btn').forEach(b => setTabActive(b, b.dataset.tab === activeTab));
  document.querySelectorAll('.bn-btn').forEach(b => {
    const on = b.dataset.tab === activeTab;
    b.classList.toggle('text-navy', on);     
    b.classList.toggle('text-muted', !on);   
  });
}

// Open & close the sidebar drawer (mobile/tablet).
function openDrawer() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('overlay').classList.remove('hidden');
}
function closeDrawer() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('overlay').classList.add('hidden');
}

// 切換桌機分頁鈕外觀（因為改用 Tailwind，主動加/移除 class）。
function setTabActive(btn, on) {
  btn.classList.toggle('text-navy', on);
  btn.classList.toggle('border-navy', on);
  btn.classList.toggle('text-muted', !on);
  btn.classList.toggle('border-transparent', !on);
}

// Select a stop → fly to it + show ETA.
function selectStop(id) {
  selStop = id;
  const s = stopById(id); if (!s) return;
  map.flyTo([s.lat, s.lng], 16, { duration:.7 });
  if (activeTab !== 'nearby' && activeTab !== 'stops') activeTab = 'nearby';
  render();
  // On small screens, reveal the panel.
  if (window.innerWidth < 1024) openDrawer();
  const sheet = document.getElementById('bsheet');
  if (sheet) sheet.classList.add('exp');
}

function clearStop() { selStop = null; render(); }                 // 返回 / back
function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); render(); }  // 收藏/取消

// Search
// Key fix: typing now auto-switches to the Stops tab and filters live, from any tab.
function onSearch(val) {
  searchQuery = (val == null ? (document.getElementById('sbSearch')?.value || '') : val).toString();
  // keep both search inputs in sync
  ['sbSearch', 'topSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== searchQuery) el.value = searchQuery;
  });
  if (searchQuery.trim() && activeTab !== 'stops') { activeTab = 'stops'; selStop = null; syncTabUI(); }
  render();
  // open drawer so results are visible
  if (searchQuery.trim() && window.innerWidth < 1024) openDrawer();
}

// Click a route → fit map to it.
function highlightRoute(rid) {
  const route = routeById(rid); if (!route) return;
  const coords = route.stopIds.map(id => { const s = stopById(id); return s ? [s.lat, s.lng] : null; }).filter(Boolean);
  if (coords.length) map.fitBounds(coords, { padding:[50,50] });
}


function render() {
  const html = buildHTML();
  const sb = document.getElementById('sbBody'); if (sb) sb.innerHTML = html;   
  const bs = document.getElementById('bsBody'); if (bs) bs.innerHTML = html;   
}

// Pick which view to show based on state.
function buildHTML() {
  if ((activeTab === 'nearby' || activeTab === 'stops') && selStop !== null) return etaHTML();
  if (activeTab === 'nearby')    return nearbyHTML();
  if (activeTab === 'stops')     return stopsHTML();
  if (activeTab === 'routes')    return routesHTML();
  if (activeTab === 'favorites') return favsHTML();
  return '';
}

// Section label。
const sectionLabel = t => `<p class="mt-3.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted first:mt-0">${t}</p>`;

// Nearby tab
function nearbyHTML() {
  return `${sectionLabel('Quick Access')}
  <div class="mb-1 grid grid-cols-2 gap-2.5">
    <div onclick="switchTab('favorites')" class="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-transparent bg-canvas p-4 transition hover:border-brand-blue hover:shadow-tiny">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-brand-purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <span class="text-[13px] font-semibold">My Favorites</span>
    </div>
    <div onclick="switchTab('routes')" class="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-transparent bg-canvas p-4 transition hover:border-brand-blue hover:shadow-tiny">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1f2] text-brand-red"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17h2a2 2 0 0 0 0-4H5l-2-6h14l1 3"/><path d="M14 17h6"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="17.5" cy="17" r="1.5"/></svg></div>
      <span class="text-[13px] font-semibold">All Routes</span>
    </div>
  </div>
  ${sectionLabel('Nearby Stops')}
  ${STOPS.slice(0,5).map((s,i) => stopCard(s, `${(i*.11+.08).toFixed(2)} km`)).join('')}`;
}

// Stops tab
function stopsHTML() {
  const q = searchQuery.toLowerCase();
  const list = q
    ? STOPS.filter(s => String(s.id).includes(q) || s.name.toLowerCase().includes(q) || s.routes.some(r => r.toLowerCase().includes(q)))
    : STOPS;
  if (!list.length) return emptyState('search', 'No stops found', 'Try a different stop number or name.');
  return `${sectionLabel(`All Stops (${list.length})`)}${list.map(s => stopCard(s)).join('')}`;
}

// One stop card。
function stopCard(s, dist = '') {
  const isSel = selStop === s.id, isFav = favs.has(s.id);
  return `<div onclick="selectStop(${s.id})"
    class="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] ${isSel ? 'border-navy shadow-tiny' : 'border-line'} bg-white p-3 transition hover:border-navy hover:shadow-tiny">
    <div class="flex h-9 w-9 min-w-9 items-center justify-center rounded-full bg-navy text-white">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
    </div>
    <div class="flex-1">
      <div class="text-[13px] font-bold text-navy">Stop ${s.id}</div>
      <div class="mt-0.5 text-xs leading-snug text-muted">${s.name}</div>
      <div class="mt-1.5 flex flex-wrap gap-1">
        ${s.routes.slice(0,5).map(r => `<span class="rounded-full border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold">${r}</span>`).join('')}
        ${s.routes.length > 5 ? `<span class="rounded-full border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold">+${s.routes.length-5}</span>` : ''}
      </div>
      ${dist ? `<div class="mt-1 text-[11px] font-semibold text-brand-blue">${dist} away</div>` : ''}
    </div>
    <button onclick="event.stopPropagation();toggleFav(${s.id})" aria-label="Favorite" class="shrink-0 p-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? '#f59f00' : 'none'}" stroke="${isFav ? '#f59f00' : '#d1d5db'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    </button>
  </div>`;
}

// ETA view
function etaHTML() {
  const s = stopById(selStop); if (!s) return '';
  // Calculation of ETA
  const arrivals = [];
  BUSES.forEach(bus => {
    if (!bus.route.stopIds.includes(s.id)) return;
    const eta = etaMin(bus, s.id); if (eta === null) return;
    const pos = busPos(bus);
    arrivals.push({ bus, eta, route:bus.route, toStop: pos ? pos.toStop : null });
  });
  arrivals.sort((a,b) => a.eta - b.eta);

  const rows = arrivals.map(a => etaRow(a)).join('') ||
    `<div class="p-4 text-center text-[13px] text-muted">No buses approaching</div>`;

  // Routes serving this stop.
  const routeItems = s.routes.map(rid => {
    const r = routeById(rid);
    return `<div onclick="${r ? `highlightRoute('${rid}')` : ''}" class="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white p-3 transition hover:border-navy">
      <div class="flex h-11 w-11 items-center justify-center rounded-[10px] text-sm font-bold text-white" style="background:${r ? r.color : '#9ca3af'}">${rid}</div>
      <div class="flex-1"><div class="text-[13px] font-semibold">${r ? r.name : 'Route '+rid}</div><div class="mt-0.5 text-[11px] text-muted">${r ? r.stopIds.length+' stops' : '—'}</div></div>
    </div>`;
  }).join('');

  return `
  <div class="mb-2.5 flex items-center gap-2">
    <button onclick="clearStop()" class="flex items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-canvas px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>Back
    </button>
    <span class="text-xs font-medium text-muted">Stop ${s.id}</span>
  </div>
  <div class="mb-3 overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
    <div class="flex items-center gap-2.5 bg-navy px-4 py-3.5">
      <div><div class="text-[15px] font-bold text-white">Stop ${s.id}</div><div class="mt-0.5 text-[11px] text-white/70">${s.name}</div></div>
      <button onclick="toggleFav(${s.id})" class="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/15" style="color:${favs.has(s.id) ? '#f59f00' : '#fff'}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${favs.has(s.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    </div>
    <div id="etaList" class="py-1">${rows}</div>
  </div>
  ${sectionLabel('Routes at this stop')}
  ${routeItems}`;
}

// One ETA row
function etaRow({ bus, eta, route, toStop }) {
  return `<div class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
    <div class="min-w-10 rounded-md px-1.5 py-1 text-center text-xs font-bold text-white" style="background:${route.color}">${route.id}</div>
    <div class="flex-1">
      <div class="text-[13px] font-medium">${route.name}</div>
      <div class="mt-px text-[11px] text-muted">Bus ${bus.id}${toStop ? ` · toward ${toStop.name.split(',')[0]}` : ''}</div>
    </div>
    <div class="min-w-10 text-right">${
      eta <= 1
        ? `<div class="text-xs font-bold text-brand-red">Due</div>`
        : `<div class="text-[19px] font-bold leading-none text-navy">${eta}</div><div class="text-[10px] text-muted">min</div>`
    }</div>
  </div>`;
}

// Routes tab。
function routesHTML() {
  return `${sectionLabel('All Routes')}
  ${ROUTES.map(r => `<div onclick="highlightRoute('${r.id}')" class="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white p-3 transition hover:border-navy">
    <div class="flex h-11 w-11 items-center justify-center rounded-[10px] text-sm font-bold text-white" style="background:${r.color}">${r.id}</div>
    <div class="flex-1"><div class="text-[13px] font-semibold">${r.name}</div><div class="mt-0.5 text-[11px] text-muted">${r.stopIds.length} stops</div></div>
    <div class="text-right text-[11px] text-muted">Every <strong class="text-navy">${r.freq}</strong> min</div>
  </div>`).join('')}`;
}

// Favorites tab。
function favsHTML() {
  if (!favs.size) return emptyState('star', 'No favorites yet', 'Tap the star on any stop to save it here.');
  return `${sectionLabel('Saved Stops')}${STOPS.filter(s => favs.has(s.id)).map(s => stopCard(s)).join('')}`;
}

// Empty state（
function emptyState(icon, title, desc) {
  const svg = icon === 'search'
    ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
    : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return `<div class="px-5 py-10 text-center text-muted">
    <div class="mb-3 flex justify-center text-line">${svg}</div>
    <h3 class="mb-1 text-sm font-semibold text-ink">${title}</h3>
    <p class="text-xs">${desc}</p>
  </div>`;
}

// Update ETA rows in place (cheap, no full re-render).
function liveETA() {
  const lists = document.querySelectorAll('#etaList');
  if (!lists.length || selStop === null) return;
  const s = stopById(selStop); if (!s) return;
  const arrivals = [];
  BUSES.forEach(bus => {
    if (!bus.route.stopIds.includes(s.id)) return;
    const eta = etaMin(bus, s.id); if (eta === null) return;
    const pos = busPos(bus);
    arrivals.push({ bus, eta, route:bus.route, toStop: pos ? pos.toStop : null });
  });
  arrivals.sort((a,b) => a.eta - b.eta);
  const rows = arrivals.map(a => etaRow(a)).join('') ||
    `<div class="p-4 text-center text-[13px] text-muted">No buses approaching</div>`;
  lists.forEach(el => el.innerHTML = rows);
}



function setupToggle() {
  document.getElementById('openSb').onclick  = openDrawer;   
  document.getElementById('closeSb').onclick = closeDrawer; 
  document.getElementById('overlay').onclick = closeDrawer;  
}


function setupSheet() {
  const sh = document.getElementById('bsheet');
  const h  = document.getElementById('bsHandle');
  if (!sh || !h) return;
  h.addEventListener('click', () => sh.classList.toggle('exp'));
  let sy = 0;
  h.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive:true });
  h.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - sy;
    if (dy < -30) sh.classList.add('exp');        
    else if (dy > 30) sh.classList.remove('exp'); 
  }, { passive:true });
}


function setupTabs() {
  document.querySelectorAll('.tab-btn,.bn-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

function setupMapButtons() {
  const zin = document.getElementById('zinBtn');
  const zout = document.getElementById('zoutBtn');
  const loc = document.getElementById('locBtn');

  if (!map) {
    console.error('Map not ready yet');
    return;
  }

  zin?.addEventListener('click', () => map.zoomIn());
  zout?.addEventListener('click', () => map.zoomOut());
  loc?.addEventListener('click', () => {
    map.flyTo([3.1490, 101.7050], 16, { duration: 0.8 });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();                      
  setupToggle();                 
  setupSheet();                   
  setupTabs();                     
  setupMapButtons();   // ✅ ADD THIS LINE
  render();                      
  requestAnimationFrame(tick);    
});
