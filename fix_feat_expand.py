with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ── 1. Featured card: add togCardPh to onclick ──
old_feat_onclick = 'feat-card" onclick="featCardClick(event,${e.id})">'
new_feat_onclick = 'feat-card" onclick="featCardClick(event,${e.id});togCardPh(this,event)">'

if old_feat_onclick in c:
    c = c.replace(old_feat_onclick, new_feat_onclick)
    print('Featured card onclick updated: OK')
else:
    print('ERROR: featured card onclick not found')

# ── 2. Featured card: add hidden primary phone row + switch to locsMore(e,true) ──
old_feat_locs = '</a></div>${locsMore(e)} ${e.email?'
new_feat_locs = (
    '</a></div>'
    '${e.phone?`<div class="locs-drop-row card-ph" style="display:none">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">${e.phone}</a>'
    '</div>`:\'\'}'
    '${locsMore(e,true)} ${e.email?'
)

if old_feat_locs in c:
    c = c.replace(old_feat_locs, new_feat_locs)
    print('Featured card phone row + locsMore(e,true): OK')
else:
    print('ERROR: featured card locsMore section not found')

# ── 3. Local card: remove onclick + cursor, revert phone to visible fc-foot row ──
old_local_onclick = 'local-card" onclick="togCardPh(this,event)" style="cursor:pointer">'
new_local_onclick = 'local-card">'

if old_local_onclick in c:
    c = c.replace(old_local_onclick, new_local_onclick)
    print('Local card onclick removed: OK')
else:
    print('ERROR: local card onclick not found')

# Remove hidden phone row from local card + restore visible phone after locsMore
old_local_ph = (
    '${e.address ? `<p class="li-cat" style="margin-top:1px">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none">'
    '${esc(e.address)}, ${e.town}</a></p>` : \'\'}'
    '${e.phone?`<div class="locs-drop-row card-ph" style="display:none">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">${e.phone}</a>'
    '</div>`:\'\'}'
    '${locsMore(e)}'
)
new_local_ph = (
    '${e.address ? `<p class="li-cat" style="margin-top:1px">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none">'
    '${esc(e.address)}, ${e.town}</a></p>` : \'\'}'
    '${locsMore(e)}'
    '${e.phone?`<div class="fc-foot"><i class="ti ti-phone"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}">${e.phone}</a></div>`:\'\'}'
)

if old_local_ph in c:
    c = c.replace(old_local_ph, new_local_ph)
    print('Local card phone restored visible: OK')
else:
    print('ERROR: local card phone pattern not found')

# ── 4. locsMore: add hidePh param + conditional phone display ──
old_locs_fn = 'function locsMore(e) {'
new_locs_fn = 'function locsMore(e, hidePh) {'

if old_locs_fn in c:
    c = c.replace(old_locs_fn, new_locs_fn)
    print('locsMore param added: OK')
else:
    print('ERROR: locsMore function signature not found')

old_locs_row = (
    '    return `<div class="locs-drop-row"><i class="ti ti-map-pin"></i>'
    '<a href="${url}" target="_blank">'
    '${l.address ? esc(l.address)+\', \' : \'\'}'
    '${l.town}${l.county ? \' \xb7 \'+l.county.replace(\' County\',\'\') : \'\'}'
    '</a></div>'
    '${l.phone ? `<div class="locs-drop-row card-ph" style="display:none;padding-left:18px">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${l.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">'
    '${l.phone}</a></div>` : \'\'}'
    '`;\n'
)
new_locs_row = (
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
)

if old_locs_row in c:
    c = c.replace(old_locs_row, new_locs_row)
    print('locsMore conditional phone: OK')
else:
    print('ERROR: locsMore row pattern not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
