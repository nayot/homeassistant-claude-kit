# System Overview

> **Instructions:** Fill in each section to describe your actual Home Assistant setup.
> This file tells Claude what hardware, integrations, and entity IDs you have.
> The more detail here, the fewer guesses Claude makes.
> After the setup interview, this file will be populated for you. You can then keep it updated as your setup evolves.

## Home Layout

<!-- Describe your home: floor plan, rooms, which rooms have which sensors/devices -->

- Floors: _
- Rooms: _
- Areas configured in HA: _

## Integrations

<!-- List every integration you've installed and what it controls -->

| Integration | What it controls | Key entities |
|-------------|-----------------|--------------|
| _           | _               | _            |

## Climate System

- Heating type: IR-controlled split A/C units (ESPHome custom component via `esphome_ir_custom_components`)
- Zones: Living Room (floor 1), Master Bedroom (floor 2), Study Room (floor 2)
- TRVs: none

| Room | Entity | Fan Modes | HVAC Modes | Temp Sensor |
|------|--------|-----------|------------|-------------|
| Living Room | `climate.living_room_ac_living_room_ac` | auto, low, medium, high | off, heat_cool, cool, fan_only, dry | `sensor.dht_temperature` |
| Master Bedroom | `climate.master_bedroom_ac_master_bedroom_ac` | auto, low, medium, high, quiet | off, heat_cool, cool, fan_only, dry | `sensor.master_bedroom_ac_temperature` |
| Study Room | `climate.study_room_ac_study_room_ac` | auto, low, medium, high, quiet | off, heat_cool, cool, fan_only, dry | `sensor.temperature` |

### Post-Shutdown Cooldown

Blueprint: `blueprints/automation/custom/ac_post_shutdown_cooldown.yaml`

When any A/C turns off from an active mode (cool/dry/heat_cool/heat/auto), the automation switches to `fan_only` on `high` for 15 minutes to cool down the coil, then turns off. During this cooldown the dashboard shows a yellow "Turning off" label on the room card and in the A/C popup.

Automations: `config/automations/climate.yaml`

## Lighting

<!-- Describe your lighting setup -->

- Bulb type: (Zigbee / Z-Wave / WiFi / Hue)
- Adaptive Lighting zones: _
- Motion sensors: _
- Scenes used: _

## Energy / Solar

<!-- Only fill in if you have solar/EV -->

- Solar inverter: _
- Inverter integration: _
- Key sensors: `sensor.solar_power`, `sensor.grid_power`, `sensor.battery_level`
- EV charger: (OCPP / other)
- EV: (Tesla / other)

## Security / Cameras

<!-- Only fill in if you have cameras -->

- Camera integration: _
- Cameras: _
- Notification service: _

## Media

<!-- TVs, speakers, projectors -->

- Media players: _
- Remote entities: _

## People / Presence

<!-- Person entities and tracking method -->

- People tracked: _
- Tracking method: (HA companion app / router / BLE)
- Person entities: _

## Key Helpers Registry

<!-- Once the setup interview runs, this section will list all helpers created -->

### Input Booleans
<!-- e.g. input_boolean.night_mode — Night Mode -->

### Input Selects
<!-- e.g. input_select.climate_mode — Climate Mode (Winter/Summer/Off) -->

### Input Numbers
<!-- e.g. input_number.target_temperature — Target Temperature -->

### Input Datetimes
<!-- e.g. input_datetime.morning_work_day — Morning Wake Time (Work Day) -->

## Automation Design Decisions

### A/C Post-Shutdown Fan Cooldown
When an A/C turns off, the automation switches to `fan_only` on `high` for 15 minutes before fully shutting down. This prevents heat buildup in the coil. The dashboard reflects this with a yellow "Turning off" state (not "On") so the transition is visible. The blueprint uses `!input` directly in action targets — the `variables:` + Jinja2 template approach causes HA 2026.x to time out during blueprint automation creation.

### A/C Dashboard Status
The room card and room popup A/C status is derived from the actual climate entity state, not from any `input_boolean` helper. `fan_only` → yellow "Turning off"; any active mode → blue "On"; `off` → dim "Off". The `input_boolean.*_ac_toggle` helpers exist but are not used to drive the dashboard display.

## Known Issues / Workarounds

### HA Blueprint UI Creation Times Out (HA 2026.x)
Creating automations from blueprints via the HA UI times out. Workaround: write automations directly in YAML using `use_blueprint:` in `config/automations/`. The root causes identified: (1) leading newline before `blueprint:` in the YAML file, (2) using `variables:` section with `!input` references — both cause HA to hang during automation setup. Always use `!input` directly in action targets.

### Zigbee Restart Automation Disabled
`automation.zigbee_restart` references an unknown entity `4f430e12f005633a82afa91a6e4e54cc` and is disabled by HA. This produces a validation warning on every `make validate` / `make push` — it is pre-existing and unrelated to other changes.
