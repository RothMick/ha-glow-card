/**
 * ha-glow-card v1.0.4
 * Editor rebuilt closer to energy-flow-card style:
 * - all inputs via ha-form
 * - fewer direct ha-textfield / picker elements
 * - text changes are buffered so iOS/WebKit does not re-render on every keystroke
 */

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
    this._mainEditing = false;
    this._pending = null;
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll('ha-form').forEach(f => { f.hass = hass; });
    if (this._cardEditor) this._cardEditor.hass = hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._cardEditor) this._cardEditor.lovelace = lovelace;
  }

  setConfig(config) {
    const prevCardType = this._config.card?.type;
    this._config = JSON.parse(JSON.stringify(config || {}));

    const h = this._config.header || {};
    if (h.icon || h.icon_path) this._iconModeOverride = null;
    if (h.state_entity || h.state_template) this._stateModeOverride = null;

    if (
      this._activeTab === 'embedded' &&
      this._cardEditor &&
      prevCardType === this._config.card?.type
    ) {
      this._cardEditor.value = this._config.card || {};
      return;
    }

    if (!this._mainEditing) {
      this._cardEditor = null;
      const scroller = this._findScroller();
      const savedScroll = scroller ? scroller.scrollTop : null;
      this._render();
      if (scroller != null && savedScroll != null) {
        requestAnimationFrame(() => { scroller.scrollTop = savedScroll; });
      }
    }
  }

  _findScroller() {
    let node = this;
    while (node) {
      const next = node.parentElement || (node.getRootNode && node.getRootNode().host);
      if (!next) return null;
      if (next.scrollHeight > next.clientHeight + 1) return next;
      node = next;
    }
    return null;
  }

  disconnectedCallback() {
    this._flushPending();
  }

  _fire(cfg = this._config) {
    this._config = JSON.parse(JSON.stringify(cfg));
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _flushPending() {
    if (!this._pending) return;
    const cfg = this._pending;
    this._pending = null;
    this._mainEditing = true;
    this._fire(cfg);
    this._mainEditing = false;
  }

  _set(path, value, flush = true) {
    const cfg = JSON.parse(JSON.stringify(this._config));
    const parts = path.split('.');
    let obj = cfg;

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

    if (flush) {
      this._mainEditing = true;
      this._fire(cfg);
      this._mainEditing = false;
    } else {
      this._config = cfg;
      this._pending = cfg;
    }
  }

  _mergeHeader(values, flush = false) {
    const cfg = JSON.parse(JSON.stringify(this._config));
    cfg.header = { ...(cfg.header || {}), ...values };

    Object.keys(cfg.header).forEach(k => {
      if (cfg.header[k] === '' || cfg.header[k] === null || cfg.header[k] === undefined) {
        delete cfg.header[k];
      }
    });

    if (flush) {
      this._mainEditing = true;
      this._fire(cfg);
      this._mainEditing = false;
    } else {
      this._config = cfg;
      this._pending = cfg;
    }
  }

  _mergeRoot(values, flush = false) {
    const cfg = JSON.parse(JSON.stringify(this._config));

    Object.entries(values).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) delete cfg[k];
      else cfg[k] = v;
    });

    if (flush) {
      this._mainEditing = true;
      this._fire(cfg);
      this._mainEditing = false;
    } else {
      this._config = cfg;
      this._pending = cfg;
    }
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

  _el(id) {
    return this.shadowRoot.getElementById(id);
  }

  _hexToRgb(hex) {
    const m = String(hex || '').replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
  }

  _rgbToHex(rgb) {
    const m = String(rgb || '').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]]
      .map(n => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0'))
      .join('');
  }

  _toRgb(val) {
    const v = String(val || '').trim();
    if (v.startsWith('#')) return this._hexToRgb(v);
    if (/\d/.test(v)) return v;
    return null;
  }

  _parseMargin(str) {
    const p = (str || '0 -15px -15px').trim().split(/\s+/);
    if (p.length === 1) return { t: p[0], r: p[0], b: p[0], l: p[0] };
    if (p.length === 2) return { t: p[0], r: p[1], b: p[0], l: p[1] };
    if (p.length === 3) return { t: p[0], r: p[1], b: p[2], l: p[1] };
    return { t: p[0], r: p[1], b: p[2], l: p[3] };
  }

  _composeMarginFromForm(v) {
    return `${v.margin_top || '0'} ${v.margin_right || '0'} ${v.margin_bottom || '0'} ${v.margin_left || '0'}`;
  }

  _render() {
    const h = this._config.header || {};
    const iconMode = this._iconMode();
    const subMode = this._subtitleMode();
    const stateMode = this._stateMode();

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>

      <div class="tabs">
        <button class="tab ${this._activeTab === 'container' ? 'active' : ''}" id="tab-container">Content</button>
        <button class="tab ${this._activeTab === 'embedded' ? 'active' : ''}" id="tab-embedded">Container</button>
      </div>

      <div id="panel-container" class="${this._activeTab !== 'container' ? 'hidden' : ''}">
        <div class="section">Title</div>
        <ha-form id="form-title"></ha-form>
        <div class="field">${this._colorFieldHtml('title_color', 'Title color', 'var(--primary-text-color)')}</div>

        <ha-form id="form-sub-mode"></ha-form>
        <div id="sub-tpl-wrap" class="field ${subMode !== 'template' ? 'hidden' : ''}">
          <label>Jinja2 template</label>
          <textarea id="subtitle_template" placeholder="{{ (states('sensor.abc') | int) }} W"></textarea>
          <div class="hint">Evaluated server-side. HTML in the output is rendered.</div>
        </div>
        <div id="sub-color-wrap" class="field ${subMode !== 'template' ? 'hidden' : ''}">
          ${this._colorFieldHtml('subtitle_color', 'Subtitle color', 'var(--secondary-text-color)')}
        </div>

        <div class="section">Icon</div>
        <ha-form id="form-icon-mode"></ha-form>
        <div id="icon-mdi-wrap" class="${iconMode !== 'mdi' ? 'hidden' : ''}">
          <ha-form id="form-icon-mdi"></ha-form>
        </div>
        <div id="icon-svg-wrap" class="${iconMode !== 'svg' ? 'hidden' : ''}">
          <ha-form id="form-icon-svg"></ha-form>
        </div>
        <div id="icon-extras" class="${iconMode === 'none' ? 'hidden' : ''}">
          <ha-form id="form-icon-extra"></ha-form>
          <div class="field">${this._colorFieldHtml('icon_color', 'Icon color', 'var(--primary-text-color)')}</div>
        </div>

        <div class="section">Main Value</div>
        <ha-form id="form-state-mode"></ha-form>
        <div id="state-entity-wrap" class="${stateMode !== 'entity' ? 'hidden' : ''}">
          <ha-form id="form-state-entity"></ha-form>
          <ha-form id="form-state-extra"></ha-form>
          <div class="hint">Leave unit empty to inherit the unit from the entity.</div>
        </div>
        <div id="state-tpl-wrap" class="field ${stateMode !== 'template' ? 'hidden' : ''}">
          <label>Jinja2 template</label>
          <textarea id="state_template" placeholder="{{ (states('sensor.abc') | int) }} W"></textarea>
          <div class="hint">Evaluated server-side. The output text is shown directly.</div>
        </div>
        <div id="state-color-wrap" class="field ${stateMode === 'none' ? 'hidden' : ''}">
          ${this._colorFieldHtml('state_color', 'Value color', 'var(--primary-text-color)')}
        </div>

        <div class="section">Tile Settings</div>
        <div class="field">${this._colorFieldHtml('accent_color', 'Glow color', '#0381f9', true)}</div>
        <ha-form id="form-margin"></ha-form>
        <div class="hint">Inner card margin. Negative values stretch the card to the container edges.</div>
        <ha-form id="form-border"></ha-form>
      </div>

      <div id="panel-embedded" class="${this._activeTab !== 'embedded' ? 'hidden' : ''}">
        <div id="embed-picker"></div>
        <div id="embed-editor" class="hidden">
          <div class="embed-header">
            <span class="card-type-label" id="card-type-label"></span>
            <button id="btn-change-type">Change type</button>
          </div>
          <div id="card-editor-slot"></div>
        </div>
      </div>
    `;

    this._initForms();
    this._populateNativeFields();
    this._wireNativeFields();
    this._wireTabs();

    if (this._activeTab === 'embedded') this._initEmbedded();
  }

  _css() {
    return `
      :host { display:block; }
      .tabs {
        display:flex;
        border-bottom:1px solid var(--divider-color, rgba(0,0,0,0.12));
        margin-bottom:4px;
      }
      .tab {
        padding:10px 18px;
        border:none;
        background:none;
        cursor:pointer;
        font-size:14px;
        font-weight:500;
        color:var(--secondary-text-color);
        border-bottom:2px solid transparent;
        margin-bottom:-1px;
      }
      .tab.active {
        color:var(--primary-color, #0381f9);
        border-bottom-color:var(--primary-color, #0381f9);
      }
      .section {
        font-size:16px;
        font-weight:500;
        color:var(--primary-text-color);
        margin:24px 0 10px;
      }
      .section:first-child { margin-top:12px; }
      .field { margin-bottom:10px; }
      .field label {
        display:block;
        font-size:12px;
        color:var(--secondary-text-color);
        margin-bottom:4px;
      }
      .hint {
        font-size:11px;
        color:var(--secondary-text-color);
        margin-top:4px;
        line-height:1.5;
      }
      ha-form {
        --ha-form-grid-padding:0;
        display:block;
        margin-bottom:10px;
      }
      textarea {
        width:100%;
        min-height:72px;
        padding:8px 12px;
        border:1px solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius:4px;
        background:var(--card-background-color, #1c1c1c);
        color:var(--primary-text-color);
        font-size:13px;
        font-family:var(--code-font-family, monospace);
        box-sizing:border-box;
        resize:vertical;
      }
      .hidden { display:none !important; }
      .color-field {
        display:flex;
        gap:8px;
        align-items:center;
      }
      .color-swatch {
        width:36px;
        height:36px;
        flex-shrink:0;
        border-radius:4px;
        border:1px solid var(--divider-color, rgba(0,0,0,0.12));
        cursor:pointer;
        position:relative;
        overflow:hidden;
      }
      .color-swatch.no-color {
        background:repeating-linear-gradient(
          -45deg,
          rgba(120,120,120,0.5) 0px,
          rgba(120,120,120,0.5) 4px,
          transparent 4px,
          transparent 8px
        );
      }
      .color-hidden-input {
        position:absolute;
        inset:0;
        opacity:0;
        cursor:pointer;
        width:100%;
        height:100%;
        padding:0;
        border:none;
      }
      hui-card-element-editor, hui-card-picker { display:block; }
      .embed-header {
        display:flex;
        align-items:center;
        gap:8px;
        padding:4px 0 12px;
      }
      .embed-header .card-type-label {
        flex:1;
        font-size:13px;
        color:var(--secondary-text-color);
        font-family:var(--code-font-family, monospace);
      }
      .embed-header button, .fp-button {
        padding:6px 14px;
        border-radius:6px;
        border:none;
        cursor:pointer;
        background:var(--primary-color,#0381f9);
        color:#fff;
        font-size:13px;
        font-weight:500;
      }
      .fp-item {
        padding:8px 12px;
        cursor:pointer;
        border-radius:6px;
        margin-bottom:4px;
        background:var(--secondary-background-color,rgba(255,255,255,0.06));
      }
      .fp-item:hover {
        background:var(--primary-color,#0381f9);
        color:#fff;
      }
      .fp-sub {
        font-size:11px;
        color:var(--secondary-text-color);
      }
      .fp-item:hover .fp-sub {
        color:rgba(255,255,255,0.7);
      }
    `;
  }

  _colorFieldHtml(id, label, placeholder = '', isRgb = false) {
    return `
      <div class="color-field">
        <div class="color-swatch no-color" id="${id}-swatch" title="Pick color">
          <input type="color" id="${id}-picker" class="color-hidden-input">
        </div>
        <ha-form id="form-color-${id}"></ha-form>
      </div>
      <div class="hint">Empty: uses ${placeholder || 'default value'}</div>
    `;
  }

  _initForms() {
    const h = this._config.header || {};
    const cfg = this._config;
    const margin = this._parseMargin(cfg.inner_margin);

    this._setupForm('form-title',
      [{ name:'title', label:'Title *', selector:{ text:{} } }],
      { title:h.title || '' },
      v => this._mergeHeader(v, false),
      true
    );

    this._setupForm('form-sub-mode',
      [{ name:'sub_mode', label:'Subtitle', selector:{ select:{ options:[
        { value:'none', label:'No subtitle' },
        { value:'template', label:'Jinja2 template' },
      ] } } }],
      { sub_mode:this._subtitleMode() },
      v => {
        const mode = v.sub_mode;
        this._el('sub-tpl-wrap')?.classList.toggle('hidden', mode !== 'template');
        this._el('sub-color-wrap')?.classList.toggle('hidden', mode !== 'template');
        if (mode !== 'template') this._mergeHeader({ subtitle_template:null, subtitle_color:null }, true);
      },
      false
    );

    this._setupForm('form-icon-mode',
      [{ name:'icon_mode', label:'Icon', selector:{ select:{ options:[
        { value:'none', label:'No icon' },
        { value:'mdi', label:'MDI icon' },
        { value:'svg', label:'SVG path' },
      ] } } }],
      { icon_mode:this._iconMode() },
      v => {
        const mode = v.icon_mode;
        this._iconModeOverride = mode === 'none' ? null : mode;
        this._el('icon-mdi-wrap')?.classList.toggle('hidden', mode !== 'mdi');
        this._el('icon-svg-wrap')?.classList.toggle('hidden', mode !== 'svg');
        this._el('icon-extras')?.classList.toggle('hidden', mode === 'none');

        const patch = {};
        if (mode !== 'mdi') patch.icon = null;
        if (mode !== 'svg') patch.icon_path = null;
        if (mode === 'none') {
          patch.icon = null;
          patch.icon_path = null;
          patch.icon_color = null;
        }
        this._mergeHeader(patch, true);
      },
      false
    );

    this._setupForm('form-icon-mdi',
      [{ name:'icon', label:'Icon', selector:{ icon:{} }, context:{ icon_entity:'entity' } }],
      { icon:h.icon || '' },
      v => this._mergeHeader(v, false),
      true
    );

    this._setupForm('form-icon-svg',
      [{ name:'icon_path', label:'Path, e.g. /local/custom_icons/icon.svg', selector:{ text:{} } }],
      { icon_path:h.icon_path || '' },
      v => this._mergeHeader(v, false),
      true
    );

    this._setupForm('form-icon-extra',
      [{ name:'icon_size', label:'Size px', selector:{ number:{ min:16, max:96, mode:'box' } } }],
      { icon_size:h.icon_size ?? 40 },
      v => this._mergeHeader({ icon_size:parseInt(v.icon_size, 10) || 40 }, false),
      true
    );

    this._setupForm('form-state-mode',
      [{ name:'state_mode', label:'Main Value', selector:{ select:{ options:[
        { value:'none', label:'No value' },
        { value:'entity', label:'Entity' },
        { value:'template', label:'Jinja2 template' },
      ] } } }],
      { state_mode:this._stateMode() },
      v => {
        const mode = v.state_mode;
        this._stateModeOverride = mode === 'none' ? null : mode;
        this._el('state-entity-wrap')?.classList.toggle('hidden', mode !== 'entity');
        this._el('state-tpl-wrap')?.classList.toggle('hidden', mode !== 'template');
        this._el('state-color-wrap')?.classList.toggle('hidden', mode === 'none');

        const patch = {};
        if (mode !== 'entity') {
          patch.state_entity = null;
          patch.state_unit = null;
          patch.state_decimals = null;
        }
        if (mode !== 'template') patch.state_template = null;
        if (mode === 'none') patch.state_color = null;
        this._mergeHeader(patch, true);
      },
      false
    );

    this._setupForm('form-state-entity',
      [{ name:'state_entity', label:'Entity', selector:{ entity:{} } }],
      { state_entity:h.state_entity || '' },
      v => this._mergeHeader({ state_entity:v.state_entity || null }, true),
      false
    );

    this._setupForm('form-state-extra',
      [
        { name:'state_unit', label:'Unit', selector:{ text:{} } },
        { name:'state_decimals', label:'Decimal places', selector:{ number:{ min:0, max:6, mode:'box' } } },
      ],
      {
        state_unit:h.state_unit || '',
        state_decimals:h.state_decimals ?? 0,
      },
      v => this._mergeHeader({
        state_unit:v.state_unit || null,
        state_decimals:parseInt(v.state_decimals, 10) || 0,
      }, false),
      true
    );

    this._setupForm('form-margin',
      [
        { name:'margin_top', label:'Margin top', selector:{ text:{} } },
        { name:'margin_right', label:'Margin right', selector:{ text:{} } },
        { name:'margin_bottom', label:'Margin bottom', selector:{ text:{} } },
        { name:'margin_left', label:'Margin left', selector:{ text:{} } },
      ],
      {
        margin_top:margin.t,
        margin_right:margin.r,
        margin_bottom:margin.b,
        margin_left:margin.l,
      },
      v => this._mergeRoot({ inner_margin:this._composeMarginFromForm(v) }, false),
      true
    );

    this._setupForm('form-border',
      [{ name:'border', label:'Border', selector:{ select:{ options:[
        { value:'show', label:'Show border' },
        { value:'hide', label:'No border' },
        { value:'glow', label:'Glow border' },
      ] } } }],
      { border:cfg.show_border === false ? 'hide' : cfg.border_glow === true ? 'glow' : 'show' },
      v => {
        if (v.border === 'hide') this._mergeRoot({ show_border:false, border_glow:null }, true);
        else if (v.border === 'glow') this._mergeRoot({ show_border:null, border_glow:true }, true);
        else this._mergeRoot({ show_border:null, border_glow:null }, true);
      },
      false
    );

    this._setupColorForm('title_color', h.title_color || '', false, val => this._mergeHeader({ title_color:val }, false), 'Title color');
    this._setupColorForm('subtitle_color', h.subtitle_color || '', false, val => this._mergeHeader({ subtitle_color:val }, false), 'Subtitle color');
    this._setupColorForm('icon_color', h.icon_color || '', false, val => this._mergeHeader({ icon_color:val }, false), 'Icon color');
    this._setupColorForm('state_color', h.state_color || '', false, val => this._mergeHeader({ state_color:val }, false), 'Value color');
    this._setupColorForm('accent_color', cfg.accent_color || '3, 129, 249', true, val => this._mergeRoot({ accent_color:val }, false), 'Glow color');
  }

  _setupForm(id, schema, data, onChange, buffered = true) {
    const form = this._el(id);
    if (!form) return;

    form.hass = this._hass;
    form.schema = schema;
    form.data = data;
    form.computeLabel = s => s.label ?? s.name;

    form.addEventListener('value-changed', ev => {
      onChange(ev.detail.value || {});
      if (!buffered) this._flushPending();
    });

    if (buffered) {
      form.addEventListener('focusout', () => {
        setTimeout(() => {
          if (this._pending && this.shadowRoot.activeElement !== form) this._flushPending();
        }, 0);
      });
    }
  }

  _setupColorForm(id, value, isRgb, onChange, label) {
    const form = this._el(`form-color-${id}`);
    if (!form) return;

    const shown = isRgb ? (this._rgbToHex(value) || '') : (value || '');

    form.hass = this._hass;
    form.schema = [{ name:id, label:label || id.replace(/_/g, ' '), selector:{ text:{} } }];
    form.data = { [id]:shown };
    form.computeLabel = s => s.label ?? s.name;

    form.addEventListener('value-changed', ev => {
      const raw = ev.detail.value?.[id] || '';
      const store = isRgb ? (this._toRgb(raw) || raw) : raw;
      onChange(store);
      this._syncColorPicker(id, raw, isRgb);
    });

    form.addEventListener('focusout', () => {
      setTimeout(() => this._flushPending(), 0);
    });
  }

  _populateNativeFields() {
    const h = this._config.header || {};

    const sub = this._el('subtitle_template');
    if (sub) sub.value = h.subtitle_template || '';

    const state = this._el('state_template');
    if (state) state.value = h.state_template || '';

    ['title_color', 'subtitle_color', 'icon_color', 'state_color'].forEach(id => {
      const val = h[id] || '';
      const hex = /^#[0-9a-fA-F]{6}$/.test(val) ? val : '';
      const picker = this._el(`${id}-picker`);
      if (picker) picker.value = hex || '#ffffff';
      this._updateColorSwatch(id, hex);
    });

    const accentHex = this._rgbToHex(this._config.accent_color || '3, 129, 249') || '#0381f9';
    const accentPicker = this._el('accent_color-picker');
    if (accentPicker) accentPicker.value = accentHex;
    this._updateColorSwatch('accent_color', accentHex);
  }

  _wireNativeFields() {
    const sub = this._el('subtitle_template');
    sub?.addEventListener('change', e => this._mergeHeader({ subtitle_template:e.target.value }, true));

    const state = this._el('state_template');
    state?.addEventListener('change', e => this._mergeHeader({ state_template:e.target.value }, true));

    this._wireColorPicker('title_color', false, val => this._mergeHeader({ title_color:val }, true));
    this._wireColorPicker('subtitle_color', false, val => this._mergeHeader({ subtitle_color:val }, true));
    this._wireColorPicker('icon_color', false, val => this._mergeHeader({ icon_color:val }, true));
    this._wireColorPicker('state_color', false, val => this._mergeHeader({ state_color:val }, true));
    this._wireColorPicker('accent_color', true, val => this._mergeRoot({ accent_color:val }, true));
  }

  _updateColorSwatch(id, hex) {
    const swatch = this._el(`${id}-swatch`);
    if (!swatch) return;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      swatch.style.background = hex;
      swatch.classList.remove('no-color');
    } else {
      swatch.style.background = '';
      swatch.classList.add('no-color');
    }
  }

  _wireColorPicker(id, isRgb, onChange) {
    const picker = this._el(`${id}-picker`);
    picker?.addEventListener('input', e => {
      const hex = e.target.value;
      const store = isRgb ? this._hexToRgb(hex) : hex;
      const form = this._el(`form-color-${id}`);
      if (form) form.data = { [id]:hex };
      this._updateColorSwatch(id, hex);
      onChange(store);
    });
  }

  _syncColorPicker(id, raw, isRgb) {
    const picker = this._el(`${id}-picker`);
    if (!picker) return;
    const hex = isRgb ? this._rgbToHex(raw) : raw;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) picker.value = hex;
    this._updateColorSwatch(id, hex || '');
  }

  _wireTabs() {
    this._el('tab-container')?.addEventListener('click', () => this._switchTab('container'));
    this._el('tab-embedded')?.addEventListener('click', () => this._switchTab('embedded'));

    this._el('btn-change-type')?.addEventListener('click', () => {
      const embedPicker = this._el('embed-picker');
      if (embedPicker) embedPicker.innerHTML = '';
      this._cardEditor = null;
      const slot = this._el('card-editor-slot');
      if (slot) slot.innerHTML = '';
      this._showPicker();
    });
  }

  _switchTab(tab) {
    this._flushPending();
    this._activeTab = tab;
    this._el('panel-container')?.classList.toggle('hidden', tab !== 'container');
    this._el('panel-embedded')?.classList.toggle('hidden', tab !== 'embedded');
    this._el('tab-container')?.classList.toggle('active', tab === 'container');
    this._el('tab-embedded')?.classList.toggle('active', tab === 'embedded');
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
    } catch {
      return null;
    }
  }

  _initEmbedded() {
    if (this._config.card?.type) this._showEditor();
    else this._showPicker();
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
      ${customCards.length ? `
        <div class="hint" style="font-weight:600;text-transform:uppercase;margin:8px 0 6px;">Custom Cards</div>
        <div id="fp-list"></div>
      ` : ''}
      <div class="hint" style="font-weight:600;text-transform:uppercase;margin:14px 0 6px;">Enter type</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <ha-form id="fp-form" style="flex:1;"></ha-form>
        <button id="fp-confirm" class="fp-button">Add</button>
      </div>
    `;

    const listEl = container.querySelector('#fp-list');
    if (listEl) {
      listEl.innerHTML = customCards.map(c => `
        <div class="fp-item" data-type="${c.type}">
          <div style="font-size:13px;font-weight:500;">${c.name}</div>
          <div class="fp-sub">${c.type}</div>
        </div>
      `).join('');

      listEl.querySelectorAll('.fp-item').forEach(item => {
        item.addEventListener('click', () => this._pickCard(item.dataset.type, container));
      });
    }

    const fpForm = container.querySelector('#fp-form');
    if (fpForm) {
      fpForm.hass = this._hass;
      fpForm.schema = [{ name:'type', label:'e.g. entities, tile, custom:apexcharts-card', selector:{ text:{} } }];
      fpForm.data = { type:'' };
      fpForm.computeLabel = s => s.label ?? s.name;
    }

    container.querySelector('#fp-confirm')?.addEventListener('click', () => {
      const type = fpForm?.data?.type || fpForm?.value?.type || '';
      if (type) this._pickCard(type.trim(), container);
    });

    fpForm?.addEventListener('value-changed', ev => {
      fpForm.data = ev.detail.value;
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
    if (!cardType) {
      this._showPicker();
      return;
    }

    if (embedPicker) embedPicker.innerHTML = '';
    embedEditor.classList.remove('hidden');

    const label = this._el('card-type-label');
    if (label) label.textContent = cardType;

    if (this._cardEditor) {
      this._cardEditor.value = this._config.card;
      return;
    }

    try {
      await customElements.whenDefined('hui-card-element-editor');
      if (this._cardEditor) return;

      const editor = document.createElement('hui-card-element-editor');
      slot.appendChild(editor);

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
}

customElements.define('ha-glow-card-editor', HaGlowCardEditor);


// ─── Card ────────────────────────────────────────────────────────────────────

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
    this._els = null;
    this._tpl = {};
  }

  disconnectedCallback() {
    this._unsubscribeTpl('subtitle');
    this._unsubscribeTpl('state');
  }

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
      this._subscribeTpl('state', this._config?.header?.state_template, this._els.stateEl, true);
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

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:auto !important; }

        .tile {
          position:relative;
          border-radius:12px;
          border:1px solid var(--divider-color, rgba(255,255,255,0.12));
          padding:20px 15px 15px;
          overflow:hidden;
          box-sizing:border-box;
          background-color:var(--card-background-color, #1c1c1c);
          height:auto;
        }

        .tile::before {
          content:'';
          position:absolute;
          inset:0;
          border-radius:12px;
          padding:1px;
          background:radial-gradient(
            ellipse at 40% 0%,
            var(--tile-glow-top, rgba(3,129,249,0.7)) 0%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.0) 100%
          );
          -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite:destination-out;
          mask-composite:exclude;
          pointer-events:none;
          z-index:2;
          display:none;
        }

        .tile.glow-border::before { display:block; }

        .gradient {
          position:absolute;
          inset:0;
          pointer-events:none;
          z-index:0;
        }

        .content {
          position:relative;
          z-index:1;
        }

        .header {
          display:grid;
          align-items:center;
          margin-bottom:12px;
        }

        .header.has-icon {
          grid-template-areas:"icon title state";
          grid-template-columns:65px 1fr 120px;
        }

        .header.no-icon {
          grid-template-areas:"title state";
          grid-template-columns:1fr 120px;
        }

        .header.has-icon.no-state {
          grid-template-areas:"icon title";
          grid-template-columns:65px 1fr;
        }

        .header.no-icon.no-state {
          grid-template-areas:"title";
          grid-template-columns:1fr;
        }

        .icon-area {
          grid-area:icon;
          display:flex;
          align-items:center;
          justify-content:flex-start;
        }

        .icon-mask {
          flex-shrink:0;
          -webkit-mask-repeat:no-repeat;
          mask-repeat:no-repeat;
          -webkit-mask-position:center;
          mask-position:center;
          -webkit-mask-size:contain;
          mask-size:contain;
          background-color:var(--primary-text-color);
        }

        .title-area {
          grid-area:title;
          display:flex;
          flex-direction:column;
          justify-content:center;
        }

        .title-main {
          font-size:clamp(20px, 2vw, 28px);
          line-height:clamp(22px, 2vw, 33.6px);
          font-weight:400;
          color:var(--primary-text-color);
          margin:0;
          padding:0;
        }

        .title-sub {
          font-size:14px;
          color:var(--secondary-text-color);
          margin:0;
          padding:0;
        }

        .state-area {
          grid-area:state;
          display:flex;
          align-items:flex-start;
          justify-content:flex-end;
          align-self:start;
        }

        .state-value {
          font-size:clamp(20px, 2vw, 28px);
          line-height:clamp(22px, 2vw, 33.6px);
          text-align:right;
          margin:0;
          white-space:nowrap;
          color:var(--primary-text-color);
        }

        /* Neutralize the embedded card's own ha-card chrome via inherited HA
           card variables. Set on the wrapper (not injected into the inner
           card's shadow root) so it survives inner cards that rebuild their
           whole shadowRoot on every render. */
        .inner-card {
          display:block;
          --ha-card-background:transparent;
          --ha-card-box-shadow:none;
          --ha-card-border-width:0px;
          --ha-card-border-color:transparent;
          --ha-card-border-radius:0;
        }

        .error {
          color:var(--error-color, red);
          padding:8px;
          font-size:13px;
        }
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

    this._els = {
      tile: this.shadowRoot.querySelector('.tile'),
      gradient: this.shadowRoot.querySelector('.gradient'),
      innerCard: this.shadowRoot.querySelector('.inner-card'),
      header: this.shadowRoot.querySelector('.header'),
      iconArea: this.shadowRoot.querySelector('.icon-area'),
      iconWrap: this.shadowRoot.querySelector('.icon-wrap'),
      titleEl: this.shadowRoot.querySelector('.title-main'),
      subEl: this.shadowRoot.querySelector('.title-sub'),
      stateArea: this.shadowRoot.querySelector('.state-area'),
      stateEl: this.shadowRoot.querySelector('.state-value'),
    };

    this._built = true;
    this._applyStyles();
    this._createInnerCard();
  }

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

    innerCard.style.margin = cfg.inner_margin ?? '0 -15px -15px';

    if (cfg.header) {
      header.style.display = 'grid';
      this._applyHeaderStyles(cfg.header);
      this._subscribeTpl('subtitle', cfg.header.subtitle_template, this._els.subEl, true);
      this._subscribeTpl('state', cfg.header.state_template, this._els.stateEl, true);
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
        width:${size}px;
        height:${size}px;
        -webkit-mask-image:url(${h.icon_path});
        mask-image:url(${h.icon_path});
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

  _updateHeader() {
    if (!this._built || !this._config?.header || !this._hass) return;

    const h = this._config.header;
    const { subEl, stateEl } = this._els;

    if (h.subtitle_template) {
      subEl.style.color = h.subtitle_color || 'var(--secondary-text-color)';
    } else {
      subEl.textContent = '';
    }

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

  _unsubscribeTpl(key) {
    const t = this._tpl[key];
    if (t?.unsub) {
      t.unsub();
      this._tpl[key] = {};
    }
  }

  async _subscribeTpl(key, template, el, useHTML = false) {
    if (!template) {
      this._unsubscribeTpl(key);
      return;
    }

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
        {
          type: 'render_template',
          template,
          variables: {},
          report_errors: true,
        }
      );
    } catch (err) {
      console.error(`ha-glow-card: Template subscription (${key}) failed`, err);
      if (el) el.textContent = `⚠ Template error: ${err.message}`;
      this._tpl[key].active = null;
    }
  }

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
      console.error('ha-glow-card: Failed to create inner card', err);

      const errEl = document.createElement('div');
      errEl.className = 'error';
      errEl.textContent = `Error: ${err.message}`;
      slot.appendChild(errEl);
    }
  }
}

customElements.define('ha-glow-card', HaGlowCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-glow-card',
  name: 'Glow Card',
  description: 'Styled tile container with glow/gradient background, header, icon, subtitle, and embedded card',
  preview: true,
});

console.info(
  '%c HA-GLOW-CARD %c v1.0.4',
  'color:#fff;background:#0381f9;font-weight:700;padding:2px 4px;border-radius:3px 0 0 3px;',
  'color:#0381f9;background:#1c1c1c;font-weight:400;padding:2px 4px;border-radius:0 3px 3px 0;border:1px solid #0381f9;'
);