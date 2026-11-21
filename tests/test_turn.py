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


@pytest.mark.parametrize("name", ["answers", "winter", "dismissed", "living", "ending", "journey", "battle", "account", "fever", "meeting"])
def test_good_mocks_are_accepted(run, name):
    m = run["mocks"][name]
    assert m["errors"] == []
    assert [i for i in m["continuity"] if i["level"] == "error"] == []
    assert m["next"]["turn"] == 1


def test_good_mocks_have_no_warnings(run):
    for name in ["answers", "winter", "dismissed", "living", "ending", "journey", "battle", "account", "fever", "meeting"]:
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
    assert "recruiting" in n["world"]["sights"]["vienna"]
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
    assert f["world"]["sights"]["vienna"] == ["alarm"]


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


def test_new_weather_words(run):
    w = run["weather"]
    assert w["kept"] == ["frost", "thaw", "thunder"]
    assert len(w["fixes"]) == 1 and "hail" in w["fixes"][0]
    assert w["looks"] == [] and w["lookKeys"] == [True]


def test_sun_moon_and_seasons(run):
    s = run["sky"]
    assert s["seasons"] == ["autumn", "winter", "spring", "summer"]
    assert 7.5 < s["dec"] < 8.8 and 15.3 < s["jun"] < 16.4
    assert 15 <= s["noonDec"] <= 21 and 62 <= s["noonJun"] <= 68 and s["morningEast"]
    assert s["newMoon"] in (0.0, 0.01, 0.02, 0.98, 0.99, 1.0) and 0.45 <= s["fullMoon"] <= 0.55
    assert s["palettes"]


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


def test_abed_is_checked(run):
    a = run["abed"]
    assert a["badFix"] and a["badGone"]
    assert a["openWarn"] and a["sickWarns"] == 0 and a["clamped"] == "1740-10-21"
    assert a["fmt"] and a["contract"]


def test_fever_mock_keeps_him_abed(run):
    n = run["mocks"]["fever"]
    assert n["errors"] == [] and n["warns"] == []


def test_packet_tables_and_rules_in_a_project(run):
    l = run["lean"]
    assert l["tablesInFull"] and l["notInJson"] == [] and l["everyCast"]
    assert l["pipe"] == "id | dead | note\na |  | x / y\nb | true"
    # with the rules in a Claude Project the packet names their version and leaves them out
    assert l["names"] and l["noContract"] and l["header"] and l["lean"] < l["full"] * 0.6
    assert l["rulesHave"] and l["rulesNoState"] and len(l["v"]) == 8


def test_tempo_per_place(run):
    t = run["tempoAt"]
    assert t["kept"] == {"glogau": "campaigning", "brieg": "truce"} and t["fixes"] == 2
    assert t["merged"] == {"glogau": "campaigning", "neisse": "campaigning"}
    assert t["lasts"] == t["merged"]
    assert t["near"] and not t["notNear"]
    assert t["fmt"] and t["contract"]


def test_scene_is_dated_within_the_turn(run):
    d = run["sceneDate"]
    assert d["none"] == ["1740-10-28", 0] and d["inside"] == ["1740-10-24", 0]
    assert d["before"] == ["1740-10-21", 1] and d["after"] == ["1740-10-28", 1] and d["bad"] == ["1740-10-28", 1]
    assert d["mock"] == "1740-10-24" and d["fmt"]
    assert d["names"] == ["", "Johann Christoph Bartenstein", "You", "Johann Christoph Bartenstein"]


def test_sights_renamed_from_world_scene(run):
    s = run["sights"]
    assert s["world"] == {"sights": {"vienna": ["alarm"]}} and s["fixes"] == 2 and s["fmt"]


def test_exchange_survives_delays_and_campaign_file_round_trip(run):
    x = run["exchange"]
    assert x["refs"] == ["T0-1", "T0-2"]
    assert x["commitments"] == ["Send two regiments.", "Report by Friday."]
    assert x["scene"]["id"] == "promise" and x["currentScene"] is None
    assert x["packet"]  # exact wording, including long qualifications, is sent


def test_answered_orders_do_not_reappear_and_settled_orders_close(run):
    assert run["exchange"]["answered"] == ["T0-2"]
    assert run["exchange"]["settled"] == 0


def test_reply_cannot_erase_promises_and_repeated_capture_is_idempotent(run):
    assert run["exchange"]["forged"] == 2
    assert run["exchange"]["dedup"] == 2


def test_stale_reply_explains_recovery(run):
    assert run["exchange"]["recovery"]


def test_secretary_letter_and_notes_merge_and_clear(run):
    x = run["staff"]
    assert x["living"]["fixes"] == [] and x["living"]["warns"] == []
    b = x["living"]["briefing"]
    assert b["dated"] == "1740-10-26" and b["letters"] == ["t1-1", "t1-3"] and b["places"] == ["linz", "glogau"]
    assert x["living"]["guidance"]["explain"].startswith("A patrol")
    assert x["cleared"] is None  # per turn: gone unless the next reply gives it again
    assert x["live"] is False  # last turn's note does not go back in the packet


def test_secretary_letter_never_points_ahead(run):
    x = run["staff"]
    assert x["errors"] == []
    assert x["briefing"]["letters"] == ["a"]  # "b" arrives after the letter's day; "nope" is not a letter
    assert x["briefing"]["places"] == ["breslau"]
    assert any("not reached the player by then" in f for f in x["fixes"])
    assert x["dropped"]["has"] is False and any("staffBriefing" in f for f in x["dropped"]["fixes"])


def test_notes_follows_and_debate_are_made_safe(run):
    x = run["staff"]
    a, b = x["reports"]
    assert a["follows"] == ["C0"] and a["guidance"] == {"known": "k"}
    assert "guidance" not in b
    o = x["decision"]["options"][0]
    assert "ifWait" not in o and o["guidance"] == {"known": "k"}
    assert x["decision"]["debate"] == [{"who": "a", "text": "yes"}]
    assert any("never took (C9)" in f for f in x["fixes"])


def test_packet_lists_earlier_decisions_and_rules_name_the_fields(run):
    x = run["staff"]
    assert x["packet"] and x["noEarlier"]
    assert x["format"] and x["contract"]


def test_desk_from_the_living_mock(run):
    x = run["desk"]["living"]
    assert x["fixes"] == [] and x["warns"] == []
    assert x["u"][0]["status"] == "in hand" and x["u"][0]["started"] == "1740-10-21"
    assert x["hearsay"][0]["teller"] == "kessler"
    assert [c["id"] for c in x["calendar"]] == ["cal-martinmas", "cal-roads"] and x["calendar"][0]["noted"] == "1740-10-26"
    assert x["audiences"][0]["noted"] == "1740-10-24" and x["audiences"][0]["status"] == "expected"


def test_undertakings_keep_their_stages(run):
    x = run["desk"]
    assert x["errors"] == []
    assert x["u"]["stage"].startswith("The receipts") and x["u"]["updated"] == "1740-10-29"
    assert x["u"]["history"] == [{"date": "1740-10-22", "stage": "Your clerk has the day book; the Linz receipts are sent for."}]  # the reply's own "history" is ignored
    assert x["u"]["waiting"].startswith("The receipts from Linz")  # unchanged fields stay
    assert "u-bad" not in x["undertakings"]
    assert x["st"]["status"] == "in hand" and "due" not in x["st"]


def test_hearsay_calendar_and_audiences_are_checked(run):
    x = run["desk"]
    assert [h["said"] for h in x["hearsay"]] == ["At the Hofkammer they say you count the chests like a tax farmer.", "He is honest, which will not last.", "x"]
    assert x["hearsay"][1]["date"] == "1740-10-30"  # clamped into the turn
    assert "teller" not in x["hearsay"][2]
    assert [c["id"] for c in x["calendar"]] == ["cal-martinmas", "cal-r"] and x["calendar"][1]["certainty"] == "expected"
    a = {a["id"]: a for a in x["audiences"]}
    assert a["aud-starhemberg"]["status"] == "held" and a["aud-x"]["status"] == "expected" and "aud-bad" not in a
    assert any("ghost" in w for w in x["warns"])


def test_a_scene_answers_the_preparation(run):
    x = run["desk"]
    assert x["sceneRe"] == ["T1-1"]
    assert x["pendingBefore"] == ["T1-1"] and x["pending"] == []


def test_packet_keeps_recent_hearsay_without_stage_history(run):
    x = run["desk"]
    assert x["live"] == {"hearsay": 10, "history": False}
    assert x["format"] and x["contract"]
