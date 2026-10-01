with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ── 1. Featured card: remove inline phone (phone is in the modal) ──
old_feat_ph = (
    '</a>${e.phone?` · <a href="tel:${e.phone.replace(/\\D/g,\'\')}" '
    'onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none">${e.phone}</a>`:\'\'}'
    '</div>${locsMore(e)}'
)
new_feat_ph = '</a></div>${locsMore(e)}'

if old_feat_ph in c:
    c = c.replace(old_feat_ph, new_feat_ph)
    print('Featured card phone removed: OK')
else:
    print('ERROR: featured card phone pattern not found')

# ── 2. Local card: add onclick, strip inline phone, add hidden phone reveal ──
old_loc = (
    '`<div class="local-card">'
    '${bizIcon(e,\'li-icon\')}<div><p class="li-name">${e.bname}</p>'
    '<p class="li-cat">${cap(e.cat)} · ${e.county.replace(\' County\',\'\')}</p>'
    '${e.address ? `<p class="li-cat" style="margin-top:1px">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none">'
    '${esc(e.address)}, ${e.town}</a>'
    '${e.phone?` · <a href="tel:${e.phone.replace(/\\D/g,\'\')}" '
    'onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none">${e.phone}</a>`:\'\'}'
    '</p>` : \'\'}'
    '${e.address?\'\':(e.phone?`<div class="fc-foot"><i class="ti ti-phone"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}">${e.phone}</a></div>`:\'\')'
    '}'
    '${locsMore(e)}'
)
new_loc = (
    '`<div class="local-card" onclick="togCardPh(this,event)" style="cursor:pointer">'
    '${bizIcon(e,\'li-icon\')}<div><p class="li-name">${e.bname}</p>'
    '<p class="li-cat">${cap(e.cat)} · ${e.county.replace(\' County\',\'\')}</p>'
    '${e.address ? `<p class="li-cat" style="margin-top:1px">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none">'
    '${esc(e.address)}, ${e.town}</a>'
    '</p>` : \'\'}'
    '${locsMore(e)}'
    '${e.phone?`<div class="locs-drop-row card-ph" style="display:none">'
    '<i class="ti ti-phone" style="font-size:11px;opacity:.45;flex-shrink:0"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}" onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none;font-size:12px">${e.phone}</a>'
    '</div>`:\'\'}'
)

if old_loc in c:
    c = c.replace(old_loc, new_loc)
    print('Local card phone toggle: OK')
else:
    print('ERROR: local card pattern not found')
    # debug: find where it diverges
    idx = c.find('`<div class="local-card">')
    if idx >= 0:
        print('local-card found at', idx)
        snippet = c[idx:idx+400]
        print(repr(snippet))

# ── 3. locsMore: add hidden phone row below each address row ──
old_locs_row = (
    '    return `<div class="locs-drop-row"><i class="ti ti-map-pin"></i>'
    '<a href="${url}" target="_blank">'
    '${l.address ? esc(l.address)+\', \' : \'\'}'
    '${l.town}${l.county ? \' \xb7 \'+l.county.replace(\' County\',\'\') : \'\'}'
    '</a>'
    '${l.phone ? `<span style="color:#555;margin-left:6px">'
    '\xb7 <a href="tel:${l.phone.replace(/\\D/g,\'\')}" '
    'onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none">'
    '${l.phone}</a></span>` : \'\'}'
    '</div>`;\n'
)
new_locs_row = (
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

if old_locs_row in c:
    c = c.replace(old_locs_row, new_locs_row)
    print('locsMore phone rows hidden: OK')
else:
    print('ERROR: locsMore row pattern not found - trying alt search')
    idx = c.find('locs-drop-row')
    print('locs-drop-row at index:', idx)
    if idx >= 0:
        print(repr(c[idx-20:idx+200]))

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
