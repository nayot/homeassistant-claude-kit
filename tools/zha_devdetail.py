#!/usr/bin/env python3
"""Dump full neighbor + route tables for named devices (substring match). Read-only."""
import asyncio, json, os, sys
import websockets

WANT = [w.strip().lower() for w in os.environ.get("WANT", "down light,center,coordinator").split(",")]


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
        zdev = (await call(ws, mid, {"type": "zha/devices"}))["result"]; mid += 1

    name = {}
    for d in devreg:
        ieee = next((t[1] for t in d.get("identifiers", []) if len(t) >= 2 and t[0] == "zha"), None)
        if ieee:
            name[ieee] = d.get("name_by_user") or d.get("name") or ieee
    nm = lambda i: name.get(i, str(i)[-8:])

    for d in zdev:
        dn = nm(d["ieee"]).lower()
        dt = (d.get("device_type") or "").lower()
        if not any(w in dn or w in dt for w in WANT):
            continue
        print(f"\n### {nm(d['ieee'])}  [{d.get('device_type')}] {d.get('model')} "
              f"nwk={d.get('nwk')} ownLQI={d.get('lqi')} rssi={d.get('rssi')} avail={d.get('available')} "
              f"last_seen={d.get('last_seen')}")
        nbrs = d.get("neighbors") or []
        if nbrs:
            print("  neighbors:")
            for n in sorted(nbrs, key=lambda x: int(x.get("lqi", 0))):
                print(f"    lqi={str(n.get('lqi')):>3} {n.get('relationship','?'):>9} "
                      f"{n.get('device_type','?'):>11} {nm(n.get('ieee'))}")
        routes = d.get("routes") or []
        if routes:
            print("  routes:")
            for r in routes:
                print(f"    dest={r.get('dest_nwk')} next_hop={r.get('next_hop')} "
                      f"status={r.get('route_status')}")


if __name__ == "__main__":
    asyncio.run(main())
