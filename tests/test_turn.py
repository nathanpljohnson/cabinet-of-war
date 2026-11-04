import json
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def run():
    out = subprocess.run(["node", str(ROOT / "tests" / "harness.mjs")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


@pytest.mark.parametrize("name", ["answers", "winter", "dismissed", "living", "ending", "journey", "battle"])
def test_good_mocks_are_accepted(run, name):
    m = run["mocks"][name]
    assert m["errors"] == []
    assert [i for i in m["continuity"] if i["level"] == "error"] == []
    assert m["next"]["turn"] == 1


def test_good_mocks_have_no_warnings(run):
    for name in ["answers", "winter", "dismissed", "living", "ending", "journey", "battle"]:
        assert run["mocks"][name]["warns"] == [], name


def test_time_cannot_run_backwards(run):
    assert any("backwards" in e for e in run["mocks"]["backwards"]["errors"])


def test_dead_cannot_write(run):
    assert any("dead" in i["text"] for i in run["mocks"]["contradiction"]["continuity"])


def test_merge_keeps_what_did_not_change(run):
    n = run["mocks"]["answers"]["next"]
    assert n["forces"] == run["mocks"]["dismissed"]["next"]["forces"]
    assert n["cast"] >= 20 and n["threads"] == 47
    assert n["decision"] is None  # per-turn: cleared when the reply gives none


def test_living_world(run):
    n = run["mocks"]["living"]["next"]
    assert n["kessler"]["invented"] is True
    assert n["thread"]["status"] == "building"
    assert n["world"]["weather"]["1740-10-22"] == "rain"
    assert "recruiting" in n["world"]["scene"]["vienna"]
    assert n["enemy"]["commander"] == "Schwerin"
    assert sum(1 for o in n["urgent"]["options"] if o.get("default")) == 1


def test_canon_only_grows(run):
    assert run["mocks"]["living"]["next"]["canon"] == run["mocks"]["answers"]["next"]["canon"] + 1


def test_ending(run):
    assert run["mocks"]["ending"]["next"]["ended"]["date"] == "1740-11-05"


def test_merge_rules(run):
    s1 = run["merge"]["s1"]
    a = next(c for c in s1["cast"] if c["id"] == "a")
    assert a == {"id": "a", "name": "A", "place": "prague", "agenda": "x"}
    assert [c["id"] for c in s1["cast"]] == ["a", "c"]
    assert [x["text"] for x in s1["ledger"]] == ["l0", "l1"]
    assert s1["hidden"]["canon"] == ["c0", "c1"]
    assert s1["hidden"]["memory"]["a"] == ["m0", "m1"]
    assert s1["hidden"]["standing"] == {"a": "warm"}
    assert s1["trust"] == {"a spy": "doubt"}
    assert s1["world"] == {"pay": "paid", "roads": "heavy"}
    assert "weather" not in run["mocks"]["ending"]["next"]["world"]
    assert [r["id"] for r in s1["reports"]] == ["new"]
    assert s1["decision"] is None and s1["overheard"] == []
    assert any("trust" in n for n in run["merge"]["notes"])


def test_parse(run):
    p = run["parse"]
    assert p["fenced"]["value"] == {"a": 1, "b": [1, 2]}
    assert p["truncated"]["truncated"] is True
    assert "No reply" in p["none"]["error"]
    assert "not valid JSON" in p["bad"]["error"]


def test_fixes_on_arrival(run):
    f = run["fixes"]
    assert f["letter"]["arrives"] == "1740-10-23"
    assert f["letter"]["re"] == ["T0-1"]
    assert "urgent" not in f["urgent"]
    assert "1740-10-22" not in f["world"]["weather"]
    assert f["world"]["scene"]["vienna"] == ["alarm"]


def test_packet(run):
    p = run["packet"]
    assert p["hasContract"] and p["hasTrust"]
    assert p["bytes"] < 60_000
    # the opening letters were written by the page: the adjudicator gets them whole
    assert p["openingLetters"]
    # orders from earlier turns that are still unanswered go with their references
    assert p["waiting"] and p["noWaiting"]
    for k in p["staticKeys"]:
        assert k not in p["live"]
    assert p["active"], "some plots are in play at the opening"
    a, b, c = p["fortune"]
    assert a == b and a != c and all(1 <= x <= 100 for x in a)


def test_new_fields_merge(run):
    n = run["mocks"]["living"]["next"]
    assert n["world"]["tempo"] == "winter quarters"
    assert len(n["gazette"]) == 2 and n["gazette"][0]["id"] == "gz-1740-10-22"
    assert "banker" in n["household"]["purse"] and n["purse"]["debts"]
    a = run["mocks"]["winter"]["next"]["aftermath"]
    assert a["held_by"] == "B" and a["fallen"]["A3"] == "destroyed"


def test_sealed_record(run):
    r = run["record"]
    assert r["stable"] and len(r["origin"]) == 16
    assert any("different packet" in e for e in r["wrong"])
    assert any("seal" in w for w in r["missing"])
    assert r["volumeDue"] == [True, False, False]
    assert any("volume" in w for w in r["volumeWarn"])
    assert r["nextSeal"] == r["link1"]["h"] and r["nextSeal"] != r["origin"]
    assert r["fp"][0] == r["fp"][1] != r["fp"][2]
    assert r["packetSeal"] and r["packetVolume"]
    assert r["recordKept"] == 1  # a reply cannot rewrite the record


def test_bad_new_fields_are_fixed(run):
    b = run["badFixes"]
    assert "tempo" not in b["world"]
    assert [g["date"] for g in b["gazette"]] == ["1740-10-21"]
    assert b["fallen"]["A1"] == "heavy"


def test_branch_is_limited(run):
    b = run["branch"]
    assert b["remarks"] == ["r"] and b["date"] == "1740-10-21"
    assert b["hidden"]["standing"]["a"] == "cool" and b["hidden"]["canon"] == ["c0"]


def test_build_split_the_almanac():
    html = (ROOT / "cabinet-of-war.html").read_text()
    st = json.loads(re.search(r'id="initial-state">(.*?)</script>', html, re.S)[1].replace("\\u003c", "<"))
    assert "world" not in st["hidden"]
    assert len(st["hidden"]["threads"]) == 47
    assert len(json.loads((ROOT / "w3d" / "almanac.json").read_text())["plots"]) == 47
    assert "window.__temper" in html
    assert "w3d/main.js" in html


def test_packet_after_a_turn_is_lean(run):
    a = run["after"]
    assert a["span"] == {"from": "1740-10-21", "at": "vienna"}
    for k in ["gazette", "whereabouts", "overheard", "span", "record"]:
        assert k not in a["live"]
    assert set(a["reportKeys"]) <= {"id", "from_id", "dated", "title", "re", "text"}
    # a fresh chat sees what each letter said, not only its title
    assert a["texts"] and all(a["texts"])
    assert "decisions" not in a["hiddenKeys"] and "fortune_used" not in a["hiddenKeys"]
    assert "rel-papal-neutrality-1741" not in a["active"]  # its thread says not before June 1741
    assert a["battleUnits"] and not a["openingUnits"]  # units go only once an enemy commander is named
    assert a["bytes"] < 60_000


def test_route_is_checked(run):
    r = run["route"]
    assert [s["date"] for s in r["route"]] == ["1740-10-22", "1740-10-27"]
    assert len([f for f in r["fixes"] if "route" in f]) == 2


def test_fortune_is_salted_per_campaign(run):
    a, b, c, d = run["salt"]
    assert a == b and a != c and a != d


def test_opening_is_not_a_demo(run):
    o = run["opening"]
    assert "demonstration" not in o["briefing"]
    assert o["scene"] is None and o["movements"] == 0 and o["demoCast"] == 0
    assert o["wallis"] == "glogau"
    assert o["early"] == 0


def test_new_battle_replaces_the_field(run):
    b = run["battle"]
    assert b["ids"] == b["mockIds"]
    assert b["options"] == ["hold"] and b["aftermath"] is None
    assert b["sameId"] == len(b["mockIds"]) - 1


def test_ground_is_drawn_from_the_reply(run):
    b = run["battle"]
    c = b["cells"]
    assert (c["village"], c["hamlet"], c["wood"], c["stream"]) == (3, 3, 1, 2)
    assert c["bridge"] != 2 and c["ford"] != 2  # the crossings are dry
    # the field is cleared where the armies stand (the blank test field is all wood)
    assert b["unitCells"] == [0]
    assert b["same"] and b["kind"] == "wooded hills" and b["rivers"] >= 1 and b["size"] == [198, 132, 132, 198]
    assert {"Neudorf", "Lindenau", "the Fasanerie", "the Mühlbach", "the windmill hill"} <= set(b["names"])
    assert b["packet"] == "ground"


def test_bad_battle_is_made_safe(run):
    bad = run["battle"]["bad"]
    assert bad["kind"] == "marsh" and bad["villages"] == ["Ok:village"]
    assert bad["units"] == ["X3:0"]
    assert any("both sides" in w for w in bad["warns"])


def test_packet_caps_canon_by_size_and_memory(run):
    c = run["caps"]
    # the latest facts, as many as fit in about 5,000 characters, and a note that the page keeps the rest
    assert 20 <= c["canon"] <= 26 and c["chars"] <= 5200 and c["last"] == "fact 59"
    assert "earlier entries are kept by the page" in c["note"]
    assert c["memory"] == ["4", "5", "6"]


def test_movements_need_a_line_and_known_status(run):
    m = run["moves"]
    assert m["ids"] == ["m1:reported:1740-12-11"] and m["fixes"] == 2 and m["fmt"]


def test_preview_field_never_goes_as_the_live_battle(run):
    # campaigning makes a battle possible, but the opening's Mollwitz preview must not be sent as if it were one
    assert run["preview"] == {"units": False, "note": True, "title": None}


def test_grounds_library_matches_rules(run):
    g = run["grounds"]
    assert g["ids"] == g["index"] and g["kinds"] == g["indexKinds"]
    # the opening preview goes to the adjudicator as a note only (no ground, no units): see test_preview_field_never_goes_as_the_live_battle
    assert g["opening"] == "mollwitz" and g.get("live") is None and g["inlineIsMollwitz"]
    assert g["packetHasIds"]


def test_grounds_files_are_whole(run):
    for f in run["grounds"]["files"]:
        assert (f["cols"], f["cell"], f["w"], f["h"], f["rows"]) == (198, 30, 5940, 3960, 132), f["id"]
        assert f["len"] == [198] and set(f["chars"]) <= set("012345"), f["id"]
        assert f["relief"] and f["outer"] and f["sources"] and f["notes"], f["id"]


def test_ground_choice_is_checked(run):
    g = run["grounds"]
    assert g["lib"]["warns"] == [] and g["lib"]["ground"] == "prague"
    assert g["kind"]["warns"] == [] and g["kind"]["ground"] == {"kind": "marsh"}
    assert any("Unknown battle ground" in w for w in g["unknownId"]["warns"]) and g["unknownId"]["ground"] == {"kind": "open plain", "asked": "atlantis"}
    assert g["unknownKind"]["ground"] == {"kind": "open plain", "asked": "tundra"}
    assert g["aliasKind"]["ground"] == {"kind": "marsh"}
    assert any("no ground was given" in w for w in g["noGround"])
