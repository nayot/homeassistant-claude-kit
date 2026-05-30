#!/usr/bin/env python3
"""Pull ZHA network diagnostics over the HA WebSocket API (token auth).

Read-only. No config changes. Outputs a health summary for Zigbee triage.
"""
import asyncio, json, os, sys, time
import websockets


async def ws_call(ws, msg_id, payload):
    await ws.send(json.dumps({"id": msg_id, **payload}))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == msg_id and resp.get("type") == "result":
            return resp


async def main():
    url = os.environ["HA_URL"].replace("http", "ws", 1).rstrip("/") + "/api/websocket"
    token = os.environ["HA_TOKEN"]
    async with websockets.connect(url, max_size=8_000_000) as ws:
        hello = json.loads(await ws.recv())
        assert hello["type"] == "auth_required", hello
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        auth = json.loads(await ws.recv())
        if auth["type"] != "auth_ok":
            print("AUTH FAILED:", auth); sys.exit(1)
        print(f"# Connected — HA {auth.get('ha_version')}\n")

        mid = 1
        # ZHA network settings (channel, pan id, radio)
        net = await ws_call(ws, mid, {"type": "zha/network/settings"}); mid += 1
        # ZHA devices
        dev = await ws_call(ws, mid, {"type": "zha/devices"}); mid += 1

        if not net.get("success"):
            print("zha/network/settings error:", net.get("error"))
        else:
            s = net["result"].get("settings", {}).get("network_info", {})
            print("## Network")
            print(f"- channel: {s.get('channel')}")
            print(f"- pan_id: {s.get('pan_id')}  ext_pan_id: {s.get('extended_pan_id')}")
            src = net["result"].get("settings", {}).get("source")
            print(f"- radio source: {src}")
            print()

        if not dev.get("success"):
            print("zha/devices error:", dev.get("error")); sys.exit(1)

        devices = dev["result"]
        now = time.time()
        coords = [d for d in devices if d.get("device_type") == "Coordinator"]
        routers = [d for d in devices if d.get("device_type") == "Router"]
        ends = [d for d in devices if d.get("device_type") == "EndDevice"]
        unavail = [d for d in devices if not d.get("available", True)]

        print("## Mesh composition")
        print(f"- total devices: {len(devices)}")
        print(f"- coordinator: {len(coords)}  routers: {len(routers)}  end-devices: {len(ends)}")
        print(f"- UNAVAILABLE right now: {len(unavail)}")
        print()

        def age(d):
            ls = d.get("last_seen")
            if not ls: return None
            try:
                # last_seen is ISO; fall back if epoch
                import datetime
                t = datetime.datetime.fromisoformat(ls.replace("Z", "+00:00")).timestamp()
                return now - t
            except Exception:
                return None

        print("## Per-device (sorted by LQI ascending — worst links first)")
        rows = []
        for d in devices:
            if d.get("device_type") == "Coordinator":
                continue
            rows.append((
                d.get("lqi"), d.get("rssi"), d.get("device_type"),
                d.get("available"), age(d),
                d.get("manufacturer"), d.get("model"),
                d.get("name") or d.get("user_given_name"),
                len(d.get("neighbors") or []), len(d.get("routes") or []),
                d.get("power_source"),
            ))
        # None LQI sorts first (unknown/likely problematic)
        rows.sort(key=lambda r: (r[0] is not None, r[0] if r[0] is not None else -1))
        print(f"{'LQI':>4} {'RSSI':>5} {'type':>9} {'avail':>5} {'age':>7} {'nbr':>3} {'rt':>3}  {'mfr/model/name'}")
        for lqi, rssi, dt, avail, ag, mfr, model, name, nbr, rt, pwr in rows:
            agetxt = f"{int(ag/60)}m" if ag is not None and ag < 36000 else (f"{int(ag/3600)}h" if ag is not None else "?")
            dtab = {"Router": "Router", "EndDevice": "End", "Coordinator": "Coord"}.get(dt, dt)
            print(f"{str(lqi):>4} {str(rssi):>5} {dtab:>9} {str(avail):>5} {agetxt:>7} {nbr:>3} {rt:>3}  {mfr} / {model} / {name}")

        # Highlights
        print("\n## Flags")
        low = [r for r in rows if r[0] is not None and r[0] < 60]
        stale = [r for r in rows if r[4] is not None and r[4] > 7200]
        noinfo = [r for r in rows if r[0] is None]
        print(f"- low LQI (<60): {len(low)}")
        print(f"- not seen >2h: {len(stale)}")
        print(f"- no LQI reported: {len(noinfo)}")
        if routers:
            child_heavy = sorted(((len(d.get('neighbors') or []), d.get('name')) for d in routers), reverse=True)[:5]
            print(f"- top routers by neighbor count: {child_heavy}")


if __name__ == "__main__":
    asyncio.run(main())
