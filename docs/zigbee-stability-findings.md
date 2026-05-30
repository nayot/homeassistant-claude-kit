# Zigbee Stability — Diagnostic Findings (2026-05-30)

Investigation into reported symptom: **Zigbee devices disconnect easily and sometimes
respond slowly.** User-confirmed: *individual* devices drop (not whole-network freezes),
worst in the **Living Room**; coordinator is on **wired Ethernet/PoE**.

All data below is from the **live ZHA WebSocket snapshot** (`tools/zha_diag.py`,
`zha_diag2.py`, `zha_parents.py`) + local config. No changes were made to HA.

> ⚠️ The HA **recorder history is incomplete after ~2026-05-24**. Investigation (2026-05-30)
> found the DB is healthy — 212 MB, disk 64% full, actively writing (live WAL/SHM),
> **no `home-assistant_v2.db.corrupt.*` file**, no recorder errors in logs. Root cause
> is unknown; best guess is HA 2026.5 update around 05-24 triggered a DB migration.
> **Fixed:** added `recorder: purge_keep_days: 14` to `configuration.yaml` (was using HA
> default of 10 days with no explicit config); pushed and reloaded 2026-05-30.

## Network
- Integration: **ZHA**, radio **EZSP (Silabs)** = SLZB-06M coordinator, **wired PoE**, HA area *Living Room*.
- Second **SLZB-06M flashed as a Router** in *Stair* (LQI 248) — a good dedicated router.
- **Channel 25** (clear of common WiFi 1/6/11).
- 28 devices: **1 coordinator + 12 routers + 15 end-devices** — healthy router ratio.
- Mesh is **~entirely cheap Tuya** (`_TZ3xxx`: TS0505B downlights, TS001x switches, TS0202 motion).

## Ruled OUT (with evidence)
| Suspected cause | Why it's not it |
|---|---|
| Coordinator network link | Wired PoE + symptom is *individual* drops, not synchronized mass drops |
| Zigbee channel overlap | On ch.25, away from WiFi 1/6/11 |
| Too few routers | 12 routers for 28 devices — plenty |
| "Smart bulbs lose power when off" | Automations use `light.turn_off` (`config/automations/lighting.yaml:44,88`); downlight groups were *off* while their ZHA routers stayed `avail=True`, seen <1 min ago |

## Headline conclusion: the live mesh is structurally healthy → the fault is intermittent
The snapshot shows the Living Room **well-connected**: `Restroom Motion → SMLIGHT Router
LQI 200`, `Restroom Downstairs → LQI 169`, `Center → LR Down Light 2 LQI 131`, LR downlights
own-LQI 116–172, every LR device `avail=True`, seen <1 min ago. Routing is sensible too:
**13 of the coordinator's 16 routes funnel through `0x4C65` = the SMLIGHT Router** — the
*strong* dedicated SLZB-06M (LQI 248), not a flaky Tuya device. So the backbone is sound.

Therefore the LR problem is **not** steady weak signal or a bad backbone — it is **intermittent**
(a parent router flapping *between* snapshots, or a device dropping then rejoining). A single
snapshot structurally cannot catch this, and **over-time per-device data is exactly what the
nightly restarts + recorder gap are denying us.** That inverts the priorities below: the first
real move is to **restore clean observability**, then watch the mesh catch the flap in the act.

### Next move: capture LQI/availability over time
- Enable ZHA's per-device **LQI/RSSI diagnostic sensors** (disabled by default) for the LR
  downlights + Center, OR periodically poll `tools/zha_diag.py` and log it.
- With the nightly restarts paused and history clean, a real drop will show **which parent/route
  failed at the moment it happened** — the evidence a snapshot can't give.

## Ranked likely contributors

### 1. Hallway Router bottleneck — LR-specific AND snapshot-supported (TOP suspect)
- `LeftRightLights` (Living Room) parents across the house to **`Hallway Router`**
  (TS0501B `_TZ3210_amleyeej`) at **link LQI 80**, and that router carries **7 children**.
- A loaded Tuya router that LR devices depend on, reached over distance: when it hiccups, its
  children drop **individually** — exactly matches "individual LR devices drop, rest fine."
- **Action:** add/relocate a known-good mains router in/near the Living Room so LR end-devices
  parent locally (to the LR coordinator) instead of across the house; then re-pair the worst LR
  devices. Watch whether Hallway Router's child count and LR drops fall.

### 2. Aggressive nightly restart regime — ✅ STOPPED 2026-05-30 (user disabled via UI)
- `config/automations/ui.yaml`: **03:00 HA restart**, **04:00 `reset_core`**, **04:30 `reset_zigbee`**
  — three resets/night. The nightly ZHA reload (`reset_zigbee`) forced the whole mesh to
  re-establish each night, which was itself an active Zigbee stressor (re-pair/re-route churn).
- User disabled both the ZHA restart and HA auto-restart automations via HA UI (2026-05-30).
  Let the mesh run continuously for several days and watch for improvement.

### 3. Cheap Tuya end-devices (LOWER — only suspect if user names a specific device)
- Note: `None` LQI on TS0202 motion sensors is **normal** (sleepy PIRs transmit rarely), and the
  LR motion sensor actually has a **strong parent link (LQI 200)** — so it looks fine in-snapshot.
- TS001x/TS0202 can still drop intermittently due to firmware/sleep, but this is unsupported by
  current data. Pursue only for a specific device the user reports as flaky (check its battery + route).

### 4. Master Bedroom weak branch (MEDIUM — latent, not the stated worst area)
- Coordinator's weakest direct children are the 3 MB downlights (**LQI 43 / 60 / 67**);
  MB Main switch at RSSI −92.
- **Action:** a known-good mains router between the LR coordinator and the Master Bedroom.

## Cleanup
- **Ghost device:** `MB Router` (TS0207, Master Bedroom) — **✅ REMOVED 2026-05-30** via `zha.remove` service.
  Had been offline since 2025-11-23 (~6 months). ZHA now has 27 devices, all available.

## Tools added (reusable, read-only)
- `tools/zha_diag.py` — network + per-device LQI/RSSI/last-seen summary
- `tools/zha_diag2.py` — names/areas, coordinator neighbor table, ghost references
- `tools/zha_parents.py` — parent/child topology for a target area (`AREA="..."`)
- `tools/zha_history.py` — availability history (limited by recorder gap noted above)
