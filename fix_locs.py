with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ── Admin edit row: replace Location 2 grid (3-col) with 2-row layout + phone ──
old_loc2 = (
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">'
    '<div>${lbl("Location 2 County")}<select class="esel" id="ei-loc2county-${e.id}">'
    '<option value="">None</option>'
    '<option value="Atlantic County">Atlantic County</option>'
    '<option value="Cape May County">Cape May County</option>'
    '</select></div>'
    '<div>${lbl("Location 2 Town")}<input class="einput" id="ei-loc2town-${e.id}" value="${(e.locations&&e.locations[0]&&e.locations[0].town)||\'\'}" placeholder="e.g. Ocean City"></div>'
    '<div>${lbl("Location 2 Address")}<input class="einput" id="ei-loc2addr-${e.id}" value="${(e.locations&&e.locations[0]&&e.locations[0].address)||\'\'}" placeholder="e.g. 456 Shore Rd"></div>'
    '</div>'
)
new_loc2 = (
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
)

# ── Admin edit row: replace Location 3 grid ──
old_loc3 = (
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
    '<div>${lbl("Location 3 County")}<select class="esel" id="ei-loc3county-${e.id}">'
    '<option value="">None</option>'
    '<option value="Atlantic County">Atlantic County</option>'
    '<option value="Cape May County">Cape May County</option>'
    '</select></div>'
    '<div>${lbl("Location 3 Town")}<input class="einput" id="ei-loc3town-${e.id}" value="${(e.locations&&e.locations[1]&&e.locations[1].town)||\'\'}" placeholder="e.g. Cape May"></div>'
    '<div>${lbl("Location 3 Address")}<input class="einput" id="ei-loc3addr-${e.id}" value="${(e.locations&&e.locations[1]&&e.locations[1].address)||\'\'}" placeholder="e.g. 789 Ocean Ave"></div>'
    '</div>'
)
new_loc3 = (
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
)

if old_loc2 in c:
    c = c.replace(old_loc2, new_loc2)
    print('Location 2 replaced OK')
else:
    print('ERROR: Location 2 block not found')

if old_loc3 in c:
    c = c.replace(old_loc3, new_loc3)
    print('Location 3 replaced OK')
else:
    print('ERROR: Location 3 block not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
