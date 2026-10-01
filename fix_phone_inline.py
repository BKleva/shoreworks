with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ── Featured card: move phone inline with address ──
old_feat = (
    '</a></div>${locsMore(e)}${e.phone?`<div class="fc-foot">'
    '<i class="ti ti-phone"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}">${e.phone}</a>'
    '</div>`:\'\'} ${e.email?'
)
new_feat = (
    '</a>${e.phone?` · <a href="tel:${e.phone.replace(/\\D/g,\'\')}" '
    'onclick="event.stopPropagation()" '
    'style="color:#1A6B8A;text-decoration:none">${e.phone}</a>`:\'\'}'
    '</div>${locsMore(e)} ${e.email?'
)

if old_feat in c:
    c = c.replace(old_feat, new_feat)
    print('Featured card phone inline: OK')
else:
    print('ERROR: featured card pattern not found')

# ── Local card: move phone inline with address ──
old_loc = (
    '${e.address ? `<p class="li-cat" style="margin-top:1px">'
    '<a href="${mapsUrl(e)}" target="_blank" style="color:#1A6B8A;text-decoration:none">'
    '${esc(e.address)}, ${e.town}</a></p>` : \'\'}'
    '${locsMore(e)}'
    '${e.phone?`<div class="fc-foot"><i class="ti ti-phone"></i>'
    '<a href="tel:${e.phone.replace(/\\D/g,\'\')}">${e.phone}</a></div>`:\'\'}'
)
new_loc = (
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

if old_loc in c:
    c = c.replace(old_loc, new_loc)
    print('Local card phone inline: OK')
else:
    print('ERROR: local card pattern not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
