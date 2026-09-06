# System: Dashboard Panel

Describes how the React dashboard is registered with Home Assistant and how it is made
the default landing page. For dashboard *development*, see `dashboard/CLAUDE.md`.

## Registration

The dashboard is a **custom panel**, not a Lovelace dashboard. `config/configuration.yaml`:

```yaml
panel_custom:
  - name: custom-dashboard-panel
    sidebar_title: Claude Kit
    sidebar_icon: mdi:view-dashboard-variant
    url_path: custom-dashboard
    module_url: /local/custom-dashboard/panel.js
```

`panel.js` defines the `custom-dashboard-panel` element, which loads the built React app
into an iframe (see `dashboard/panel.js` for why it uses `srcdoc` rather than a blob URL).
`make deploy-dashboard` builds and rsyncs both the app and `panel.js` to `www/custom-dashboard/`.

## Making it the default dashboard

**The HA UI cannot do this.** Neither picker will ever list a custom panel:

| Picker | What it offers |
|--------|----------------|
| Profile > Default dashboard | the built-in panels hardcoded in the frontend's `PANEL_DASHBOARDS` list (`home`, `light`, `security`, `climate`, `energy`, `maintenance`), plus Lovelace dashboards from `lovelace/dashboards/list` |
| Settings > Dashboards > Set as default | the same two sources |

A `panel_custom` panel is in neither source, so it is unselectable. This is a limitation of
the *picker*, not of HA.

The **resolver** has no such restriction. `getDefaultPanelUrlPath()` in the frontend's
`src/data/panel.ts` reads a plain url_path string and looks it up in `hass.panels`, which
does include custom panels. Precedence, first non-empty wins:

| # | Source | Scope | Set by |
|---|--------|-------|--------|
| 1 | `userData.core.default_panel` | one user | `frontend/set_user_data` |
| 2 | `systemData.core.default_panel` | whole instance | `frontend/set_system_data` (admin only) |
| 3 | `localStorage["defaultPanel"]` | one browser | legacy, pre-2025.12 |
| 4 | `"home"` | — | fallback |

So the panel only needs its url_path written into one of those stores. Both the system-wide
store and the `default_panel` key name arrived in **HA 2025.12**; before that only the
per-user store existed.

### The command

```bash
make set-default-dashboard                    # site-wide (needs an admin token)
make set-default-dashboard ARGS='--show'      # report current state, change nothing
make set-default-dashboard ARGS='--scope user'
make set-default-dashboard ARGS='--reset'     # hand back to HA's default
```

`tools/set_default_dashboard.py` reads the target url_path from the `panel_custom` block in
`config/configuration.yaml` (override with `--panel`), verifies a panel is actually registered
at that path, then does a read-merge-write of the `core` store over the WebSocket API. The
merge matters: both handlers replace the whole value for the key, so writing
`{default_panel: ...}` alone would drop unrelated settings such as `showAdvanced`.

This never edits `.storage/` directly — HA owns those files at runtime and writes them itself
in response to the API call. Verify with `--show`, then hard-refresh the browser and open the
bare HA URL; it should land on `/custom-dashboard`.

### Gotchas

- **A per-user setting outranks the system default.** If a user once picked a dashboard in
  their profile, `userData.core.default_panel` is set and wins over the site-wide value.
  Fix in Profile > Default dashboard > "Use system default", or run `--scope user`.
- **Stale keys are inert.** `frontend/set_user_data` accepts *any* key name — it has no
  allowlist — so earlier guesses at the key (`defaultPanel`, `coreUserData`,
  `core.defaultPanel` at the top level of `frontend.user_data_*`) were written successfully
  but are read by nothing. They are harmless. Note that setting a key to `null` stores null
  rather than deleting it, so they cannot be fully removed through the API.
- **The frontend caches this at connect.** A change needs a browser reload to take effect.

## Alternative (not used)

The panel could instead be rebuilt as a Lovelace YAML dashboard holding a single custom card,
which would make it appear in the pickers natively. That is a rearchitecture, and it gives up
the iframe isolation the current panel relies on, so the `default_panel` route is preferred.
