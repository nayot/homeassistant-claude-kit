#!/usr/bin/env python3
"""Only pass ssl= to websockets.connect() for wss:// URLs.

RUNS ON THE HA HOST, not locally — it edits /config/claude-code-ha/bin/. Copy it over
with rsync (scp is unavailable on HA OS) and run it with the host python3. Idempotent:
re-running on an already-patched file is a no-op. See CLAUDE.md > ha-api / ha-ws.

websockets >= 14 raises ValueError("ssl argument is incompatible with a ws:// URI"),
which breaks ha-ws and lovelace-sync on any LAN install running HA over plain HTTP.
Upstream: danbuhler/claude-code-ha issues #2 and #5 (both open, unfixed at v1.0.0).
"""
import sys
from pathlib import Path

BIN = Path("/config/claude-code-ha/bin")

HA_WS_OLD = """        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

        try:
            self.ws = await websockets.connect(
                f'{self.ha_url}/api/websocket',
                ssl=ssl_ctx,
                max_size=50_000_000
            )
"""

HA_WS_NEW = """        # websockets >= 14 rejects an ssl argument on a plain ws:// URI, so only
        # build and pass the context when the URL is actually TLS.
        # Upstream: danbuhler/claude-code-ha#5
        ws_kwargs = {'max_size': 50_000_000}
        if self.ha_url.startswith('wss://'):
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            ws_kwargs['ssl'] = ssl_ctx

        try:
            self.ws = await websockets.connect(
                f'{self.ha_url}/api/websocket',
                **ws_kwargs
            )
"""

LS_OLD = """    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    print(f"Connecting to Home Assistant...")

    async with websockets.connect(ws_url, ssl=ssl_context) as ws:
"""

LS_NEW = """    # websockets >= 14 rejects an ssl argument on a plain ws:// URI, so only
    # build and pass the context when the URL is actually TLS.
    # Upstream: danbuhler/claude-code-ha#5
    ws_kwargs = {}
    if ws_url.startswith('wss://'):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        ws_kwargs['ssl'] = ssl_context

    print(f"Connecting to Home Assistant...")

    async with websockets.connect(ws_url, **ws_kwargs) as ws:
"""

failed = False
for name, old, new in (("ha-ws", HA_WS_OLD, HA_WS_NEW),
                       ("lovelace-sync", LS_OLD, LS_NEW)):
    path = BIN / name
    text = path.read_text()
    if new in text:
        print(f"  {name}: already patched, skipping")
        continue
    if text.count(old) != 1:
        print(f"  {name}: FAILED - expected 1 match, found {text.count(old)}")
        failed = True
        continue
    path.write_text(text.replace(old, new))
    print(f"  {name}: patched")

sys.exit(1 if failed else 0)
