# HA Glow Card

A custom Home Assistant Lovelace card that wraps any other card (event stacks) in a styled tile container with a configurable header. No external dependencies — no card-mod, no button-card required.

<img width="533" height="382" alt="example_2" src="https://github.com/user-attachments/assets/8f607f21-b1ca-41ec-81e6-de4ca253de90" />
<img width="528" height="290" alt="example_1" src="https://github.com/user-attachments/assets/be9b65c5-60f0-46de-b5c3-3f5d1e03196c" />
<img width="518" height="280" alt="example_3" src="https://github.com/user-attachments/assets/ae16ae14-0cbb-493a-86b6-42c627fcea5a" />


---

## Features

- Styled tile container with rounded corners, configurable border, and a color glow/gradient background
- Header with optional icon (MDI or custom SVG), title, subtitle, and a large value on the right
- Subtitle supports Jinja2 templates (server-side, live-updating via WebSocket); errors shown inline
- Large right value: pick an entity (reads unit automatically) or write a Jinja2 template
- Individual color pickers for every element: glow, icon, title, subtitle, value
- Show or hide the tile border
- Inner card margin fully configurable (top / right / bottom / left) — negative values stretch the card flush to the container edges
- Icon and value areas are fully hidden (not just invisible) when disabled — title area fills the freed space automatically
- Default layout: 12 columns wide, auto height — fits the HA sections dashboard out of the box
- Full visual editor — no YAML required

---

## Installation

### Manual

1. Copy `ha-glow-card.js` into `/config/www/ha-glow-card/` on your Home Assistant instance
2. Go to **Settings → Dashboards → ⋮ → Resources → Add**
3. Set URL to `/local/ha-glow-card/ha-glow-card.js?v=1.0.0` and type to **JavaScript module**
4. Reload your browser (Cmd/Ctrl + Shift + R)
5. Add the card via the visual editor or paste YAML manually

> **Note:** Advanced mode must be enabled in your HA profile settings to access the Resources menu.

> **Cache:** Increment the version parameter on every update (e.g. `?v=0.2.1`) to bypass the browser cache.

---

## Configuration

Add the card to your dashboard via the visual editor or paste the YAML below directly.

### Minimal example

```yaml
type: custom:ha-glow-card
header:
  title: Power
card:
  type: entities
  entities: []
```

### Full example

```yaml
type: custom:ha-glow-card
accent_color: "3, 129, 249"
show_border: true
header:
  title: Solar production
  icon: mdi:solar-power
  icon_size: 40
  icon_color: "#FFD724"
  subtitle_template: >
    <span style="color:#4A90E2">{{ states('sensor.grid_power') | int }} W grid</span>
    + <span style="color:#5ec72e">{{ states('sensor.solar_power') | int }} W solar</span>
  subtitle_color: "#aaaaaa"
  state_entity: sensor.current_energy_need
  state_unit: W
  state_decimals: 0
inner_margin: "0 -15px -15px 0"
card:
  type: custom:apexcharts-card
  series:
    - entity: sensor.current_energy_need
```

---

## Configuration options

### Top level

| Option | Type | Default | Description |
|---|---|---|---|
| `header` | object | | Header configuration (see below). Omit the entire key to hide the header |
| `card` | object | **required** | Any valid Lovelace card configuration |
| `accent_color` | string | `"3, 129, 249"` | RGB values for the background glow (e.g. `"3, 129, 249"` for blue). Must be in `r, g, b` format — interpolated into `rgba()` for the gradient |
| `show_border` | boolean | `true` | Show or hide the tile border |
| `inner_margin` | string | `"0 -15px -15px"` | CSS margin applied to the embedded card — use negative values to stretch it to the container edges |

### `header` options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | **required** | Main title shown in the header |
| `title_color` | string | `var(--primary-text-color)` | CSS color for the title |
| `icon` | string | | MDI icon (e.g. `mdi:lightning-bolt`). Use either `icon` or `icon_path`, not both |
| `icon_path` | string | | Path to a custom SVG file (e.g. `/local/custom_icons/plug.svg`). Rendered via CSS `mask-image` |
| `icon_size` | number | `40` | Icon size in pixels |
| `icon_color` | string | `var(--primary-text-color)` | CSS color for the icon |
| `subtitle_template` | string | | Jinja2 template evaluated server-side. HTML in the result is rendered. Leave empty to hide the subtitle. Template errors are shown inline with a ⚠ prefix |
| `subtitle_color` | string | `var(--secondary-text-color)` | CSS color for the subtitle |
| `state_entity` | string | | Entity ID for the large value on the right. Unit is read automatically from the entity |
| `state_unit` | string | | Override the unit shown after the state value |
| `state_decimals` | number | `0` | Number of decimal places |
| `state_color` | string | `var(--primary-text-color)` | CSS color for the large state value |
| `state_template` | string | | Jinja2 template for the large right value. Use either `state_entity` or `state_template`, not both |

---

## Icon modes

Two types supported — use exactly one:

**MDI icon** — any icon from the Material Design Icons set shipped with Home Assistant:
```yaml
icon: mdi:solar-power
```

**Custom SVG** — a local SVG file rendered via CSS mask (inherits color):
```yaml
icon_path: /local/custom_icons/plug.svg
icon_color: "#4A90E2"
```

---

## Main value modes

Two modes for the large right-hand value — use exactly one:

**Entity** — reads state and unit from a HA entity:
```yaml
state_entity: sensor.current_energy_need
state_unit: W
state_decimals: 0
```

**Jinja2 template** — full server-side template, live-updating. HTML in the output is rendered:
```yaml
state_template: "{{ (states('sensor.grid_power') | float + states('sensor.solar_power') | float) | round(0) }} W"
```

**Conditional color** — use Jinja2 inline conditionals to pick a color based on the value:
```yaml
state_template: >
  <span style="color: {{ '#B223B9' if states('sensor.grid_power') | float < 0 else '#4A90E2' }}">
    {{ states('sensor.grid_power') | int }} W
  </span>
```

> **Visual editor note:** When using the editor, paste only the template content into the field — without the `state_template: >` prefix:
> ```
> <span style="color: {{ '#B223B9' if states('sensor.grid_power') | float < 0 else '#4A90E2' }}">
>   {{ states('sensor.grid_power') | int }} W
> </span>
> ```

Multiple thresholds work too:
```yaml
state_template: >
  <span style="color: {{
    '#FF0000' if states('sensor.grid_power') | float > 1000 else
    '#FFA500' if states('sensor.grid_power') | float > 500 else
    '#00FF00'
  }}">{{ states('sensor.grid_power') | int }} W</span>
```

---

## Subtitle template

Accepts any Jinja2 template supported by Home Assistant. HTML in the output is rendered.

```yaml
subtitle_template: >
  <span style="color:#4A90E2">{{ states('sensor.grid_power') | int }} W grid</span>
  + <span style="color:#5ec72e">{{ states('sensor.solar_power') | int }} W solar</span>
```

Conditional color works the same way as in the main value template (see above).

Template errors (e.g. invalid syntax or unknown entities) are shown directly in the tile as a ⚠ message — no browser devtools needed to debug.

> **Jinja2 note:** Use `{{ '%02d' % (value | int) }}` for zero-padded numbers — `rjust` is Python only, not available in Jinja2.

---

## Visual editor

The card includes a full visual editor accessible via the HA dashboard editor.

**Content tab** — configure title, subtitle, icon, main value, glow color, inner margins, and border.

**Container tab** — pick and configure the embedded card using the native HA card editor. If the native card picker has not been loaded in the current session, a fallback picker shows all registered custom cards plus a free-text type field.

---

## Changelog

### v1.0.0 — Initial public release
- **Renamed** from `tile-container-card` to `ha-glow-card`
- **HTML templates** — `state_template` and `subtitle_template` both render HTML; enables conditional colors via Jinja2 inline conditionals
- **Glow border** — hidden feature `border_glow: true` adds an accent-colored gradient border matching the background glow position
- **CSS injection** — `extra_styles` injects custom CSS into the inner card's shadow DOM (replaces card_mod for common fixes)
- **System color defaults** — all color fields fall back to `var(--primary-text-color)` / `var(--secondary-text-color)` when left empty
- **Color field hints** — editor shows default value hint below each color input
- **State alignment** — main value aligns to top of title, same font size as title (`clamp(20px, 2vw, 28px)`)
- **Show/hide border** — `show_border` option; toggle via visual editor
- **Adaptive grid layout** — icon and value areas collapse completely when disabled
- **Default layout** — 12 columns wide, auto height
- **Full visual editor** — native `ha-form` selects, conditional fields, 4 margin inputs, two tabs

---

## License

MIT

<a href="https://buymeacoffee.com/RothMick"><img width="217" height="50" alt="default-orange" src="https://github.com/user-attachments/assets/0da5dedd-5879-4b2a-9131-cd0ebd751547" /></a>
