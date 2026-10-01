"""Counties Outdoor Impact is scouting. County-level only for now.

_ROSTER holds municipality lists (Monmouth, Morris, Union) from an earlier pass; roster() is
turned off until town-level scouting is wanted again (set TOWN_LEVEL = True).
"""

TOWN_LEVEL = False

COUNTIES = ["Monmouth", "Ocean", "Bergen", "Morris"]

_ROSTER = {
    "Monmouth": [
        "Aberdeen Township", "Allenhurst Borough", "Allentown Borough", "Asbury Park City",
        "Atlantic Highlands Borough", "Avon-by-the-Sea Borough", "Belmar Borough",
        "Bradley Beach Borough", "Brielle Borough", "Colts Neck Township", "Deal Borough",
        "Eatontown Borough", "Englishtown Borough", "Fair Haven Borough", "Farmingdale Borough",
        "Freehold Borough", "Freehold Township", "Hazlet Township", "Highlands Borough",
        "Holmdel Township", "Howell Township", "Interlaken Borough", "Keansburg Borough",
        "Keyport Borough", "Lake Como Borough", "Little Silver Borough", "Loch Arbour Village",
        "Long Branch City", "Manalapan Township", "Manasquan Borough", "Marlboro Township",
        "Matawan Borough", "Middletown Township", "Millstone Township", "Monmouth Beach Borough",
        "Neptune City Borough", "Neptune Township", "Ocean Township", "Oceanport Borough",
        "Red Bank Borough", "Roosevelt Borough", "Rumson Borough", "Sea Bright Borough",
        "Sea Girt Borough", "Shrewsbury Borough", "Shrewsbury Township", "Spring Lake Borough",
        "Spring Lake Heights Borough", "Tinton Falls Borough", "Union Beach Borough",
        "Upper Freehold Township", "Wall Township", "West Long Branch Borough",
    ],
    "Morris": [
        "Boonton Town", "Boonton Township", "Butler Borough", "Chatham Borough",
        "Chatham Township", "Chester Borough", "Chester Township", "Denville Township",
        "Dover Town", "East Hanover Township", "Florham Park Borough", "Hanover Township",
        "Harding Township", "Jefferson Township", "Kinnelon Borough", "Lincoln Park Borough",
        "Long Hill Township", "Madison Borough", "Mendham Borough", "Mendham Township",
        "Mine Hill Township", "Montville Township", "Morris Plains Borough", "Morris Township",
        "Morristown Town", "Mount Arlington Borough", "Mount Olive Township",
        "Mountain Lakes Borough", "Netcong Borough", "Parsippany-Troy Hills Township",
        "Pequannock Township", "Randolph Township", "Riverdale Borough", "Rockaway Borough",
        "Rockaway Township", "Roxbury Township", "Victory Gardens Borough",
        "Washington Township", "Wharton Borough",
    ],
    "Ocean": [
        "Barnegat Township", "Barnegat Light Borough", "Bay Head Borough", "Beach Haven Borough",
        "Beachwood Borough", "Berkeley Township", "Brick Township", "Toms River Township",
        "Eagleswood Township", "Harvey Cedars Borough", "Island Heights Borough", "Jackson Township",
        "Lacey Township", "Lakehurst Borough", "Lakewood Township", "Lavallette Borough",
        "Little Egg Harbor Township", "Long Beach Township", "Manchester Township",
        "Mantoloking Borough", "Ocean Township", "Ocean Gate Borough", "Pine Beach Borough",
        "Plumsted Township", "Point Pleasant Borough", "Point Pleasant Beach Borough",
        "Seaside Heights Borough", "Seaside Park Borough", "Ship Bottom Borough",
        "South Toms River Borough", "Stafford Township", "Surf City Borough", "Tuckerton Borough",
    ],
    "Bergen": [
        "Allendale Borough", "Alpine Borough", "Bergenfield Borough", "Bogota Borough",
        "Carlstadt Borough", "Cliffside Park Borough", "Closter Borough", "Cresskill Borough",
        "Demarest Borough", "Dumont Borough", "East Rutherford Borough", "Edgewater Borough",
        "Elmwood Park Borough", "Emerson Borough", "Englewood City", "Englewood Cliffs Borough",
        "Fair Lawn Borough", "Fairview Borough", "Fort Lee Borough", "Franklin Lakes Borough",
        "Garfield City", "Glen Rock Borough", "Hackensack City", "Harrington Park Borough",
        "Hasbrouck Heights Borough", "Haworth Borough", "Hillsdale Borough", "Ho-Ho-Kus Borough",
        "Leonia Borough", "Little Ferry Borough", "Lodi Borough", "Lyndhurst Township",
        "Mahwah Township", "Maywood Borough", "Midland Park Borough", "Montvale Borough",
        "Moonachie Borough", "New Milford Borough", "North Arlington Borough", "Northvale Borough",
        "Norwood Borough", "Oakland Borough", "Old Tappan Borough", "Oradell Borough",
        "Palisades Park Borough", "Paramus Borough", "Park Ridge Borough", "Ramsey Borough",
        "Ridgefield Borough", "Ridgefield Park Village", "Ridgewood Village", "River Edge Borough",
        "River Vale Township", "Rochelle Park Township", "Rockleigh Borough", "Rutherford Borough",
        "Saddle Brook Township", "Saddle River Borough", "South Hackensack Township",
        "Teaneck Township", "Tenafly Borough", "Teterboro Borough", "Upper Saddle River Borough",
        "Waldwick Borough", "Wallington Borough", "Washington Township", "Westwood Borough",
        "Wood-Ridge Borough", "Woodcliff Lake Borough", "Wyckoff Township",
    ],
    "Union": [
        "Berkeley Heights Township", "Clark Township", "Cranford Township", "Elizabeth City",
        "Fanwood Borough", "Garwood Borough", "Hillside Township", "Kenilworth Borough",
        "Linden City", "Mountainside Borough", "New Providence Borough", "Plainfield City",
        "Rahway City", "Roselle Borough", "Roselle Park Borough", "Scotch Plains Township",
        "Springfield Township", "Summit City", "Union Township", "Westfield Town",
        "Winfield Township",
    ],
}


def roster():
    """Yield (name, county, kind) for every municipality."""
    if not TOWN_LEVEL:
        return
    for county, names in _ROSTER.items():
        for full in names:
            base, _, kind = full.rpartition(" ")
            if not base:
                base, kind = full, ""
            yield base, county, kind


# ---- township detection for findings ----
import bisect
import re

KINDS = {"Township", "Borough", "Town", "City", "Village"}
# names that are ordinary words or clash with other places: only count when written with a designation
_AMBIGUOUS = {"Wall", "Ocean", "Washington", "Oakland", "Deal", "Madison", "Dover", "Harding", "Chester",
              "Butler", "Wharton", "Union", "Jackson", "Brick", "Lacey", "Manchester", "Berkeley", "Stafford",
              "Ramsey", "Hanover", "Lodi", "Emerson", "Garfield", "Alpine", "Morris", "Jefferson", "Mendham"}
_TOWN_CACHE = {}


def _towns(county):
    if county not in _TOWN_CACHE:
        pats = []
        for full in _ROSTER.get(county, []):
            base, _, kind = full.rpartition(" ")
            if not base or kind not in KINDS:
                base, kind = full, ""
            label = f"{base} {kind}".strip()
            esc = re.escape(base)
            if base in _AMBIGUOUS:
                rx = rf"\b{esc}\s+(?:Township|Borough|Town|City|Village)\b|\b(?:Township|Borough|Town|City|Village)\s+of\s+{esc}\b"
            else:
                rx = rf"\b{esc}\b"
            pats.append((label, re.compile(rx)))
        _TOWN_CACHE[county] = pats
    return _TOWN_CACHE[county]


def town_index(text, county, title="", url=""):
    """Precompute where each town of this county is mentioned. Returns (default_town, positions, names)."""
    pats = _towns(county)
    head = f"{title} {url.replace('-', ' ').replace('_', ' ').replace('%20', ' ')}"
    in_head = [label for label, rx in pats if re.search(rx.pattern, head, re.I)]
    default = in_head[0] if len(set(in_head)) == 1 else None
    hits = sorted((m.start(), label) for label, rx in pats for m in rx.finditer(text))
    return default, [h[0] for h in hits], [h[1] for h in hits]


def town_for(index, pos, before=2500, after=300):
    """Township for a finding at char offset pos: doc-level town, else nearest mention before, else just after."""
    default, poss, names = index
    if default:
        return default
    if not poss:
        return None
    i = bisect.bisect_right(poss, pos)
    if i and pos - poss[i - 1] <= before:
        return names[i - 1]
    if i < len(poss) and poss[i] - pos <= after:
        return names[i]
    return None
