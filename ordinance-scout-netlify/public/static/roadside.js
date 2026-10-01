/* Roadside Map tab: parcels within N feet of NJ state highways (GSP excluded, vacant/commercial/industrial only).
   Everything is filtered in the browser (distance, type, highway, email, map view) so it is instant.
   The table lists the parcels visible in the map; business names/emails load on demand for the area being viewed. */
(() => {
  const COLORS = { "1": "#f59e0b", "4A": "#2f6fed", "4B": "#8b5cf6" };
  const LEGEND = [["Vacant", "#f59e0b"], ["Commercial", "#2f6fed"], ["Industrial", "#8b5cf6"], ["State highway", "#ffe14d"]];
  const PAGE = 300;
  let map, roadLayer, parcelLayer, inited = false, cfg = null, polling = false;
  let all = [], geo = null, layers = {}, shown = PAGE, autoTried = {}, hiKey = null, total = 0;
  let renderTimer = null, bizTimer = null, bizBusy = false, jobCounty = null;

  const q = id => document.getElementById(id);
  const val = id => q(id).value;
  const keyOf = p => p.pin + "|" + p.route;
  const addr = p => [p.mail_street, p.mail_city_state, p.mail_zip].filter(Boolean).join(", ");
  const norm = x => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const sameAsProperty = p => !!p.mail_street && norm(p.mail_street) === norm(p.prop_loc);
  // where the property tax bill is mailed (the owner's address on the tax record)
  const taxCell = p => `<td class="tax" title="${esc(addr(p))}"><b>${esc(p.mail_street || "")}</b><br>${esc([p.mail_city_state, p.mail_zip].filter(Boolean).join(" "))}`
    + `${sameAsProperty(p) ? ' <span class="tag">same as property</span>' : ""}</td>`;
  const selectedRoutes = () => [...q("rsRoutes").selectedOptions].map(o => o.value);
  const selectedClasses = () => [...document.querySelectorAll("#rsClasses input:checked")].map(i => i.value);

  // ---- filters that run locally: distance band, property type, highway, email ----
  function passes(p) {
    const min = +val("rsMin") || 0, max = +val("rsMax") || cfg.depth;
    if (p.edge_min_ft > max || p.edge_min_ft < min) return false;   // nearest edge of the parcel must sit inside the band
    if (!selectedClasses().includes(p.prop_class)) return false;
    const refs = selectedRoutes();
    if (refs.length && !p.route.split(", ").some(r => refs.includes(r))) return false;
    return true;
  }
  const filtered = () => all.filter(passes);

  const onMove = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { shown = PAGE; renderTable(); }, 150); clearTimeout(bizTimer); bizTimer = setTimeout(autoBiz, 1200); };

  function initMap() {
    map = L.map("rsMap", { zoomControl: true, preferCanvas: true }).setView([40.9, -74.1], 11);   // canvas keeps thousands of parcels fast
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }).addTo(map);
    roadLayer = L.layerGroup().addTo(map);
    parcelLayer = L.layerGroup().addTo(map);
    q("rsLegend").innerHTML = LEGEND.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
    map.on("moveend", onMove);
    window.addEventListener("resize", () => map.invalidateSize());   // keep the map filling its box
  }

  window.initRoadside = async function () {
    if (!inited) {
      inited = true;
      initMap();
      cfg = await api("/api/roadside/config");
      q("rsMax").max = cfg.depth; q("rsMax").value = cfg.depth; q("rsMaxRange").max = cfg.depth; q("rsMaxRange").value = cfg.depth;   // data is loaded to this depth
      q("rsCounty").innerHTML = cfg.counties.map(c => `<option>${esc(c)}</option>`).join("");
      q("rsClasses").innerHTML = Object.entries(cfg.classes).map(([k, v]) =>
        `<label><input type="checkbox" value="${esc(k)}" checked> ${esc(v)}</label>`).join("");
      q("rsCounty").addEventListener("change", loadCounty);
      const refilter = () => { clearTimeout(refilter.t); refilter.t = setTimeout(applyFilters, 200); };
      q("rsRoutes").addEventListener("change", () => { drawRoads(); applyFilters(); });
      ["rsMin", "rsMax"].forEach(id => q(id).addEventListener("input", () => { syncRange(id); refilter(); }));
      q("rsMaxRange").addEventListener("input", () => { q("rsMax").value = q("rsMaxRange").value; refilter(); });
      q("rsClasses").addEventListener("change", applyFilters);
      document.querySelector(".rs-presets").addEventListener("click", e => {
        const b = e.target.closest(".chip"); if (!b) return;
        const [a, z] = b.dataset.r.split(","); q("rsMin").value = a; q("rsMax").value = z; syncRange("rsMax"); applyFilters();
      });
      q("rsFetch").addEventListener("click", () => refreshCounty(false));
      q("rsInView").addEventListener("change", () => { shown = PAGE; renderTable(); });
      q("rsFilter").addEventListener("input", () => { shown = PAGE; renderTable(); });
      q("rsMore").addEventListener("click", () => { shown += PAGE; renderTable(); });
      q("rsBizNow").addEventListener("click", () => lookupBiz(true));
      q("rsTable").querySelector("tbody").addEventListener("click", e => {
        const tr = e.target.closest("tr.click"); if (tr) focusParcel(tr.dataset.k, true);
      });
      const counts = await api("/api/roadside/counts");   // open on the county that already has the most data
      const best = counts.rows.sort((a, b) => b.n - a.n)[0];
      if (best) q("rsCounty").value = best.county;
      await loadCounty();
      api("/api/roadside/status").then(st => { jobCounty = st.running ? st.county : null; if (st.running) poll(false); });
    }
    setTimeout(() => map.invalidateSize(), 60);
  };

  function syncRange(id) {
    if (id === "rsMax") q("rsMaxRange").value = Math.min(1000, +val("rsMax"));
  }

  async function loadCounty() {
    q("rsRoutes").innerHTML = "<option disabled>Loading highways…</option>";
    q("rsLog").textContent = "Loading this county's state highways…";
    try {
      let d = await api("/api/roadside/routes?county=" + encodeURIComponent(val("rsCounty")));
      if (d.loading) {   // first visit: highways and parcels are downloading in the background (about a minute)
        q("rsLog").textContent = `First load of ${val("rsCounty")} County: downloading its highways and parcels. This takes a minute or two…`;
        poll(true);
        for (let i = 0; i < 90 && d.loading; i++) { await new Promise((r) => setTimeout(r, 4000)); d = await api("/api/roadside/routes?county=" + encodeURIComponent(val("rsCounty"))); }
        if (d.loading) { q("rsLog").textContent = "Still loading. Come back in a minute and press Refresh data."; return; }
      }
      q("rsRoutes").innerHTML = d.rows.map(r => `<option value="${esc(r.ref)}">${esc(r.ref)}${r.names.length ? " · " + esc(r.names[0]) : ""}</option>`).join("");
      q("rsLog").textContent = `${d.rows.length} state highways in ${val("rsCounty")} County. Leave the list unselected to include all of them.`;
    } catch (e) { q("rsRoutes").innerHTML = ""; q("rsLog").textContent = e.message; return; }
    await drawRoads();
    await loadData(true);
    showFresh();
    if (!all.length && !autoTried[val("rsCounty")]) {   // nothing saved for this county yet: load it now, no clicking needed
      autoTried[val("rsCounty")] = true;
      const st = await api("/api/roadside/status");
      if (st.running) { jobCounty = st.county; poll(false); } else refreshCounty(true);
    }
  }

  async function drawRoads() {
    const g = await api("/api/roadside/roads?" + qs({ county: val("rsCounty"), refs: selectedRoutes().join(",") }));
    roadLayer.clearLayers();
    L.geoJSON(g, { style: { color: "#ffe14d", weight: 3, opacity: .95 } }).addTo(roadLayer)
      .bindTooltip(l => l.feature.properties.ref, { sticky: true });
    const b = L.geoJSON(g).getBounds();
    if (b.isValid()) { map.invalidateSize(); map.fitBounds(b.pad(.05)); }
  }

  // one network call per county; everything else filters this in memory
  async function loadData(fit) {
    const d = await api("/api/roadside/results?" + qs({ county: val("rsCounty"), min_ft: 0, max_ft: 1500 }));
    geo = d.features; all = geo.map(f => f.properties); total = d.total;
    q("rsExport").href = "/api/roadside/export.csv?" + qs({ county: val("rsCounty"), min_ft: 0, max_ft: 1500 });
    applyFilters(fit);
  }

  function applyFilters(fit) {
    q("rsExport").href = "/api/roadside/export.csv?" + qs({   // export exactly what the filters show
      county: val("rsCounty"), refs: selectedRoutes().join(","), min_ft: val("rsMin") || 0, max_ft: val("rsMax") || cfg.depth,
      classes: selectedClasses().join(",") });
    q("rsMail").href = "/mail.html?" + qs({ county: val("rsCounty"), refs: selectedRoutes().join(","), min_ft: val("rsMin") || 0, max_ft: val("rsMax") || cfg.depth,
      classes: selectedClasses().join(",") });   // the print page opens with the filters you have on the map
    const ok = new Set(filtered().map(keyOf));
    const feats = geo.filter(f => ok.has(keyOf(f.properties)));
    parcelLayer.clearLayers(); layers = {};
    L.geoJSON({ type: "FeatureCollection", features: feats }, {
      style: f => ({ color: "#fff", weight: 1, fillColor: COLORS[f.properties.prop_class] || "#94a3b8", fillOpacity: .55 }),
      onEachFeature: (f, layer) => {
        const p = f.properties, k = keyOf(p);
        layers[k] = layer;
        layer.bindPopup(() => popup(p));
        layer.on("click", () => { focusParcel(k, false); if (!p.biz_checked && q("rsAutoBiz").checked) lookupBiz(false, p); });
      },
    }).addTo(parcelLayer);
    if (fit === true && feats.length) { map.invalidateSize(); } if (fit === true && feats.length) map.fitBounds(L.geoJSON({ type: "FeatureCollection", features: feats }).getBounds().pad(.03));
    shown = PAGE;
    renderTable();
  }

  const popup = p => `<b>${esc(p.prop_loc || "(no address)")}</b>, ${esc(p.muni)}<br>${esc(cfg.classes[p.prop_class] || p.prop_class)} &middot; ${p.acres ? p.acres.toFixed(2) + " ac" : ""}<br>`
    + (p.businesses ? `<b>${esc(p.businesses)}</b><br>` : "") + (p.emails ? `${esc(p.emails)}<br>` : "") + (p.phones ? `${esc(p.phones)}<br>` : "")
    + (p.biz_checked ? "" : `<i>Business info not looked up yet</i><br>`)
    + `<b>Tax bill mailed to:</b> ${esc(addr(p))}${sameAsProperty(p) ? " (same as property)" : ""}<br>${Math.round(p.edge_min_ft)}–${Math.round(p.edge_max_ft)} ft from ${esc(p.route)} edge`;

  function rowsInScope() {
    let rows = filtered();
    if (q("rsInView").checked && map) {
      const b = map.getBounds();
      rows = rows.filter(p => b.contains([p.lat, p.lon]));
    }
    const t = val("rsFilter").trim().toLowerCase();
    if (t) rows = rows.filter(p => [p.muni, p.prop_loc, p.businesses, p.emails, p.mail_street, p.mail_city_state, p.mail_zip, p.route].join(" ").toLowerCase().includes(t));
    return rows;
  }

  function renderTable() {
    const rows = rowsInScope(), body = q("rsTable").querySelector("tbody"), n = filtered().length;
    q("rsCount").textContent = all.length
      ? `${rows.length.toLocaleString()} parcels ${q("rsInView").checked ? "in the map view" : "listed"} of ${n.toLocaleString()} matching`
      : "";
    const loadingHere = jobCounty === val("rsCounty") && polling && !all.length;
    body.innerHTML = rows.length ? rows.slice(0, shown).map(p => `
      <tr class="click${keyOf(p) === hiKey ? " rs-hi" : ""}" data-k="${esc(keyOf(p))}">
        <td>${esc(p.muni)}</td><td><b>${esc(p.prop_loc)}</b></td>
        ${taxCell(p)}
        <td><span class="dot" style="background:${COLORS[p.prop_class] || "#94a3b8"}"></span>${esc(cfg.classes[p.prop_class] || p.prop_class)}</td>
        <td title="${esc(p.businesses || p.fac_name || "")}">${esc(p.businesses || p.fac_name || "")}</td><td title="${esc(p.emails)}">${esc(p.emails)}</td>
        <td title="${esc([p.phones, p.websites].filter(Boolean).join(" · "))}">${esc([p.phones, p.websites].filter(Boolean).join(" · "))}</td>
        <td class="num">${p.acres ? p.acres.toFixed(2) : ""}</td><td class="num">${Math.round(p.edge_min_ft)}</td><td>${esc(p.route)}</td></tr>`).join("")
      : `<tr><td colspan="10" class="empty">${loadingHere ? "Loading this county's parcels…"
          : !all.length ? "No parcels for this county yet."
          : !n ? "No parcels match these filters. Widen the distance range or tick more property types."
          : "No parcels in this part of the map. Zoom out, or untick “only parcels in the map view”."}</td></tr>`;
    q("rsMore").hidden = rows.length <= shown;
    q("rsMore").textContent = `Show more (${(rows.length - shown).toLocaleString()} left)`;
  }

  // one parcel, seen in both places
  function focusParcel(k, fromTable) {
    hiKey = k;
    const layer = layers[k];
    if (layer) {
      Object.values(layers).forEach(l => l.setStyle({ weight: 1, color: "#fff" }));
      layer.setStyle({ weight: 3, color: "#ffe14d" }); layer.bringToFront();
      if (fromTable) {
        map.off("moveend", onMove);   // don't re-filter the table while zooming to the clicked row
        map.once("moveend", () => { map.on("moveend", onMove); onMove(); });
        map.fitBounds(layer.getBounds().pad(2), { maxZoom: 18 });
        q("rsMap").scrollIntoView({ behavior: "smooth", block: "center" });
        const p = all.find(x => keyOf(x) === k);
        if (p && !p.biz_checked && q("rsAutoBiz").checked) lookupBiz(false, p);
      }
      layer.openPopup();
    }
    document.querySelectorAll("#rsTable tbody tr.rs-hi").forEach(r => r.classList.remove("rs-hi"));
    const tr = q("rsTable").querySelector(`tbody tr[data-k="${CSS.escape(k)}"]`);
    if (tr) { tr.classList.add("rs-hi"); if (!fromTable) tr.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  // ---- business names / emails, only for where the user is looking ----
  function autoBiz() {
    if (!q("rsAutoBiz").checked || !map) return;
    const b = map.getBounds();
    if (b.getNorth() - b.getSouth() > 0.035 || b.getEast() - b.getWest() > 0.05) return;   // too zoomed out: wait for street level
    if (filtered().some(p => !p.biz_checked && b.contains([p.lat, p.lon]))) lookupBiz(false);
  }

  async function lookupBiz(manual, parcel) {
    if (bizBusy) return;
    let bbox;
    if (parcel) bbox = [parcel.lat - 0.003, parcel.lon - 0.004, parcel.lat + 0.003, parcel.lon + 0.004];
    else {
      const b = map.getBounds();
      if (b.getNorth() - b.getSouth() > 0.035 || b.getEast() - b.getWest() > 0.05) {
        if (manual) toast("Zoom in to street level first, then look up businesses for that area.");
        return;
      }
      bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    }
    bizBusy = true; q("rsBizStatus").textContent = "Looking up business names & emails for this area…";
    try {
      const { id } = await api("/api/roadside/enrich", { json: { bbox } });
      let d = { done: false };
      for (let i = 0; i < 60 && !d.done; i++) { await new Promise((r) => setTimeout(r, 2000)); d = await api("/api/roadside/enrich?id=" + id); }
      if (d.error) throw new Error(d.error);
      if (!d.done) throw new Error("The business lookup is taking too long. Try again in a moment.");
      const byPin = new Map(d.rows.map(r => [r.pin, r]));
      all.forEach(p => { const u = byPin.get(p.pin); if (u) Object.assign(p, { businesses: u.businesses || p.businesses, emails: u.emails || p.emails, phones: u.phones || p.phones, websites: u.websites || p.websites, biz_checked: 1 }); });
      const found = d.rows.filter(r => r.businesses).length;
      q("rsBizStatus").textContent = d.rows.length ? `Checked ${d.rows.length} parcels here: ${found} have a business listed, ${d.rows.filter(r => r.emails).length} with an email.` : "Business info for this area is already loaded.";
      renderTable();
      const open = layers[hiKey], cur = all.find(p => keyOf(p) === hiKey);
      if (open && cur && open.isPopupOpen()) open.getPopup().setContent(popup(cur));   // refresh the popup that was open during the lookup
    } catch (e) { q("rsBizStatus").textContent = e.message; }
    finally { bizBusy = false; }
  }

  // Refresh = reload this county's parcels from the state data. The table keeps showing the current data meanwhile.
  async function refreshCounty(auto) {
    try {
      await api("/api/roadside/search", { json: { county: val("rsCounty"), refs: [], classes: cfg.default_classes, businesses: false } });
      jobCounty = val("rsCounty");
      poll(true);
      renderTable();
    } catch (e) { if (!auto) toast(e.message); }
  }

  async function showFresh() {
    try {
      const d = await api("/api/roadside/counts");
      const row = d.rows.find(r => r.county === val("rsCounty"));
      const when = row && row.refreshed_at ? new Date(row.refreshed_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "not yet";
      q("rsFresh").textContent = `Data last refreshed: ${when}. It refreshes automatically every ${d.refresh_days} days while the app is open.`;
    } catch (e) { /* non-critical */ }
  }

  // app.js may have shown this tab (direct #roadside link) before this file loaded
  if (location.hash === "#roadside") setTimeout(() => window.initRoadside(), 0);

  async function poll(fresh) {
    if (polling) return; polling = true;
    let lastSaved = fresh ? -1 : 0, fitted = false;
    q("rsFetch").disabled = true;
    try {
      while (true) {
        const s = await api("/api/roadside/status");
        jobCounty = s.running ? s.county : null;
        q("rsLog").textContent = s.log.join("\n") || "Working…"; q("rsLog").scrollTop = 1e9;
        q("rsFetch").textContent = s.running ? `Refreshing ${s.county}… ${s.done} of ${s.total} highways` : "Refresh data";
        if (s.saved !== lastSaved && (s.saved > 0 || !fresh) && s.county === val("rsCounty")) {
          lastSaved = s.saved;
          await loadData(!fitted); fitted = true;   // show this county's parcels as they arrive
        }
        if (!s.running) { if (s.county === val("rsCounty")) await loadData(false); break; }
        await new Promise(r => setTimeout(r, 2500));
      }
    } finally { polling = false; jobCounty = null; q("rsFetch").disabled = false; q("rsFetch").textContent = "Refresh data"; showFresh(); renderTable(); }
  }
})();
