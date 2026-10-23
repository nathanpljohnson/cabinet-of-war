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


@pytest.mark.parametrize("name", ["answers", "winter", "dismissed", "living", "ending"])
def test_good_mocks_are_accepted(run, name):
    m = run["mocks"][name]
    assert m["errors"] == []
    assert [i for i in m["continuity"] if i["level"] == "error"] == []
    assert m["next"]["turn"] == 1


def test_good_mocks_have_no_warnings(run):
    for name in ["answers", "winter", "dismissed", "living", "ending"]:
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
    assert p["bytes"] < 75_000
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
