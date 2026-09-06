#!/usr/bin/env python3
"""Set a `panel_custom` panel (e.g. the Claude Kit dashboard) as HA's default dashboard.

WHY THIS TOOL EXISTS
--------------------
Home Assistant's own "Default dashboard" pickers only ever offer two things:

  * the built-in panels hardcoded in the frontend's `PANEL_DASHBOARDS` list
    (home, light, security, climate, energy, maintenance), and
  * Lovelace dashboards returned by `lovelace/dashboards/list`.

A `panel_custom` panel is in neither list, so it can never be picked in the UI.
The *resolver*, however, has no such restriction — `getDefaultPanelUrlPath()` in
frontend `src/data/panel.ts` reads a plain url_path string and then looks it up in
`hass.panels`, which includes custom panels. Precedence (first non-empty wins):

    userData.core.default_panel        per user   (frontend/set_user_data)
    systemData.core.default_panel      site-wide  (frontend/set_system_data, admin)
    localStorage "defaultPanel"        legacy, per browser
    "home"                             fallback

So the panel only needs `core.default_panel` written to one of those stores. This
tool does that over the supported WebSocket API — it never edits `.storage/` files,
which HA owns at runtime.

Requires HA >= 2025.12 (when the system-wide default and the `default_panel` key
were introduced). Older cores only have the per-user store.

Usage:
    python tools/set_default_dashboard.py --show
    python tools/set_default_dashboard.py                      # site-wide (admin)
    python tools/set_default_dashboard.py --scope user
    python tools/set_default_dashboard.py --panel my-panel
    python tools/set_default_dashboard.py --reset              # hand back to HA's default

Env: HA_URL, HA_TOKEN (exported by the Makefile from .env).
Exit: 0 = ok, 1 = failed.
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import websockets
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from yaml_validator import HAYamlLoader  # noqa: E402

CONFIG_YAML = Path("config/configuration.yaml")
STORE_KEY = "core"  # the frontend user/system-data namespace holding default_panel


def panels_from_config():
    """Return the url_path of every panel_custom entry in configuration.yaml."""
    if not CONFIG_YAML.exists():
        return []
    with open(CONFIG_YAML, "r", encoding="utf-8") as f:
        config = yaml.load(f, Loader=HAYamlLoader) or {}
    entries = config.get("panel_custom") or []
    if isinstance(entries, dict):  # single-panel shorthand
        entries = [entries]
    return [p["url_path"] for p in entries if isinstance(p, dict) and p.get("url_path")]


async def ws_call(ws, msg_id, payload):
    await ws.send(json.dumps({"id": msg_id, **payload}))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == msg_id and resp.get("type") == "result":
            return resp


def unwrap(resp, what):
    """Return resp['result'], or exit with the HA error message."""
    if not resp.get("success"):
        err = resp.get("error", {})
        print(f"ERROR: {what} failed: {err.get('code')} — {err.get('message')}")
        sys.exit(1)
    return resp.get("result")


async def run(args):
    url = os.environ["HA_URL"].replace("http", "ws", 1).rstrip("/") + "/api/websocket"
    token = os.environ["HA_TOKEN"]

    async with websockets.connect(url, max_size=8_000_000) as ws:
        hello = json.loads(await ws.recv())
        assert hello["type"] == "auth_required", hello
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        auth = json.loads(await ws.recv())
        if auth["type"] != "auth_ok":
            print("AUTH FAILED:", auth)
            return 1
        print(f"# Connected — HA {auth.get('ha_version')}")

        mid = 1
        me = unwrap(await ws_call(ws, mid, {"type": "auth/current_user"}), "auth/current_user")
        mid += 1
        panels = unwrap(await ws_call(ws, mid, {"type": "get_panels"}), "get_panels")
        mid += 1
        system = unwrap(
            await ws_call(ws, mid, {"type": "frontend/get_system_data", "key": STORE_KEY}),
            "frontend/get_system_data",
        )
        mid += 1
        user = unwrap(
            await ws_call(ws, mid, {"type": "frontend/get_user_data", "key": STORE_KEY}),
            "frontend/get_user_data",
        )
        mid += 1

        system_core = (system or {}).get("value") or {}
        user_core = (user or {}).get("value") or {}

        print(f"# Token user: {me.get('name')} (admin={me.get('is_admin')})")
        print()
        print("Current default_panel:")
        print(f"  user   ({me.get('name')}): {user_core.get('default_panel') or '(unset)'}")
        print(f"  system              : {system_core.get('default_panel') or '(unset)'}")
        print(f"  effective for you   : "
              f"{user_core.get('default_panel') or system_core.get('default_panel') or 'home'}")

        custom = [p for p in panels.values() if p.get("component_name") == "custom"]
        if custom:
            print()
            print("Custom panels registered on this instance:")
            for p in custom:
                print(f"  {p['url_path']}  ({p.get('title') or 'no sidebar title'})")

        if args.show:
            return 0

        # --- decide the target value -------------------------------------------------
        if args.reset:
            target = None
        else:
            target = args.panel
            if not target:
                found = panels_from_config()
                if len(found) != 1:
                    print()
                    print(f"ERROR: found {len(found)} panel_custom entries in {CONFIG_YAML} "
                          f"({', '.join(found) or 'none'}). Pass --panel <url_path>.")
                    return 1
                target = found[0]
            if target not in panels:
                print()
                print(f"ERROR: no panel registered at url_path '{target}'. "
                      f"HA would fall back to 'home'. Deploy the panel first.")
                return 1

        # --- read-merge-write --------------------------------------------------------
        # Both handlers replace the whole value for the key, so the existing object
        # must be carried over or unrelated settings (showAdvanced, ...) are lost.
        if args.scope == "system":
            if not me.get("is_admin"):
                print("\nERROR: frontend/set_system_data requires an admin token.")
                return 1
            new = {**system_core}
            store_type, label = "frontend/set_system_data", "system"
        else:
            new = {**user_core}
            store_type, label = "frontend/set_user_data", f"user {me.get('name')}"

        if target is None:
            new.pop("default_panel", None)
        else:
            new["default_panel"] = target

        unwrap(
            await ws_call(ws, mid, {"type": store_type, "key": STORE_KEY, "value": new}),
            store_type,
        )

        print()
        print(f"OK: {label} default_panel -> {target or '(cleared)'}")
        if args.scope == "system" and user_core.get("default_panel"):
            print(f"NOTE: your user still overrides this with "
                  f"'{user_core['default_panel']}'. Profile > Default dashboard > "
                  f"'Use system default', or re-run with --scope user.")
        print("Hard-refresh the browser, then open the bare HA URL to confirm.")
        return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--panel", help="panel url_path (default: the panel_custom in configuration.yaml)")
    parser.add_argument("--scope", choices=("system", "user"), default="system",
                        help="site-wide (default, needs admin) or just the token's user")
    parser.add_argument("--show", action="store_true", help="report current state, change nothing")
    parser.add_argument("--reset", action="store_true", help="clear default_panel in the chosen scope")
    args = parser.parse_args()

    for var in ("HA_URL", "HA_TOKEN"):
        if not os.environ.get(var):
            print(f"ERROR: {var} is not set (expected from .env via the Makefile).")
            sys.exit(1)

    sys.exit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
