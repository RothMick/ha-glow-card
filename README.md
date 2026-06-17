# Glow Card

A custom Home Assistant Lovelace card that wraps any other card (event stacks) in a styled tile container with a configurable header. No external dependencies — no card-mod, no button-card required.

<img width="511" height="283" alt="example_1 1" src="https://github.com/user-attachments/assets/1d003000-ba9a-4c45-9931-6940a5042f36" />
<img width="511" height="379" alt="example_2 1" src="https://github.com/user-attachments/assets/2ab3bf22-d695-4dd5-a334-237d86ad6ffb" />
<img width="511" height="285" alt="example_3 1" src="https://github.com/user-attachments/assets/680d46ac-6dc1-430a-b9b9-0afb3d632525" />
<img width="511" height="218" alt="example_4 1" src="https://github.com/user-attachments/assets/184e15b4-6f2a-4a6a-9391-5d8d83075c7f" />

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
| `show_border` | boolean | `true` | Set to `false` to hide the tile border entirely |
| `border_glow` | boolean | `false` | Set to `true` for an accent-colored gradient border that matches the background glow. Overrides `show_border` |
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

## Border modes

Three border states — configure via YAML or the visual editor's **Border** selector:

**Normal border** (default) — standard `--divider-color` border:
```yaml
# no border keys needed — this is the default
```

**No border:**
```yaml
show_border: false
```

**Glow border** — accent-colored gradient border that follows the background glow:
```yaml
border_glow: true
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

## Using as a pure style wrapper

You can use ha-glow-card purely as a visual container — without any header — to apply the glow background, border, and rounded corners to any existing card. Simply omit the `header` key entirely.

```yaml
type: custom:ha-glow-card
accent_color: "3, 129, 249"
show_border: true
card:
  type: custom:mushroom-entity-card
  entity: sensor.temperature
```

This is useful when you want a consistent glow look across your dashboard without adding a title or icon on top of an existing card.

### Wrapping a stack of cards

Combine with `vertical-stack` to wrap multiple cards in a single styled tile:

```yaml
type: custom:ha-glow-card
accent_color: "80, 200, 120"
show_border: true
inner_margin: "0 -15px -15px -15px"
card:
  type: vertical-stack
  cards:
    - type: custom:mushroom-entity-card
      entity: sensor.temperature
    - type: custom:mushroom-entity-card
      entity: sensor.humidity
```

> **Note:** When wrapping a `vertical-stack`, set `inner_margin` with negative left/right values (e.g. `"0 -15px -15px -15px"`) so the inner cards stretch flush to the container edges.

### Neutral / greyscale glow

Use a neutral grey accent for cards where color is not meaningful:

```yaml
accent_color: "150, 150, 150"
```

---

## Changelog

### v1.0.4
- **Fix** — Editor no longer scrolls back to the top when a setting is changed. The left panel now preserves scroll position while the preview updates independently.

### v1.0.3
- **Fix** — Visual editor now works correctly on iOS and Safari. All inputs replaced with native `ha-form` elements; text field changes are buffered and only saved on focus-out so WebKit does not re-render the editor on every keystroke
- **Improvement** — Color fields now show proper labels (e.g. "Title color", "Glow color") instead of raw key names
- **Improvement** — Border option in the editor now exposes all three states: show, hide, and glow border

### v1.0.2
- **Fix** — Inner cards of stacked containers (e.g. `vertical-stack`) now keep their own background, border, and border-radius. Previously, ha-glow-card used CSS custom properties to suppress the outer card's frame, but those cascade through shadow DOM into nested cards. Replaced with scoped shadow-DOM style injection that only affects the direct outer card.

### v1.0.1
- **Fix** — Editor fields (entity picker, icon picker) no longer disappear immediately after selecting a mode in the visual editor

### v1.0.0 — Initial public release
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
