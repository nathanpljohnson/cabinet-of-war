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


@pytest.mark.parametrize("name", ["answers", "winter", "dismissed", "living", "ending", "account"])
def test_good_mocks_are_accepted(run, name):
    m = run["mocks"][name]
    assert m["errors"] == []
    assert [i for i in m["continuity"] if i["level"] == "error"] == []
    assert m["next"]["turn"] == 1


def test_good_mocks_have_no_warnings(run):
    for name in ["answers", "winter", "dismissed", "living", "ending", "account"]:
        assert run["mocks"][name]["warns"] == [], name
    assert run["mocks"]["account"]["fixes"] == []


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
    assert set(a["reportKeys"]) <= {"id", "from_id", "dated", "title", "re"}
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


def test_grounds_library_matches_rules(run):
    g = run["grounds"]
    assert g["ids"] == g["index"] and g["kinds"] == g["indexKinds"]
    assert g["opening"] == "mollwitz" and g["live"] == "mollwitz" and g["inlineIsMollwitz"]
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
    assert any("Unknown battle ground" in w for w in g["unknownId"]["warns"]) and g["unknownId"]["ground"] == {"kind": "open plain"}
    assert g["unknownKind"]["ground"] == {"kind": "open plain", "asked": "swamp"}
    assert any("no ground was given" in w for w in g["noGround"])


def test_a_line_wheels_on_its_flank(run):
    w = run["march"]["wheel"]
    assert w["to"]["facing"] == 90 and w["pivotBefore"] == pytest.approx(w["pivotAfter"], abs=1e-6)
    assert w["small"]["facing"] == 348  # at most 12 degrees a step, toward the left


def test_units_push_apart(run):
    s = run["march"]["sep"]
    assert s["apart"] is None and s["overlap"]["depth"] == pytest.approx(4) and s["overlap"]["y"] == pytest.approx(1)


def test_columns_go_round_water_and_take_roads(run):
    m = run["march"]
    assert m["route"]["wet"] == 0 and m["route"]["ford"]
    assert [p[1] for p in m["road"]["pts"][:-1]] == [-45, -45] and m["road"]["pts"][1][0] - m["road"]["pts"][0][0] >= 300


def test_troop_types(run):
    m = run["march"]
    assert m["troops"] == ["inf", "gd", "lt", "cav", "lc", "art"]
    assert [(t["type"], t.get("kind")) for t in m["types"]] == [("inf", "gd"), ("inf", "lt"), ("cav", "lc"), ("inf", None), ("cav", None), ("art", None)]
    assert (m["north"], m["east"]) == (0, 90)


def test_troop_types_in_replies(run):
    t = run["grounds"]["troops"]
    assert [(u.get("type"), u.get("kind")) for u in t["units"]] == [("cav", "lc"), ("inf", None), (None, None)]
    assert any("pandour" in f for f in t["fixes"])


def test_an_account_phase_by_phase(run):
    n = run["mocks"]["account"]["next"]
    assert n["ground"] == "chotusitz" and [p[0] for p in n["phases"]] == ["07:30", "08:30", "09:30", "10:30", "11:30"]
    b = run["badAccount"]
    assert len(b["phases"]) == 1 and [u["id"] for u in b["phases"][0]["units"]] == ["A1", "B1"]
    assert b["phases"][0]["units"][0]["form"] == "line" and b["phases"][0]["units"][1]["losses"] == "heavy"
    assert b["phases"][0]["arrows"] == [{"side": "A", "kind": "move", "p": [[0, 0], [1, 1]]}]
    assert len(b["fixes"]) == 5 and b["packet"] == "08:00 x"


def test_crests_hide_what_stands_behind_them(run):
    l = run["lie"]
    assert l["behind"] and not l["onTop"] and not l["flat"] and not l["fromTop"] and not l["close"]
    assert l["farBeyond"]  # 3 km on, the ridge still masks a man's height: the line of sight grazes it


def test_slopes_slow_a_march(run):
    p = run["lie"]["pace"]
    assert p["level"] == 1 and p["down4"] == 1
    assert p["up10cav"] < p["up10"] < 1 and p["up10art"] < p["up10cav"]
    assert p["up10"] < p["up10road"] < 1 and p["down15"] < 1 and p["cliff"] == pytest.approx(.35)


def test_towns_have_works_and_bridges(run):
    f = {x["id"]: x for x in run["grounds"]["files"]}
    assert [t[1] for t in f["brieg"]["towns"]] == ["bastioned"] and f["brieg"]["towns"][0][2] >= 6
    assert [t[0] for t in f["prague"]["towns"]] == ["Old and New Town", "Lesser Town and Hradschin"]
    assert [t[1] for t in f["linz"]["towns"]] == ["walled"]  # Urfahr was an open market
    assert "Charles Bridge" in f["prague"]["named"] and "The Danube bridge" in f["linz"]["named"]
    assert f["mollwitz"]["towns"] == [] and f["brieg"]["bridges"] > 0
