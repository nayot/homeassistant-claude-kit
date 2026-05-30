#!/usr/bin/env python3
"""Build the ZHA parent/child topology and focus on a target area.

End devices don't keep neighbor tables; their parent router lists them as 'Child'.
We invert all routers' neighbor tables to find each device's parent + link LQI.
Read-only.
"""
import asyncio, json, os, sys
import websockets

TARGET_AREA = os.environ.get("AREA", "Living Room")


async def call(ws, mid, payload):
    await ws.send(json.dumps({"id": mid, **payload}))
    while True:
        r = json.loads(await ws.recv())
        if r.get("id") == mid and r.get("type") == "result":
            return r


async def main():
    url = os.environ["HA_URL"].replace("http", "ws", 1).rstrip("/") + "/api/websocket"
    async with websockets.connect(url, max_size=8_000_000) as ws:
        json.loads(await ws.recv())
        await ws.send(json.dumps({"type": "auth", "access_token": os.environ["HA_TOKEN"]}))
        if json.loads(await ws.recv())["type"] != "auth_ok":
            print("auth failed"); sys.exit(1)
        mid = 1
        devreg = (await call(ws, mid, {"type": "config/device_registry/list"}))["result"]; mid += 1
        areareg = (await call(ws, mid, {"type": "config/area_registry/list"}))["result"]; mid += 1
        zdev = (await call(ws, mid, {"type": "zha/devices"}))["result"]; mid += 1

    area_name = {a["area_id"]: a["name"] for a in areareg}
    name, area = {}, {}
    for d in devreg:
        ieee = next((t[1] for t in d.get("identifiers", []) if len(t) >= 2 and t[0] == "zha"), None)
        if ieee:
            name[ieee] = d.get("name_by_user") or d.get("name") or ieee
            area[ieee] = area_name.get(d.get("area_id"), "—")
    nm = lambda i: name.get(i, i)

    by_ieee = {d["ieee"]: d for d in zdev}

    # invert: parent_of[child_ieee] = (parent_ieee, lqi)
    parent_of = {}
    children = {}  # router_ieee -> list[(child_ieee, lqi)]
    for d in zdev:
        for n in (d.get("neighbors") or []):
            rel = n.get("relationship")
            cieee = n.get("ieee")
            lqi = n.get("lqi")
            if rel == "Child":
                parent_of[cieee] = (d["ieee"], lqi)
                children.setdefault(d["ieee"], []).append((cieee, lqi))

    print(f"## {TARGET_AREA}: each device, its parent router, and link LQI\n")
    targets = [d for d in zdev if area.get(d["ieee"]) == TARGET_AREA]
    if not targets:
        print("(no devices in that area — check the name)")
    for d in sorted(targets, key=lambda x: x.get("device_type") or ""):
        ieee = d["ieee"]
        p = parent_of.get(ieee)
        ptxt = f"parent={nm(p[0])} (link LQI {p[1]})" if p else "parent=UNKNOWN (no router lists it as child)"
        own = f"ownLQI={d.get('lqi')} rssi={d.get('rssi')}"
        print(f"- {nm(ieee):28} [{d.get('device_type'):9}] {d.get('model'):8} {own:22} avail={d.get('available')}  {ptxt}")

    print(f"\n## Routers serving {TARGET_AREA} devices — child load & weakest child")
    serving = {}
    for d in targets:
        p = parent_of.get(d["ieee"])
        if p:
            serving.setdefault(p[0], []).append((d["ieee"], p[1]))
    for r_ieee in serving:
        kids = children.get(r_ieee, [])
        weak = min((l for _, l in kids if l is not None), default=None)
        print(f"- {nm(r_ieee)} ({area.get(r_ieee,'—')}): total children={len(kids)}, "
              f"weakest child LQI={weak}, ownLQI={by_ieee.get(r_ieee,{}).get('lqi')}")

    print("\n## Any device with NO parent (orphan right now)")
    orphans = [d for d in zdev if d.get("device_type") == "EndDevice" and d["ieee"] not in parent_of]
    for d in orphans:
        print(f"- {nm(d['ieee'])} ({area.get(d['ieee'],'—')}) {d.get('model')} "
              f"avail={d.get('available')} lqi={d.get('lqi')}")


if __name__ == "__main__":
    asyncio.run(main())
