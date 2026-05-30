#!/usr/bin/env python3
"""Pull availability history for representative ZHA devices via HA REST history API.

Goal: distinguish a coordinator-link problem (many devices go 'unavailable' at the
SAME timestamps) from mesh problems (scattered, independent dropouts).
Read-only.
"""
import json, os, sys, urllib.request, urllib.parse, datetime, collections

ENTITIES = [
    # routers (TS0505B downlight controllers)
    "light.mb_downlight_1", "light.mb_downlight",
    "light.living_room_down_light_1", "light.living_room_down_light_3",
    "light.hallway_light_light", "light.hallway_router_light",
    "light.smlight_router_light",
    # switch / end devices
    "light.mb_main_light_2", "light.leftrightlights_light", "light.kitchen_light_7",
    "light.stair_upper_light", "light.restroom_hallway_light",
    # motion end devices
    "binary_sensor.kitchen_motion_motion", "binary_sensor.restroom_motion_motion",
    "binary_sensor.hallway_motion_2_motion",
]

HOURS = int(os.environ.get("HIST_HOURS", "72"))


def get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {os.environ['HA_TOKEN']}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    base = os.environ["HA_URL"].rstrip("/")
    start = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=HOURS))
    start_s = start.isoformat()
    q = urllib.parse.urlencode({
        "filter_entity_id": ",".join(ENTITIES),
        "minimal_response": "", "no_attributes": "",
    })
    url = f"{base}/api/history/period/{urllib.parse.quote(start_s)}?{q}"
    data = get(url)

    # data: list of per-entity lists of {state, last_changed/last_updated}
    unavail_events = []  # (ts, entity)
    per_entity = {}
    for series in data:
        if not series:
            continue
        eid = series[0].get("entity_id")
        prev = None
        episodes = 0
        total_unavail = datetime.timedelta()
        unavail_start = None
        for pt in series:
            st = pt.get("state")
            ts = pt.get("last_changed") or pt.get("last_updated")
            t = datetime.datetime.fromisoformat(ts)
            if st == "unavailable" and prev != "unavailable":
                episodes += 1
                unavail_start = t
                unavail_events.append((t, eid))
            if st != "unavailable" and prev == "unavailable" and unavail_start:
                total_unavail += (t - unavail_start)
                unavail_start = None
            prev = st
        per_entity[eid] = (episodes, total_unavail)

    print(f"## Availability over last {HOURS}h ({len(ENTITIES)} representative devices)\n")
    print(f"{'episodes':>8} {'total_unavail':>16}  entity")
    for eid in ENTITIES:
        ep, tot = per_entity.get(eid, (0, datetime.timedelta()))
        print(f"{ep:>8} {str(tot):>16}  {eid}")

    # coincidence: bucket unavailable-onset events into 5-min windows
    print("\n## Coincidence of 'went unavailable' onsets (5-min buckets with >1 device)")
    buckets = collections.defaultdict(list)
    for t, eid in unavail_events:
        key = t.replace(minute=(t.minute // 5) * 5, second=0, microsecond=0)
        buckets[key].append(eid)
    multi = {k: v for k, v in buckets.items() if len(v) > 1}
    if not multi:
        print("(none — every dropout was an isolated single device → points to MESH, not coordinator link)")
    else:
        for k in sorted(multi):
            print(f"- {k.isoformat()}: {len(multi[k])} devices → {', '.join(e.split('.')[-1] for e in multi[k])}")
    print(f"\ntotal unavailable-onset events: {len(unavail_events)}; "
          f"multi-device windows: {len(multi)}")


if __name__ == "__main__":
    main()
