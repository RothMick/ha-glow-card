/**
 * ha-glow-card v1.0.2
 *
 * Gestaltbarer Kachel-Container für Home Assistant Lovelace.
 * Keine externen Abhängigkeiten (card-mod, button-card, etc.)
 *
 * Config-Schema:
 *   type: custom:ha-glow-card
 *   accent_color: "3, 129, 249"        # RGB-Werte für den Hintergrund-Glow
 *   header:
 *     title: "Verbrauch"               # Pflicht
 *     title_color: ""                  # CSS-Farbe, leer = var(--primary-text-color)
 *     icon: "mdi:lightning-bolt"       # HA MDI-Icon  ─┐ nur eines
 *     icon_path: "/local/..."          # SVG-Pfad      ─┘ verwenden
 *     icon_size: 40                    # px
 *     icon_color: ""                   # CSS-Farbe
 *     subtitle_template: "..."         # Jinja2-Template, server-seitig ausgewertet
 *     subtitle_color: ""               # CSS-Farbe, leer = var(--secondary-text-color)
 *     state_entity: "sensor.abc"
 *     state_unit: "W"
 *     state_decimals: 0
 *     state_color: "#ffffff"
 *   inner_margin: "0 -15px -15px"      # Margin der inneren Kachel
 *   card:                              # Pflicht – beliebige Lovelace-Card-Config
 *     type: custom:apexcharts-card
 */

// ─── Visueller Editor ────────────────────────────────────────────────────────

class HaGlowCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._lovelace = null;
    this._lovelaceCache = null;
    this._cardEditor = null;
    this._activeTab = 'container';
    this._iconModeOverride = null;
    this._stateModeOverride = null;
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll('[needs-hass]').forEach(el => { el.hass = hass; });
    if (this._cardEditor) this._cardEditor.hass = hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._cardEditor) this._cardEditor.lovelace = lovelace;
  }

  setConfig(config) {
    const prevCardType = this._config.card?.type;
    this._config = JSON.parse(JSON.stringify(config));

    const h = config.header || {};
    if (h.icon || h.icon_path) this._iconModeOverride = null;
    if (h.state_entity || h.state_template) this._stateModeOverride = null;

    // Wenn wir auf dem Embedded-Tab sind und nur die innere Karte geändert wurde,
    // keinen vollen DOM-Rebuild machen (würde den Editor zerstören und Fokus verlieren)
    if (this._activeTab === 'embedded' && this._cardEditor && prevCardType === config.card?.type) {
      this._cardEditor.value = config.card || {};
      return;
    }

    this._cardEditor = null;
    this._render();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _fire() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  /** Deep-set a dot-path value; deletes key when value is '' / null / undefined. */
  _set(path, value) {
    const parts = path.split('.');
    let obj = this._config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    const key = parts[parts.length - 1];
    if (value === '' || value === null || value === undefined) {
      delete obj[key];
    } else {
      obj[key] = value;
    }
    this._fire();
  }

  _iconMode() {
    const h = this._config.header || {};
    if (h.icon_path) return 'svg';
    if (h.icon) return 'mdi';
    return this._iconModeOverride || 'none';
  }

  _subtitleMode() {
    const h = this._config.header || {};
    return h.subtitle_template ? 'template' : 'none';
  }

  _stateMode() {
    const h = this._config.header || {};
    if (h.state_template) return 'template';
    if (h.state_entity) return 'entity';
    return this._stateModeOverride || 'none';
  }

  _el(id) { return this.shadowRoot.getElementById(id); }

  _val(id, v) {
    const el = this._el(id);
    if (el) el.value = v;
  }

  _hexToRgb(hex) {
    const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
  }

  _rgbToHex(rgb) {
    const m = rgb.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  /** Akzeptiert Hex (#rrggbb) oder RGB-String (r, g, b) → gibt immer RGB zurück */
  _toRgb(val) {
    const v = val.trim();
    if (v.startsWith('#')) return this._hexToRgb(v);
    if (/\d/.test(v)) return v;
    return null;
  }

  /** HTML: Farbpicker-Quadrat + Textfeld. placeholder zeigt den Standardwert an. */
  _colorFieldHtml(id, label, placeholder = '', hint = '') {
    return `
      <div class="color-field">
        <input type="color" id="${id}-picker" class="color-square" title="Farbe wählen">
        <ha-textfield id="${id}" label="${label}" placeholder="${placeholder}" style="flex:1;"></ha-textfield>
      </div>
      ${hint ? `<div class="hint">${hint}</div>` : ''}`;
  }

  /** Farbfeld befüllen. isRgb=true → intern RGB, Nutzer sieht HEX. */
  _populateColor(id, value, isRgb = false) {
    let hex = null;
    if (isRgb) {
      hex = value ? this._rgbToHex(value) : null;
      this._val(id, hex || '');
    } else {
      hex = value?.startsWith('#') ? value : this._rgbToHex(value || '');
      this._val(id, value);
    }
    const picker = this._el(`${id}-picker`);
    if (picker) picker.value = hex || '#ffffff';
  }

  /** Picker + Textfeld verdrahten. isRgb=true → intern RGB, Anzeige HEX. */
  _wireColor(id, path, isRgb = false) {
    const picker = this._el(`${id}-picker`);
    const field  = this._el(id);
    picker?.addEventListener('input', e => {
      const hex = e.target.value;
      const store = isRgb ? this._hexToRgb(hex) : hex;
      if (field) field.value = hex;
      this._set(path, store);
    });
    field?.addEventListener('change', e => {
      const val = e.target.value.trim();
      const hex = val.startsWith('#') ? val : this._rgbToHex(val);
      const store = isRgb ? (this._toRgb(val) || val) : val;
      if (hex && field) field.value = hex;
      if (hex && picker) picker.value = hex;
      this._set(path, store);
    });
  }

  /** CSS-Shorthand in {t,r,b,l} aufteilen */
  _parseMargin(str) {
    const p = (str || '0 -15px -15px').trim().split(/\s+/);
    if (p.length === 1) return { t: p[0], r: p[0], b: p[0], l: p[0] };
    if (p.length === 2) return { t: p[0], r: p[1], b: p[0], l: p[1] };
    if (p.length === 3) return { t: p[0], r: p[1], b: p[2], l: p[1] };
    return { t: p[0], r: p[1], b: p[2], l: p[3] };
  }

  /** Vier Felder → CSS-String zusammensetzen und speichern */
  _composeMargin() {
    const t = this._el('f-margin-top')?.value?.trim()    || '0';
    const r = this._el('f-margin-right')?.value?.trim()  || '0';
    const b = this._el('f-margin-bottom')?.value?.trim() || '0';
    const l = this._el('f-margin-left')?.value?.trim()   || '0';
    this._set('inner_margin', `${t} ${r} ${b} ${l}`);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    const cfg = this._config;
    const h = cfg.header || {};
    const iconMode = this._iconMode();
    const subMode  = this._subtitleMode();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        /* ─ Tabs ─ */
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          margin-bottom: 4px;
        }
        .tab {
          padding: 10px 18px;
          border: none; background: none; cursor: pointer;
          font-size: 14px; font-weight: 500;
          color: var(--secondary-text-color);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .tab.active {
          color: var(--primary-color, #0381f9);
          border-bottom-color: var(--primary-color, #0381f9);
        }
        /* ─ Abschnitte ─ */
        .section {
          font-size: 16px; font-weight: 500;
          color: var(--primary-text-color);
          margin: 24px 0 10px;
          padding: 0;
        }
        .section:first-child { margin-top: 12px; }
        /* ─ Felder ─ */
        .field { margin-bottom: 10px; }
        .field label { display: block; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
        .hint { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; line-height: 1.5; }
        ha-textfield, ha-entity-picker, ha-icon-picker { width: 100%; display: block; }
        .row2 { display: flex; gap: 8px; }
        .row2 > * { flex: 1; min-width: 0; }
        ha-form { --ha-form-grid-padding: 0; display: block; }
        textarea {
          width: 100%; min-height: 72px; padding: 8px 12px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 4px; background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color); font-size: 13px;
          font-family: var(--code-font-family, monospace);
          box-sizing: border-box; resize: vertical;
        }
        .hidden { display: none !important; }
        /* ─ Farbfeld ─ */
        .color-field { display: flex; gap: 8px; align-items: center; }
        .color-square {
          width: 30px; height: 30px; flex-shrink: 0;
          border-radius: 0; border: none; cursor: pointer; padding: 0;
        }
        /* ─ Embedded Editor ─ */
        hui-card-element-editor, hui-card-picker { display: block; }
        .embed-header {
          display: flex; align-items: center; gap: 8px;
          padding: 4px 0 12px;
        }
        .embed-header .card-type-label {
          flex: 1; font-size: 13px; color: var(--secondary-text-color);
          font-family: var(--code-font-family, monospace);
        }
        .embed-header button {
          padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer;
          background: var(--primary-color, #0381f9); color: #fff;
          font-size: 13px; font-weight: 500;
        }
        .embed-header button:hover { opacity: 0.85; }
      </style>

      <div class="tabs">
        <button class="tab ${this._activeTab === 'container' ? 'active' : ''}" id="tab-container">Content</button>
        <button class="tab ${this._activeTab === 'embedded'  ? 'active' : ''}" id="tab-embedded">Container</button>
      </div>

      <!-- ═ Panel: Content ═ -->
      <div id="panel-container" class="${this._activeTab !== 'container' ? 'hidden' : ''}">

        <!-- Title -->
        <div class="section">Title</div>
        <div class="field"><ha-textfield id="f-title" label="Title *"></ha-textfield></div>
        <div class="field">${this._colorFieldHtml('f-title-color', 'Title color', 'var(--primary-text-color)', 'Empty: uses var(--primary-text-color)')}</div>
        <div class="field"><ha-form id="form-sub-mode"></ha-form></div>
        <div id="sub-tpl-wrap" class="field ${subMode !== 'template' ? 'hidden' : ''}">
          <label>Jinja2 template</label>
          <textarea id="f-subtitle-tpl" placeholder="{{ (states('sensor.abc') | int) }} W"></textarea>
          <div class="hint">Evaluated server-side. HTML in the output is rendered.</div>
        </div>
        <div id="sub-color-wrap" class="field ${subMode !== 'template' ? 'hidden' : ''}">${this._colorFieldHtml('f-sub-color', 'Subtitle color', 'var(--secondary-text-color)', 'Empty: uses var(--secondary-text-color)')}</div>

        <!-- Icon -->
        <div class="section">Icon</div>
        <div class="field"><ha-form id="form-icon-mode"></ha-form></div>
        <div id="icon-mdi-wrap" class="field ${iconMode !== 'mdi' ? 'hidden' : ''}">
          <ha-icon-picker id="f-icon" label="Choose icon" needs-hass></ha-icon-picker>
        </div>
        <div id="icon-svg-wrap" class="field ${iconMode !== 'svg' ? 'hidden' : ''}">
          <ha-textfield id="f-icon-path" label="Path (e.g. /local/custom_icons/icon.svg)"></ha-textfield>
        </div>
        <div id="icon-extras" class="${iconMode === 'none' ? 'hidden' : ''}">
          <div class="field"><ha-textfield id="f-icon-size" label="Size (px)" type="number" min="16" max="96" style="width:100%;display:block;"></ha-textfield></div>
          <div class="field">${this._colorFieldHtml('f-icon-color', 'Icon color', 'var(--primary-text-color)', 'Empty: uses var(--primary-text-color)')}</div>
        </div>

        <!-- Main Value -->
        <div class="section">Main Value</div>
        <div class="field"><ha-form id="form-state-mode"></ha-form></div>
        <div id="state-entity-wrap" class="field">
          <ha-form id="f-state-entity-form" needs-hass></ha-form>
        </div>
        <div id="state-entity-extra" class="field row2">
          <ha-textfield id="f-state-unit" label="Unit"></ha-textfield>
          <ha-textfield id="f-state-dec" label="Decimal places" type="number" min="0" max="6"></ha-textfield>
        </div>
        <div id="state-entity-hint" class="field ${this._stateMode() !== 'entity' ? 'hidden' : ''}">
          <div class="hint">Leave the field empty to inherit the value from the entity.</div>
        </div>
        <div id="state-tpl-wrap" class="field hidden">
          <label>Jinja2 template</label>
          <textarea id="f-state-tpl" placeholder="{{ (states('sensor.abc') | int) }} W"></textarea>
          <div class="hint">Evaluated server-side. The output text is shown directly.</div>
        </div>
        <div id="state-color-wrap" class="field ${this._stateMode() !== 'none' ? '' : 'hidden'}">${this._colorFieldHtml('f-state-color', 'Value color', 'var(--primary-text-color)', 'Empty: uses var(--primary-text-color)')}</div>

        <!-- Tile Settings -->
        <div class="section">Tile Settings</div>
        <div class="field">${this._colorFieldHtml('f-accent', 'Glow color', '', 'Empty: uses blue (3, 129, 249)')}</div>
        <div class="row2" style="margin-bottom:8px;">
          <ha-textfield id="f-margin-top"    label="Margin top"    style="display:block;"></ha-textfield>
          <ha-textfield id="f-margin-right"   label="Margin right"  style="display:block;"></ha-textfield>
        </div>
        <div class="row2 field">
          <ha-textfield id="f-margin-bottom"  label="Margin bottom" style="display:block;"></ha-textfield>
          <ha-textfield id="f-margin-left"    label="Margin left"   style="display:block;"></ha-textfield>
        </div>
        <div class="hint">Inner card margin. Negative values stretch the card to the container edges.</div>
        <div class="field" style="margin-top:10px;"><ha-form id="form-border"></ha-form></div>

      </div>

      <!-- ═ Panel: Container ═ -->
      <div id="panel-embedded" class="${this._activeTab !== 'embedded' ? 'hidden' : ''}">

        <!-- Picker: visible when no card selected -->
        <div id="embed-picker"></div>
        <!-- Editor: visible when card selected -->
        <div id="embed-editor" class="hidden">
          <div class="embed-header">
            <span class="card-type-label" id="card-type-label"></span>
            <button id="btn-change-type">Change type</button>
          </div>
          <div id="card-editor-slot"></div>
        </div>

      </div>
    `;

    this._populate();
    this._wire();
    this._initForms();
    if (this._activeTab === 'embedded') this._initEmbedded();
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this._el('panel-container').classList.toggle('hidden', tab !== 'container');
    this._el('panel-embedded').classList.toggle('hidden', tab !== 'embedded');
    this._el('tab-container').classList.toggle('active', tab === 'container');
    this._el('tab-embedded').classList.toggle('active', tab === 'embedded');
    if (tab === 'embedded') this._initEmbedded();
  }

  _getLovelace() {
    if (this._lovelace) return this._lovelace;
    if (this._lovelaceCache) return this._lovelaceCache;
    try {
      const main = document.querySelector('home-assistant')
        ?.shadowRoot?.querySelector('home-assistant-main');
      const lv = main?.shadowRoot?.querySelector('ha-panel-lovelace')?.lovelace
        ?? main?.shadowRoot?.querySelector('partial-panel-resolver')
            ?.shadowRoot?.querySelector('ha-panel-lovelace')?.lovelace
        ?? null;
      if (lv) this._lovelaceCache = lv;
      return lv;
    } catch { return null; }
  }

  _initEmbedded() {
    if (this._config.card?.type) {
      this._showEditor();
    } else {
      this._showPicker();
    }
  }

  _showPicker() {
    const embedPicker = this._el('embed-picker');
    const embedEditor = this._el('embed-editor');
    if (!embedPicker) return;

    embedEditor?.classList.add('hidden');
    this._cardEditor = null;
    const slot = this._el('card-editor-slot');
    if (slot) slot.innerHTML = '';
    embedPicker.innerHTML = '';

    // hui-card-picker ist nur registriert wenn der Stack-Editor oder der
    // "Kachel hinzufügen"-Dialog in dieser Session schon geöffnet wurde.
    // Synchron prüfen — kein whenDefined() das ewig hängt.
    if (customElements.get('hui-card-picker')) {
      const picker = document.createElement('hui-card-picker');
      embedPicker.appendChild(picker);
      picker.hass = this._hass;
      const lovelace = this._getLovelace();
      if (lovelace) picker.lovelace = lovelace;
      picker.addEventListener('config-changed', e => {
        e.stopPropagation();
        this._config.card = e.detail.config;
        this._fire();
        embedPicker.innerHTML = '';
        this._showEditor();
      });
    } else {
      this._buildFallbackPicker(embedPicker);
    }
  }

  _buildFallbackPicker(container) {
    const customCards = (window.customCards || []).map(c => ({
      type: String(c.type).startsWith('custom:') ? c.type : `custom:${c.type}`,
      name: c.name || c.type,
    }));

    container.innerHTML = `
      <style>
        .fp-item { padding:8px 12px; cursor:pointer; border-radius:6px; margin-bottom:4px;
          background:var(--secondary-background-color,rgba(255,255,255,0.06)); }
        .fp-item:hover { background:var(--primary-color,#0381f9); color:#fff; }
        .fp-item:hover .fp-sub { color:rgba(255,255,255,0.7); }
        .fp-sub { font-size:11px; color:var(--secondary-text-color); }
      </style>
      ${customCards.length ? `
        <div style="font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;
            color:var(--secondary-text-color);margin:8px 0 6px;">Custom Cards</div>
        <div id="fp-list"></div>
      ` : ''}
      <div style="font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;
          color:var(--secondary-text-color);margin:14px 0 6px;">Enter type</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <ha-textfield id="fp-type" label="e.g. entities, tile, custom:apexcharts-card"
          style="flex:1;display:block;"></ha-textfield>
        <button id="fp-confirm" style="padding:10px 16px;border-radius:6px;border:none;
          cursor:pointer;background:var(--primary-color,#0381f9);color:#fff;font-size:14px;
          white-space:nowrap;flex-shrink:0;">Add</button>
      </div>
    `;

    const listEl = container.querySelector('#fp-list');
    if (listEl) {
      listEl.innerHTML = customCards.map(c => `
        <div class="fp-item" data-type="${c.type}">
          <div style="font-size:13px;font-weight:500;">${c.name}</div>
          <div class="fp-sub">${c.type}</div>
        </div>`).join('');
      listEl.querySelectorAll('.fp-item').forEach(item =>
        item.addEventListener('click', () => this._pickCard(item.dataset.type, container)));
    }

    container.querySelector('#fp-confirm')?.addEventListener('click', () => {
      const type = container.querySelector('#fp-type')?.value?.trim();
      if (type) this._pickCard(type, container);
    });
  }

  _pickCard(type, container) {
    this._config.card = { type };
    this._fire();
    if (container) container.innerHTML = '';
    this._showEditor();
  }

  async _showEditor() {
    const embedPicker = this._el('embed-picker');
    const embedEditor = this._el('embed-editor');
    const slot = this._el('card-editor-slot');
    if (!slot || !embedEditor) return;

    const cardType = this._config.card?.type;
    if (!cardType) { this._showPicker(); return; }

    if (embedPicker) embedPicker.innerHTML = '';
    embedEditor.classList.remove('hidden');

    const label = this._el('card-type-label');
    if (label) label.textContent = cardType;

    // Gleicher Typ: nur Wert aktualisieren
    if (this._cardEditor) {
      this._cardEditor.value = this._config.card;
      return;
    }

    try {
      await customElements.whenDefined('hui-card-element-editor');
      if (this._cardEditor) return; // race-guard

      const editor = document.createElement('hui-card-element-editor');
      slot.appendChild(editor); // erst ins DOM, dann Properties
      editor.hass = this._hass;
      const lovelace = this._getLovelace();
      if (lovelace) editor.lovelace = lovelace;
      editor.value = this._config.card || {};

      editor.addEventListener('config-changed', e => {
        e.stopPropagation();
        this._config.card = e.detail.config;
        this._fire();
      });
      this._cardEditor = editor;
    } catch (err) {
      slot.innerHTML = `<div style="color:var(--error-color,red);font-size:13px;padding:8px;">${err.message}</div>`;
    }
  }

  _populate() {
    const cfg = this._config;
    const h = cfg.header || {};
    const iconMode = this._iconMode();
    const subMode = this._subtitleMode();

    this._val('f-title', h.title || '');
    this._populateColor('f-title-color', h.title_color || '');

    this._val('f-icon-size', h.icon_size != null ? String(h.icon_size) : '40');
    this._populateColor('f-icon-color', h.icon_color || '');

    const tplTA = this._el('f-subtitle-tpl');
    if (tplTA) tplTA.value = h.subtitle_template || '';
    this._el('sub-color-wrap').classList.toggle('hidden', subMode !== 'template');
    this._populateColor('f-sub-color', h.subtitle_color || '');

    const stateMode = this._stateMode();
    this._el('state-entity-wrap').classList.toggle('hidden', stateMode !== 'entity');
    this._el('state-entity-extra').classList.toggle('hidden', stateMode !== 'entity');
    this._el('state-entity-hint').classList.toggle('hidden', stateMode !== 'entity');
    this._el('state-tpl-wrap').classList.toggle('hidden', stateMode !== 'template');
    this._el('state-color-wrap').classList.toggle('hidden', stateMode === 'none');
    this._val('f-state-unit', h.state_unit || '');
    this._val('f-state-dec', h.state_decimals != null ? String(h.state_decimals) : '0');
    const stateTplTA = this._el('f-state-tpl');
    if (stateTplTA) stateTplTA.value = h.state_template || '';
    this._populateColor('f-state-color', h.state_color || '');

    this._populateColor('f-accent', cfg.accent_color || '3, 129, 249', true);
    const m = this._parseMargin(cfg.inner_margin);
    this._val('f-margin-top',    m.t);
    this._val('f-margin-right',  m.r);
    this._val('f-margin-bottom', m.b);
    this._val('f-margin-left',   m.l);

    // HA picker elements need hass + value set after paint
    requestAnimationFrame(() => {
      if (this._hass) {
        this.shadowRoot.querySelectorAll('[needs-hass]').forEach(el => { el.hass = this._hass; });
      }
      if (iconMode === 'mdi') {
        const ip = this._el('f-icon');
        if (ip) ip.value = h.icon || '';
      } else if (iconMode === 'svg') {
        this._val('f-icon-path', h.icon_path || '');
      }
      const ef = this._el('f-state-entity-form');
      if (ef) {
        ef.hass = this._hass;
        ef.schema = [{ name: 'state_entity', label: 'Entity', selector: { entity: {} } }];
        ef.data = { state_entity: h.state_entity || null };
        ef.computeLabel = s => s.label ?? s.name;
      }
    });
  }

  _wire() {
    const chg = (id, path, transform) => {
      this._el(id)?.addEventListener('change', e => {
        const v = transform ? transform(e.target.value) : e.target.value;
        this._set(path, v);
      });
    };
    const valEvt = (id, path) => {
      this._el(id)?.addEventListener('value-changed', e => this._set(path, e.detail.value));
    };

    this._el('tab-container')?.addEventListener('click', () => this._switchTab('container'));
    this._el('tab-embedded')?.addEventListener('click',  () => this._switchTab('embedded'));
    this._el('btn-change-type')?.addEventListener('click', () => {
      const embedPicker = this._el('embed-picker');
      if (embedPicker) embedPicker.innerHTML = '';
      this._cardEditor = null;
      const slot = this._el('card-editor-slot');
      if (slot) slot.innerHTML = '';
      this._showPicker();
    });

    chg('f-title', 'header.title');
    this._wireColor('f-title-color', 'header.title_color');

    valEvt('f-icon', 'header.icon');
    chg('f-icon-path', 'header.icon_path');
    chg('f-icon-size', 'header.icon_size', v => parseInt(v) || 40);
    this._wireColor('f-icon-color', 'header.icon_color');

    this._el('f-subtitle-tpl')?.addEventListener('change', e => this._set('header.subtitle_template', e.target.value));
    this._wireColor('f-sub-color', 'header.subtitle_color');

    this._el('f-state-entity-form')?.addEventListener('value-changed', e => {
      this._set('header.state_entity', e.detail.value?.state_entity || null);
    });
    chg('f-state-unit', 'header.state_unit');
    chg('f-state-dec', 'header.state_decimals', v => parseInt(v) || 0);
    this._el('f-state-tpl')?.addEventListener('change', e => this._set('header.state_template', e.target.value));
    this._wireColor('f-state-color', 'header.state_color');

    this._wireColor('f-accent', 'accent_color', true);

    ['f-margin-top', 'f-margin-right', 'f-margin-bottom', 'f-margin-left'].forEach(id => {
      this._el(id)?.addEventListener('change', () => this._composeMargin());
    });
  }

  _initForms() {
    const cfg = this._config;

    const initForm = (id, fieldName, label, options, currentValue, onChange) => {
      const form = this._el(id);
      if (!form) return;
      form.hass = this._hass;
      form.schema = [{ name: fieldName, label, selector: { select: { options } } }];
      form.data = { [fieldName]: currentValue };
      form.computeLabel = s => s.label ?? s.name;
      form.addEventListener('value-changed', e => onChange(e.detail.value[fieldName]));
    };

    initForm('form-sub-mode', 'sub_mode', 'Subtitle', [
      { value: 'none', label: 'No subtitle' },
      { value: 'template', label: 'Jinja2 template' },
    ], this._subtitleMode(), mode => {
      this._el('sub-tpl-wrap').classList.toggle('hidden', mode !== 'template');
      this._el('sub-color-wrap').classList.toggle('hidden', mode !== 'template');
      const h = this._config.header || {};
      if (mode !== 'template' && h.subtitle_template) this._set('header.subtitle_template', null);
    });

    initForm('form-icon-mode', 'icon_mode', 'Icon', [
      { value: 'none', label: 'No icon' },
      { value: 'mdi', label: 'MDI icon' },
      { value: 'svg', label: 'SVG (path)' },
    ], this._iconMode(), mode => {
      this._iconModeOverride = mode === 'none' ? null : mode;
      this._el('icon-mdi-wrap').classList.toggle('hidden', mode !== 'mdi');
      this._el('icon-svg-wrap').classList.toggle('hidden', mode !== 'svg');
      this._el('icon-extras').classList.toggle('hidden', mode === 'none');
      const h = this._config.header || {};
      if (mode !== 'mdi' && h.icon) this._set('header.icon', null);
      if (mode !== 'svg' && h.icon_path) this._set('header.icon_path', null);
    });

    initForm('form-state-mode', 'state_mode', 'Main Value', [
      { value: 'none', label: 'No value' },
      { value: 'entity', label: 'Entity' },
      { value: 'template', label: 'Jinja2 template' },
    ], this._stateMode(), mode => {
      this._stateModeOverride = mode === 'none' ? null : mode;
      this._el('state-entity-wrap').classList.toggle('hidden', mode !== 'entity');
      this._el('state-entity-extra').classList.toggle('hidden', mode !== 'entity');
      this._el('state-entity-hint').classList.toggle('hidden', mode !== 'entity');
      this._el('state-tpl-wrap').classList.toggle('hidden', mode !== 'template');
      this._el('state-color-wrap').classList.toggle('hidden', mode === 'none');
      const h = this._config.header || {};
      if (mode !== 'entity' && (h.state_entity != null || h.state_unit != null)) {
        this._set('header.state_entity', null);
        this._set('header.state_unit', null);
      }
      if (mode !== 'template' && h.state_template) this._set('header.state_template', null);
    });

    initForm('form-border', 'border', 'Border', [
      { value: 'show', label: 'Show border' },
      { value: 'hide', label: 'No border' },
    ], cfg.show_border === false ? 'hide' : 'show', val => {
      this._set('show_border', val === 'hide' ? false : null);
    });
  }
}

customElements.define('ha-glow-card-editor', HaGlowCardEditor);

// ─── Karte ───────────────────────────────────────────────────────────────────

// loadCardHelpers()-Promise einmalig cachen — wird von allen Instanzen geteilt
let _helpersPromise = null;
const _getHelpers = () => (_helpersPromise ??= window.loadCardHelpers());

class HaGlowCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('ha-glow-card-editor');
  }

  static getStubConfig() {
    return {
      accent_color: '3, 129, 249',
      header: {
        title: 'My Tile',
      },
      inner_margin: '0 -15px -15px',
      card: { type: 'entities', entities: [] },
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._innerCard = null;
    this._built = false;
    this._els = null;       // gecachte DOM-Referenzen (gesetzt in _build)
    this._tpl = {};         // { subtitle: {unsub, active}, state: {unsub, active} }
  }

  disconnectedCallback() {
    this._unsubscribeTpl('subtitle');
    this._unsubscribeTpl('state');
  }

  // ── Lovelace Lifecycle ───────────────────────────────────────────────────

  setConfig(config) {
    if (!config.card) throw new Error('ha-glow-card: "card" property is required');

    const prevCardCfg = this._config?.card;
    this._config = config;

    if (!this._built) {
      this._build();
    } else {
      this._applyStyles();
      if (JSON.stringify(prevCardCfg) !== JSON.stringify(config.card)) {
        this._createInnerCard();
      }
    }

    if (this._hass) this._updateHeader();
  }

  set hass(hass) {
    const prevHass = this._hass;
    this._hass = hass;
    if (!this._built) return;
    if (this._innerCard) this._innerCard.hass = hass;
    if (!prevHass && hass) {
      this._subscribeTpl('subtitle', this._config?.header?.subtitle_template, this._els.subEl, true);
      this._subscribeTpl('state',    this._config?.header?.state_template,    this._els.stateEl, true);
    }
    this._updateHeader();
  }

  getCardSize() {
    const innerSize = this._innerCard?.getCardSize?.() ?? 3;
    const headerRows = this._config?.header ? 1 : 0;
    return innerSize + headerRows;
  }

  getLayoutOptions() {
    const inner = this._innerCard?.getLayoutOptions?.() ?? { grid_columns: 12, grid_rows: null };
    const headerRows = this._config?.header ? 1 : 0;
    const rows = inner.grid_rows != null ? inner.grid_rows + headerRows : null;
    const minRows = inner.grid_min_rows != null ? inner.grid_min_rows + headerRows : undefined;
    return {
      ...inner,
      grid_columns: inner.grid_columns ?? 12,
      grid_rows: rows,
      ...(minRows !== undefined && { grid_min_rows: minRows }),
    };
  }

  // ── DOM Aufbau ───────────────────────────────────────────────────────────

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: auto !important; }

        .tile {
          position: relative;
          border-radius: 12px;
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          padding: 20px 15px 15px;
          overflow: hidden;
          box-sizing: border-box;
          background-color: var(--card-background-color, #1c1c1c);
          height: auto;
        }

        .tile::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 1px;
          background: radial-gradient(
            ellipse at 40% 0%,
            var(--tile-glow-top, rgba(3,129,249,0.7)) 0%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.0) 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 2;
          display: none;
        }
        .tile.glow-border::before { display: block; }

        .gradient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .content { position: relative; z-index: 1; }

        /* ─ Header ─ */
        .header {
          display: grid;
          align-items: center;
          margin-bottom: 12px;
        }
        .header.has-icon {
          grid-template-areas: "icon title state";
          grid-template-columns: 65px 1fr 120px;
        }
        .header.no-icon {
          grid-template-areas: "title state";
          grid-template-columns: 1fr 120px;
        }
        .header.has-icon.no-state {
          grid-template-areas: "icon title";
          grid-template-columns: 65px 1fr;
        }
        .header.no-icon.no-state {
          grid-template-areas: "title";
          grid-template-columns: 1fr;
        }

        .icon-area {
          grid-area: icon;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .icon-mask {
          flex-shrink: 0;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-position: center;
          -webkit-mask-size: contain;
          mask-size: contain;
          background-color: var(--primary-text-color);
        }

        .title-area {
          grid-area: title;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .title-main {
          font-size: clamp(20px, 2vw, 28px);
          line-height: clamp(22px, 2vw, 33.6px);
          font-weight: 400;
          color: var(--primary-text-color);
          margin: 0;
          padding: 0;
        }
        .title-sub {
          font-size: 14px;
          color: var(--secondary-text-color);
          margin: 0;
          padding: 0;
        }

        .state-area {
          grid-area: state;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          align-self: start;
        }
        .state-value {
          font-size: clamp(20px, 2vw, 28px);
          line-height: clamp(22px, 2vw, 33.6px);
          text-align: right;
          margin: 0;
          white-space: nowrap;
          color: var(--primary-text-color);
        }

        /* ─ Innere Kachel ─ */
        .inner-card { display: block; }
        .error { color: var(--error-color, red); padding: 8px; font-size: 13px; }
      </style>

      <div class="tile">
        <div class="gradient"></div>
        <div class="content">
          <div class="header has-icon" style="display:none">
            <div class="icon-area">
              <div class="icon-wrap"></div>
            </div>
            <div class="title-area">
              <div class="title-main"></div>
              <div class="title-sub"></div>
            </div>
            <div class="state-area">
              <div class="state-value"></div>
            </div>
          </div>
          <div class="inner-card"></div>
        </div>
      </div>
    `;

    // DOM-Referenzen einmalig cachen
    this._els = {
      tile:      this.shadowRoot.querySelector('.tile'),
      gradient:  this.shadowRoot.querySelector('.gradient'),
      innerCard: this.shadowRoot.querySelector('.inner-card'),
      header:    this.shadowRoot.querySelector('.header'),
      iconArea:  this.shadowRoot.querySelector('.icon-area'),
      iconWrap:  this.shadowRoot.querySelector('.icon-wrap'),
      titleEl:   this.shadowRoot.querySelector('.title-main'),
      subEl:     this.shadowRoot.querySelector('.title-sub'),
      stateArea: this.shadowRoot.querySelector('.state-area'),
      stateEl:   this.shadowRoot.querySelector('.state-value'),
    };

    this._built = true;
    this._applyStyles();
    this._createInnerCard();
  }

  // ── Styling ──────────────────────────────────────────────────────────────

  _applyStyles() {
    if (!this._built) return;
    const cfg = this._config;
    const { tile, gradient, innerCard, header } = this._els;
    const rgb = cfg.accent_color ?? '3, 129, 249';

    if (cfg.show_border === false) {
      tile.style.setProperty('border', '0px', 'important');
      tile.classList.remove('glow-border');
    } else if (cfg.border_glow === true) {
      tile.style.setProperty('border', '0px', 'important');
      tile.style.setProperty('--tile-glow-top', `rgba(${rgb}, 0.35)`);
      tile.classList.add('glow-border');
    } else {
      tile.style.setProperty('border', '1px solid var(--divider-color, rgba(255, 255, 255, 0.12))', 'important');
      tile.classList.remove('glow-border');
    }
    gradient.style.background =
      `radial-gradient(ellipse at 40% top, rgba(${rgb},0.3) 0%, rgba(${rgb},0.08) 30%, rgba(${rgb},0) 70%)`;

    const margin = cfg.inner_margin ?? '0 -15px -15px';
    innerCard.style.margin = margin;

    if (cfg.header) {
      header.style.display = 'grid';
      this._applyHeaderStyles(cfg.header);
      this._subscribeTpl('subtitle', cfg.header.subtitle_template, this._els.subEl, true);
      this._subscribeTpl('state',    cfg.header.state_template,    this._els.stateEl, true);
    } else {
      header.style.display = 'none';
      this._unsubscribeTpl('subtitle');
      this._unsubscribeTpl('state');
    }
  }

  _applyHeaderStyles(h) {
    const { header, iconArea, iconWrap, titleEl, stateArea, stateEl } = this._els;

    const hasIcon = !!(h.icon || h.icon_path);
    header.classList.toggle('has-icon', hasIcon);
    header.classList.toggle('no-icon', !hasIcon);
    iconArea.style.display = hasIcon ? 'flex' : 'none';

    const hasState = !!(h.state_entity || h.state_template);
    header.classList.toggle('no-state', !hasState);
    stateArea.style.display = hasState ? 'flex' : 'none';

    if (h.icon_path) {
      const size = h.icon_size ?? 40;
      iconWrap.innerHTML = `<div class="icon-mask" style="
        width:${size}px; height:${size}px;
        -webkit-mask-image:url(${h.icon_path}); mask-image:url(${h.icon_path});
        background-color:${h.icon_color || 'var(--primary-text-color)'};
      "></div>`;
    } else if (h.icon) {
      const size = h.icon_size ?? 40;
      iconWrap.innerHTML = `<ha-icon icon="${h.icon}" style="
        --mdc-icon-size:${size}px;
        color:${h.icon_color || 'var(--primary-text-color)'};
      "></ha-icon>`;
    } else {
      iconWrap.innerHTML = '';
    }

    titleEl.textContent = h.title ?? '';
    titleEl.style.color = h.title_color || 'var(--primary-text-color)';
    stateEl.style.color = h.state_color || 'var(--primary-text-color)';
  }

  // ── Header-Daten (Entity-Werte) ──────────────────────────────────────────

  _updateHeader() {
    if (!this._built || !this._config?.header || !this._hass) return;
    const h = this._config.header;
    const { subEl, stateEl } = this._els;

    // Subtitle: subtitle_template → WebSocket-Subscription schreibt direkt
    if (h.subtitle_template) {
      subEl.style.color = h.subtitle_color || 'var(--secondary-text-color)';
    } else {
      subEl.textContent = '';
    }

    // State-Wert: state_template → Subscription schreibt direkt; state_entity → hier
    if (!h.state_template && h.state_entity) {
      const s = this._hass.states[h.state_entity];
      let text;
      if (s) {
        const decimals = h.state_decimals ?? 0;
        const num = parseFloat(s.state);
        const val = isNaN(num) ? s.state : num.toFixed(decimals);
        const unit = h.state_unit ?? s.attributes?.unit_of_measurement ?? '';
        text = unit ? `${val} ${unit}` : val;
      } else {
        text = '—';
      }
      if (stateEl.textContent !== text) stateEl.textContent = text;
    } else if (!h.state_template) {
      if (stateEl.textContent !== '') stateEl.textContent = '';
    }
  }

  // ── HA Jinja2-Template Subscription ─────────────────────────────────────

  _unsubscribeTpl(key) {
    const t = this._tpl[key];
    if (t?.unsub) {
      t.unsub();
      this._tpl[key] = {};
    }
  }

  async _subscribeTpl(key, template, el, useHTML = false) {
    if (!template) { this._unsubscribeTpl(key); return; }
    if (template === this._tpl[key]?.active) return;
    this._unsubscribeTpl(key);
    if (!this._hass?.connection) return;

    this._tpl[key] = { active: template };
    try {
      this._tpl[key].unsub = await this._hass.connection.subscribeMessage(
        msg => {
          if (!el) return;
          if (msg.result !== undefined) {
            if (useHTML) el.innerHTML = msg.result.trim();
            else el.textContent = msg.result.trim();
          } else if (msg.error) {
            el.textContent = `⚠ ${msg.error.message}`;
            console.error(`ha-glow-card ${key} template:`, msg.error);
          }
        },
        { type: 'render_template', template, variables: {}, report_errors: true }
      );
    } catch (err) {
      console.error(`ha-glow-card: Template-Subscription (${key}) fehlgeschlagen`, err);
      if (el) el.textContent = `⚠ Template error: ${err.message}`;
      this._tpl[key].active = null;
    }
  }

  // ── Innere Kachel ────────────────────────────────────────────────────────

  async _createInnerCard() {
    const slot = this._els?.innerCard ?? this.shadowRoot.querySelector('.inner-card');
    if (!slot) return;
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    this._innerCard = null;
    if (!this._config?.card) return;

    try {
      const helpers = await _getHelpers();
      const card = helpers.createCardElement(this._config.card);

      if (this._hass) card.hass = this._hass;
      this._innerCard = card;
      slot.appendChild(card);

      const injectStyles = () => {
        const root = card.shadowRoot;
        if (!root) return;
        // Reset outer card visuals via scoped CSS — NOT via CSS variables (those cascade to child cards)
        if (!root.querySelector('#glow-outer-reset')) {
          const s = document.createElement('style');
          s.id = 'glow-outer-reset';
          s.textContent = 'ha-card{background:transparent!important;box-shadow:none!important;border:none!important;border-radius:0!important;}';
          root.appendChild(s);
        }
        if (this._config.extra_styles && !root.querySelector('#glow-extra-styles')) {
          const s = document.createElement('style');
          s.id = 'glow-extra-styles';
          s.textContent = this._config.extra_styles;
          root.appendChild(s);
        }
      };
      if (card.shadowRoot) injectStyles();
      else requestAnimationFrame(injectStyles);
    } catch (err) {
      console.error('ha-glow-card: Innere Kachel konnte nicht erstellt werden', err);
      const errEl = document.createElement('div');
      errEl.className = 'error';
      errEl.textContent = `Fehler: ${err.message}`;
      slot.appendChild(errEl);
    }
  }
}

customElements.define('ha-glow-card', HaGlowCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-glow-card',
  name: 'HA Glow Card',
  description: 'Styled tile container with glow/gradient background, header, icon, subtitle, and embedded card',
  preview: true,
});

console.info(
  '%c HA-GLOW-CARD %c v1.0.2',
  'color:#fff;background:#0381f9;font-weight:700;padding:2px 4px;border-radius:3px 0 0 3px;',
  'color:#0381f9;background:#1c1c1c;font-weight:400;padding:2px 4px;border-radius:0 3px 3px 0;border:1px solid #0381f9;'
);
