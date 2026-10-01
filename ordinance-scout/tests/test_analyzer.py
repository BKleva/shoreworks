import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scout.analyzer import analyze, rollup, PROHIBITED, SCENIC, REGULATED, PERMITTED


def cats(text):
    return {f["category"] for f in analyze(text)}


def test_prohibited_variants():
    assert PROHIBITED in cats("Billboards are hereby prohibited in all zone districts of the Borough.")
    assert PROHIBITED in cats("No billboards shall be erected within the Township.")
    assert PROHIBITED in cats("The following signs are prohibited: flashing signs, roof signs, and billboards.")
    assert PROHIBITED in cats("Off-premises signs shall not be permitted.")


def test_prohibited_false_positives():
    assert PROHIBITED not in cats("No more than one billboard shall be located on any lot.")
    assert PROHIBITED not in cats("Billboards are permitted in the HC Highway Commercial zone.")


def test_scenic():
    assert SCENIC in cats("Goal: preserve the scenic character of Route 24 and protect scenic highways.")
    assert SCENIC in cats("The plan seeks to preserve beautiful highways and open vistas.")
    hit = [f for f in analyze("Protect the viewshed from billboard blight along Route 78.") if f["category"] == SCENIC]
    assert hit and hit[0]["near_billboard"] == 1


def test_permitted_negation():
    assert PERMITTED in cats("Billboards are permitted along Route 9 in the I-2 zone.")
    assert PERMITTED not in cats("Billboards are not permitted along Route 9.")


def test_regulated():
    assert REGULATED in cats("Billboards are a conditional use and must be spaced no closer than 1,000 feet apart.")


def test_rollup():
    p = analyze("Billboards are prohibited in the Township.")
    assert rollup(p)[0] == "prohibited"
    m = analyze("Billboards are prohibited on Main Street. Billboards are permitted in the I zone.")
    assert rollup(m)[0] == "mixed"
    assert rollup([], doc_types=[])[0] == "no_data"
    assert rollup([], doc_types=["ordinance"])[0] == "no_signal"


def test_pequannock_style_language():
    # wording per Pequannock Art. XIII search excerpt (verbatim text was not retrievable; eCode360 blocks bots)
    t = ("Billboards or signs posted off the premises of an activity are not permitted in any zone, "
         "except where permitted as a real estate directional sign or a special event sign.")
    c = cats(t)
    assert PROHIBITED in c and REGULATED in c
    strong = [f for f in analyze(t) if f["category"] == PROHIBITED]
    assert strong and strong[0]["strong"] == 1


def test_purpose_language_from_nj_opinion():
    # quoted in Garden State Outdoor v. Middle Twp. Zoning Bd. (App. Div. 2026) from that township's ordinance/master plan
    t = ("Update sign standards that promote safety while discouraging sign proliferation. Purpose: reduce the "
         "distractions, obstructions and hazards to pedestrian and auto traffic caused by the indiscriminate placement "
         "and use of signs, and protect and enhance the physical appearance of all areas.")
    assert SCENIC in cats(t)


def test_township_attribution():
    from scout.municipalities import town_for, town_index
    from scout.analyzer import normalize
    t = ("Pequannock Township. Billboards are prohibited in all zones. "
         "Riverdale Borough. Billboards are permitted along Route 23 in the I-2 zone.")
    idx = town_index(normalize(t), "Morris", "report.pdf", "")
    got = {f["category"]: town_for(idx, f["position"]) for f in analyze(t)}
    assert got[PROHIBITED] == "Pequannock Township" and got[PERMITTED] == "Riverdale Borough"
    # a document about one town tags everything with that town
    idx2 = town_index(normalize("Billboards are prohibited."), "Morris", "Pequannock signs", "")
    assert town_for(idx2, 0) == "Pequannock Township"
