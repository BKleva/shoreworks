# -*- coding: utf-8 -*-
with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

results = []

def rep(label, old, new):
    global c
    if old in c:
        c = c.replace(old, new)
        results.append(f'OK  {label}')
    else:
        results.append(f'ERR {label} — pattern not found')

# ── 1. CSS: remove locs-* classes ──
rep('CSS locs classes',
    '.locs-more-btn{font-size:11px;font-weight:600;color:#1A6B8A;cursor:pointer;user-select:none;white-space:nowrap}\n'
    '.locs-more-btn:hover{text-decoration:underline}\n'
    '.locs-drop{padding-top:4px}\n'
    '.locs-drop-row{display:flex;align-items:center;gap:5px;font-size:12px;color:#555;margin-top:3px}\n'
    '.locs-drop-row i{font-size:13px;opacity:.45;flex-shrink:0}\n'
    '.locs-drop-row a{color:#1A6B8A;text-decoration:none}\n',
    '')

# ── 2. JS: remove togLocs function ──
rep('togLocs function',
    'function togLocs(id, el) {\n'
    '  const d = document.getElementById(id); if (!d) return;\n'
    '  const open = d.style.display !== \'none\';\n'
    '  d.style.display = open ? \'none\' : \'\';\n'
    '  if (el) el.textContent = open ? el.dataset.closed : \'less ↑\';\n'
    '}',
    '')

# ── 3. JS: remove locsMore function ──
rep('locsMore function',
    'function locsMore(e, hidePh) {\n'
    '  const locs = (e.locations || []).filter(l => l.town);\n'
    '  if (!locs.length) return \'\';\n'
    '  const rows = locs.map(l => {\n'
    '    const url = \'https://www.google.com/maps/search/?api=1&query=\' + encodeURIComponent([l.address,l.town,l.county,\'NJ\'].filter(Boolean).join(\', \'));\n'
    '    return `<div class="locs-drop-row"><i class="ti ti-map-pin"></i>'
    '<a href="${url}" target="_blank">'
    '${l.address ? esc(l.address)+\', \' : \'\'}'
    '${l.town}${l.county ? \' \xb7 \'+l.county.replace(\' County\',\'\') : \'\'}'
    '</a></div>'
    '${l.phone ? (hidePh ? `<div class="locs-drop-row card-ph" style="display:none;padding-left:18px">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${l.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">'
    '${l.phone}</a></div>` : `<div class="locs-drop-row" style="padding-left:18px">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${l.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">'
    '${l.phone}</a></div>`) : \'\'}'
    '`;\n'
    '  }).join(\'\');\n'
    '  return rows;\n'
    '}',
    '')

# ── 4. Spotlight card: remove locsMore call ──
rep('Spotlight locsMore call',
    '${e.town}</span>${locsMore(e)}${e.hours?',
    '${e.town}</span>${e.hours?')

# ── 5. Featured card: remove card-ph phone div (switch to fc-foot) + remove locsMore(e,true) ──
rep('Featured card-ph + locsMore',
    '${e.phone?`<div class="locs-drop-row card-ph" style="display:none">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">${e.phone}</a>'
    '</div>`:\'\'}'
    '${locsMore(e,true)}',
    '${e.phone?`<div class="fc-foot card-ph" style="display:none">'
    '<i class="ti ti-phone"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()">${e.phone}</a>'
    '</div>`:\'\'}'
)

# ── 6. Local card: remove locsMore call ──
rep('Local card locsMore call',
    '` : \'\'}${locsMore(e)}${e.phone?`<div class="fc-foot">',
    '` : \'\'}${e.phone?`<div class="fc-foot">')

# ── 7. Featured modal: remove e.locations extra locations line ──
old_modal_locs = (
    '\n    ${(e.locations||[]).filter(l=>l.town).map(l=>`<div class="fm-row">'
    '<i class="ti ti-map-pin" style="opacity:.5"></i>'
    '<a href="${\'https://www.google.com/maps/search/?api=1&query=\'+encodeURIComponent([l.address,l.town,l.county,\'NJ\'].filter(Boolean).join(\', \'))}" target="_blank">'
    '${l.address?esc(l.address)+\', \':\'\'}${l.town}${l.county?\' — \'+l.county:\'\'}'
    '</a></div>'
    '${l.phone?`<div class="fm-row"><i class="ti ti-phone" style="opacity:.5"></i>'
    '<a href="tel:${l.phone.replace(/\\D/g,\'\')}">${l.phone}</a></div>`:\'\'}'
    '`).join(\'\')}'
)
rep('Featured modal locations section', old_modal_locs, '')

# ── 8. showDetail sidebar: simplify Location label + remove extra locs map ──
old_sidebar_locs = (
    'Location${(e.locations||[]).filter(l=>l.town).length?\'s\':\'\'}'
    '</span><span class="det-sidebar-val">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none;display:block">'
    '${e.address?esc(e.address)+\'<br>\':\'\'}${e.town} \xb7 ${e.county} '
    '<i class="ti ti-external-link" style="font-size:11px"></i></a>'
    '${(e.locations||[]).filter(l=>l.town).map(l=>`<a href="${\'https://www.google.com/maps/search/?api=1&query=\'+encodeURIComponent([l.address,l.town,l.county,\'NJ\'].filter(Boolean).join(\', \'))}" target="_blank" style="color:#1A6B8A;text-decoration:none;display:block;margin-top:6px">'
    '${l.address?esc(l.address)+\'<br>\':\'\'}${l.town}${l.county?\' \xb7 \'+l.county:\'\'} '
    '<i class="ti ti-external-link" style="font-size:11px"></i></a>'
    '${l.phone?`<a href="tel:${l.phone.replace(/\\D/g,\'\')}" style="color:#1A6B8A;text-decoration:none;display:block;font-size:12px;margin-top:2px">${l.phone}</a>`:\'\'}'
    '`).join(\'\')}</span></div>`'
)
new_sidebar_locs = (
    'Location'
    '</span><span class="det-sidebar-val">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none;display:block">'
    '${e.address?esc(e.address)+\'<br>\':\'\'}${e.town} \xb7 ${e.county} '
    '<i class="ti ti-external-link" style="font-size:11px"></i></a>'
    '</span></div>`'
)
rep('showDetail sidebar locations', old_sidebar_locs, new_sidebar_locs)

# ── 9. Admin edit row: replace "Additional Locations" section with linked_to field ──
old_admin_locs = (
    '<div style="border-top:1px solid #EEE;padding-top:12px;margin-top:4px">'
    '<div style="font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Additional Locations</div>'
    '<div style="margin-bottom:10px">'
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">'
    '<div>${lbl("Location 2 County")}<select class="esel" id="ei-loc2county-${e.id}">'
    '<option value="">None</option>'
    '<option value="Atlantic County">Atlantic County</option>'
    '<option value="Cape May County">Cape May County</option>'
    '</select></div>'
    '<div>${lbl("Location 2 Town")}<input class="einput" id="ei-loc2town-${e.id}" value="${(e.locations&&e.locations[0]&&e.locations[0].town)||\'\'}" placeholder="e.g. Ocean City"></div>'
    '<div>${lbl("Location 2 Phone")}<input class="einput" id="ei-loc2phone-${e.id}" value="${(e.locations&&e.locations[0]&&e.locations[0].phone)||\'\'}" placeholder="e.g. (609) 555-0100"></div>'
    '</div>'
    '<div>${lbl("Location 2 Address (optional)")}<input class="einput" id="ei-loc2addr-${e.id}" value="${(e.locations&&e.locations[0]&&e.locations[0].address)||\'\'}" placeholder="e.g. 456 Shore Rd"></div>'
    '</div>'
    '<div>'
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">'
    '<div>${lbl("Location 3 County")}<select class="esel" id="ei-loc3county-${e.id}">'
    '<option value="">None</option>'
    '<option value="Atlantic County">Atlantic County</option>'
    '<option value="Cape May County">Cape May County</option>'
    '</select></div>'
    '<div>${lbl("Location 3 Town")}<input class="einput" id="ei-loc3town-${e.id}" value="${(e.locations&&e.locations[1]&&e.locations[1].town)||\'\'}" placeholder="e.g. Cape May"></div>'
    '<div>${lbl("Location 3 Phone")}<input class="einput" id="ei-loc3phone-${e.id}" value="${(e.locations&&e.locations[1]&&e.locations[1].phone)||\'\'}" placeholder="e.g. (609) 555-0200"></div>'
    '</div>'
    '<div>${lbl("Location 3 Address (optional)")}<input class="einput" id="ei-loc3addr-${e.id}" value="${(e.locations&&e.locations[1]&&e.locations[1].address)||\'\'}" placeholder="e.g. 789 Ocean Ave"></div>'
    '</div>'
    '</div>'
)
new_admin_locs = (
    '<div style="border-top:1px solid #EEE;padding-top:12px;margin-top:4px">'
    '<div>${lbl("Link to listing ID")}'
    '<input class="einput" id="ei-linkedto-${e.id}" type="number" '
    'value="${e.linked_to||\'\'}" placeholder="Pair with another listing\'s ID"></div>'
    '</div>'
)
rep('Admin edit locations → linked_to', old_admin_locs, new_admin_locs)

# ── 10. saveEd: replace locations line with linked_to ──
rep('saveEd locations → linked_to',
    "    locations:   [{county:document.getElementById('ei-loc2county-'+id)?.value||'',town:document.getElementById('ei-loc2town-'+id)?.value.trim()||'',address:document.getElementById('ei-loc2addr-'+id)?.value.trim()||'',phone:document.getElementById('ei-loc2phone-'+id)?.value.trim()||''},{county:document.getElementById('ei-loc3county-'+id)?.value||'',town:document.getElementById('ei-loc3town-'+id)?.value.trim()||'',address:document.getElementById('ei-loc3addr-'+id)?.value.trim()||'',phone:document.getElementById('ei-loc3phone-'+id)?.value.trim()||''}].filter(l=>l.town)||null",
    "    linked_to:   parseInt(document.getElementById('ei-linkedto-'+id)?.value)||null")

# ── 11. Signup form JS: remove suExtraLocs state + functions ──
rep('suExtraLocs state',
    '// ---- extra locations (signup form) ----\n'
    'let suExtraLocs = [];\n'
    'function addSuLoc() {\n'
    '  if (suExtraLocs.length >= 4) return;\n'
    '  suExtraLocs.push({address:\'\',town:\'\',county:\'\'});\n'
    '  renderSuLocs();\n'
    '}\n'
    'function removeSuLoc(i) {\n'
    '  suExtraLocs.splice(i, 1);\n'
    '  renderSuLocs();\n'
    '}\n'
    'function renderSuLocs() {\n'
    '  const coOpts = [\'Atlantic County\',\'Cape May County\'].map(c=>`<option value="${c}">${c}</option>`).join(\'\');\n'
    '  document.getElementById(\'su-extra-locs\').innerHTML = suExtraLocs.map((loc,i)=>`\n'
    '    <div style="border:1px solid #DDD8CE;border-radius:10px;padding:12px;margin-bottom:8px;background:#FAF8F4">\n'
    '      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">\n'
    '        <span style="font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.08em">Location ${i+2}</span>\n'
    '        <span style="font-size:11px;color:#C03030;cursor:pointer;text-decoration:underline" onclick="removeSuLoc(${i})">Remove</span>\n'
    '      </div>\n'
    '      <div class="frow">\n'
    '        <div class="fg"><label class="flbl">County *</label><select class="fsel" id="el-county-${i}"><option value="">Select…</option>${coOpts}</select></div>\n'
    '        <div class="fg"><label class="flbl">Town *</label><input class="finput" id="el-town-${i}" type="text" placeholder="e.g. Ocean City" value="${esc(loc.town||\'\')}"></div>\n'
    '      </div>\n'
    '      <div class="frow">\n'
    '        <div class="fg"><label class="flbl">Street address <span style="color:#555;text-transform:none;font-weight:400">(optional)</span></label><input class="finput" id="el-address-${i}" type="text" placeholder="e.g. 456 Shore Rd" value="${esc(loc.address||\'\')}"></div>\n'
    '        <div class="fg"><label class="flbl">Phone <span style="color:#555;text-transform:none;font-weight:400">(optional)</span></label><input class="finput" id="el-phone-${i}" type="tel" placeholder="e.g. (609) 555-0100" value="${esc(loc.phone||\'\')}"></div>\n'
    '      </div>\n'
    '    </div>\n'
    '  \`).join(\'\');\n'
    '  document.getElementById(\'su-add-loc-btn\').style.display = suExtraLocs.length >= 4 ? \'none\' : \'\';\n'
    '}',
    '')

# ── 12. startSignup: remove renderSuLocs() call ──
rep('startSignup renderSuLocs call',
    'suExtraLocs = []; renderSuLocs();\n',
    '')

# ── 13. submitSu: remove locations line ──
rep('submitSu locations line',
    '    locations:   suExtraLocs.length ? suExtraLocs.map((_,i)=>({address:document.getElementById(\'el-address-\'+i)?.value.trim()||\'\',town:document.getElementById(\'el-town-\'+i)?.value.trim()||\'\',county:document.getElementById(\'el-county-\'+i)?.value||\'\',phone:document.getElementById(\'el-phone-\'+i)?.value.trim()||\'\'}))\n'
    '                         .filter(l=>l.town) : null,\n',
    '')

# ── 14. Signup HTML: remove su-extra-locs div + add button ──
rep('Signup HTML extra locs + button',
    '\n        <div id="su-extra-locs"></div>\n'
    '        <div style="margin-top:-4px;margin-bottom:12px">'
    '<span class="btn btn-sec" id="su-add-loc-btn" onclick="addSuLoc()" style="font-size:11px;padding:6px 14px">'
    '<i class="ti ti-plus"></i> Add another location</span></div>',
    '')

# ── 15. renderDir: wrap tier arrays with pairLinked ──
rep('renderDir pairLinked wrapping',
    '  const spots  = shuffle(all.filter(e => e.plan === \'spotlight\'), daySeed);\n'
    '  const feats  = shuffle(all.filter(e => e.plan === \'featured\'),  daySeed+1);\n'
    '  const locals = shuffle(all.filter(e => e.plan === \'local\'),     daySeed+2);',
    '  const spots  = pairLinked(shuffle(all.filter(e => e.plan === \'spotlight\'), daySeed));\n'
    '  const feats  = pairLinked(shuffle(all.filter(e => e.plan === \'featured\'),  daySeed+1));\n'
    '  const locals = pairLinked(shuffle(all.filter(e => e.plan === \'local\'),     daySeed+2));')

# ── 16. Add pairLinked function after mapsUrl ──
old_mapsurl_end = 'function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : \'\'; }'
new_mapsurl_end = (
    'function pairLinked(arr) {\n'
    '  const used = new Set(), out = [];\n'
    '  for (const e of arr) {\n'
    '    if (used.has(e.id)) continue;\n'
    '    out.push(e); used.add(e.id);\n'
    '    if (e.linked_to) { const p = arr.find(x => x.id === e.linked_to); if (p && !used.has(p.id)) { out.push(p); used.add(p.id); } }\n'
    '  }\n'
    '  for (const e of arr) { if (!used.has(e.id)) out.push(e); }\n'
    '  return out;\n'
    '}\n'
    'function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : \'\'; }'
)
rep('Add pairLinked function', old_mapsurl_end, new_mapsurl_end)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)

for r in results:
    print(r)
print('Done')
