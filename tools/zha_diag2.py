#!/usr/bin/env python3
"""ZHA relational detail: names/areas, neighbor & route tables, ghost-router refs."""
import asyncio, json, os, sys
import websockets


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
        # map zha ieee -> friendly name + area via device registry (zha identifiers)
        name_by_ieee, area_by_ieee = {}, {}
        for d in devreg:
            ieee = None
            for tup in d.get("identifiers", []):
                if len(tup) >= 2 and tup[0] == "zha":
                    ieee = tup[1]
            if ieee:
                name_by_ieee[ieee] = d.get("name_by_user") or d.get("name") or ieee
                area_by_ieee[ieee] = area_name.get(d.get("area_id"), "—")

        def nm(ieee):
            return name_by_ieee.get(ieee, ieee)

        # find the dead/unavailable router(s)
        ghosts = [d for d in zdev if not d.get("available", True)]
        ghost_ieees = {d["ieee"] for d in ghosts}
        print("## Ghost / unavailable devices")
        for g in ghosts:
            print(f"- {nm(g['ieee'])} [{g['ieee']}] type={g.get('device_type')} "
                  f"last_seen={g.get('last_seen')} area={area_by_ieee.get(g['ieee'],'—')}")
        print()

        # who still references a ghost in neighbors or routes
        print("## Devices still referencing a ghost in their neighbor/route tables")
        for d in zdev:
            refs = []
            for n in (d.get("neighbors") or []):
                if n.get("ieee") in ghost_ieees:
                    refs.append(f"neighbor(lqi={n.get('lqi')})")
            for r in (d.get("routes") or []):
                if r.get("next_hop") in [g.get("nwk") for g in ghosts] or r.get("dest_nwk") in [g.get("nwk") for g in ghosts]:
                    refs.append(f"route(status={r.get('route_status')})")
            if refs:
                print(f"- {nm(d['ieee'])} ({area_by_ieee.get(d['ieee'],'—')}): {', '.join(refs)}")
        print()

        # coordinator neighbor table (direct children & their link quality)
        coord = next((d for d in zdev if d.get("device_type") == "Coordinator"), None)
        if coord:
            print("## Coordinator's neighbor table (direct links)")
            for n in sorted(coord.get("neighbors") or [], key=lambda x: int(x.get("lqi", 0))):
                print(f"- lqi={n.get('lqi'):>3} {n.get('relationship','?'):>10} "
                      f"{nm(n.get('ieee'))} ({area_by_ieee.get(n.get('ieee'),'—')})")
        print()

        # friendly device list with area, lqi, rssi, type
        print("## All ZHA devices (name / area / type / lqi / rssi / avail)")
        rows = sorted(zdev, key=lambda d: (d.get("lqi") is not None, d.get("lqi") or -1))
        for d in rows:
            if d.get("device_type") == "Coordinator":
                continue
            print(f"- {nm(d['ieee'])[:32]:32} | {area_by_ieee.get(d['ieee'],'—')[:14]:14} | "
                  f"{d.get('device_type','?'):9} | lqi={str(d.get('lqi')):>4} rssi={str(d.get('rssi')):>4} | "
                  f"avail={d.get('available')} | {d.get('model')}")


if __name__ == "__main__":
    asyncio.run(main())
