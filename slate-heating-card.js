/* Slate Heating Card: standard HA controls, optional integration-specific extras. */
export const VERSION = '0.1.0';
export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const available = state => state && !['unknown', 'unavailable'].includes(state.state);
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
const clone = value => JSON.parse(JSON.stringify(value));
const modes = { auto:'Auto', heat:'Heat', cool:'Cool', heat_cool:'Heat / cool', dry:'Dry', fan_only:'Fan only', off:'Off', on:'On' };
const titleCase = value => String(value || '').replaceAll('_',' ').replace(/^./, c => c.toUpperCase());
export function oilReading(entity, max = Infinity) {
  if (!available(entity) || entity.state == null || String(entity.state).trim() === '') return null;
  const value = Number(entity.state);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
export const OIL_FIELDS = {
  date: 'oil_report_entity', price: 'oil_price_entity', priceKwh: 'oil_price_kwh_entity',
  total: 'oil_cost_entity', trackedUsage: 'oil_usage_entity',
  heating: 'oil_heating_cost_entity', water: 'oil_water_cost_entity'
};
export const DEFAULTS = {
  name: '', heating_name: 'Heating', water_name: 'Hot water', oil_name: 'Oil Level',
  layout: 'auto', show_header: true, show_schedule: true, show_boost: true,
  tank_hot_threshold: 40, show_tank_estimate: true, currency: 'EUR', energy_per_litre: 9
};
export const ENTITY_FIELDS = ['heating_entity', 'hot_water_entity', 'tank_top_entity', 'tank_middle_entity', 'tank_bottom_entity', 'oil_level_entity', 'oil_percentage_entity', ...Object.values(OIL_FIELDS)];
export function normalizeConfig(config) {
  const c = { ...DEFAULTS, ...config };
  for (const key of ENTITY_FIELDS) {
    if (c[key] == null || c[key] === '') { delete c[key]; continue; }
    const domain = key === 'hot_water_entity' ? '(climate|water_heater|switch)' : key === 'heating_entity' ? 'climate' : 'sensor';
    if (typeof c[key] !== 'string' || !new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(c[key])) throw new Error(`Choose a ${domain} entity for ${key.replaceAll('_', ' ')}.`);
  }
  c.heating_entities = c.heating_entities ?? (c.heating_entity ? [c.heating_entity] : []);
  if (!Array.isArray(c.heating_entities) || c.heating_entities.some(id => typeof id !== 'string' || !/^climate\.[a-z0-9_]+$/.test(id)) || new Set(c.heating_entities).size !== c.heating_entities.length) throw new Error('Choose unique climate entities for the heating zones.');
  if (c.hot_water_entity && c.heating_entities.includes(c.hot_water_entity)) throw new Error('Use a different climate entity for hot water and heating.');
  c.tank_entities = c.tank_entities ?? ['top','middle','bottom'].map(p => c[`tank_${p}_entity`]).filter(Boolean);
  if (!Array.isArray(c.tank_entities) || c.tank_entities.some(id => typeof id !== 'string' || !/^sensor\.[a-z0-9_]+$/.test(id)) || new Set(c.tank_entities).size !== c.tank_entities.length) throw new Error('Choose unique tank temperature sensors, ordered from top to bottom.');
  for (const key of ['boost_script','cancel_boost_script']) if (c[key] && !/^script\.[a-z0-9_]+$/.test(c[key])) throw new Error('Choose an HA script for boost actions.');
  if (c.schedule_entity && !/^[a-z_]+\.[a-z0-9_]+$/.test(c.schedule_entity)) throw new Error('Choose a schedule entity.');
  const inferred = [c.heating_entities.length > 0 && 'heating', (c.hot_water_entity || c.tank_entities.length > 0) && 'water', (c.oil_level_entity || c.oil_percentage_entity) && 'oil'].filter(Boolean);
  c.sections = c.sections ?? inferred;
  if (!Array.isArray(c.sections) || c.sections.some(s => !['heating', 'water', 'oil'].includes(s)) || new Set(c.sections).size !== c.sections.length) throw new Error('Sections must contain Heating, Hot water or Oil once each, in display order.');
  if (!['auto', 'stacked'].includes(c.layout)) throw new Error('Choose Automatic or Stacked layout.');
  for (const key of ['show_header', 'show_schedule', 'show_boost', 'show_tank_estimate']) if (typeof c[key] !== 'boolean') throw new Error(`${key} must be true or false.`);
  for (const key of ['name', 'heating_name', 'water_name', 'oil_name']) if (typeof c[key] !== 'string') throw new Error(`${key} must be text.`);
  if (c.hub != null && typeof c.hub !== 'string') throw new Error('Hub must be a Wiser hub name.');
  if (!Number.isFinite(c.tank_hot_threshold) || c.tank_hot_threshold < 30 || c.tank_hot_threshold > 60) throw new Error('Choose a hot-water reference temperature between 30 and 60 °C.');
  if (!Number.isFinite(c.energy_per_litre) || c.energy_per_litre <= 0 || c.energy_per_litre > 20) throw new Error('Energy per litre must be greater than 0 and at most 20 kWh/L.');
  if (!/^[A-Z]{3}$/.test(c.currency)) throw new Error('Use a three-letter currency code, such as EUR or GBP.');
  return c;
}
export function oilEntities(config) { return Object.fromEntries(Object.entries(OIL_FIELDS).map(([key, field]) => [key, config?.[field]])); }
const entityField = (name, domain = 'sensor') => ({ name, selector: { entity: { domain } } });
const textField = name => ({ name, selector: { text: {} } });
const toggleField = name => ({ name, selector: { boolean: {} } });
const group = (title, schema) => ({ name: '', type: 'expandable', title, flatten: true, schema });
export function configForm() {
  const labels = {
    name: 'Card title', sections: 'Sections · drag to reorder', layout: 'Layout', show_header: 'Show card header',
    show_schedule: 'Show schedule editor', show_boost: 'Show timed boosts', hub: 'Wiser hub name (optional adapter)', boost_script: 'Timed boost script · optional', cancel_boost_script: 'Cancel boost script · optional', schedule_entity: 'Schedule helper / entity · optional',
    heating_name: 'Single-zone title', heating_entities: 'Heating zones / TRVs · drag to reorder', heating_entity: 'Heating climate', water_name: 'Hot water title', hot_water_entity: 'Hot water controller',
    tank_top_entity: 'Tank top temperature', tank_middle_entity: 'Tank middle temperature', tank_bottom_entity: 'Tank bottom temperature',
    tank_entities: 'Tank sensors · top to bottom', tank_hot_threshold: 'Hot-water reference (°C)', show_tank_estimate: 'Estimate hot share with two or more probes',
    oil_name: 'Oil section title', oil_level_entity: 'Oil volume remaining', oil_percentage_entity: 'Oil percentage full',
    oil_report_entity: 'Oil reading timestamp', oil_price_entity: 'Price per litre', oil_price_kwh_entity: 'Price per kWh (optional fallback)',
    oil_cost_entity: 'Estimated total cost (with ledger)', oil_usage_entity: 'Estimated cumulative usage',
    oil_heating_cost_entity: 'Estimated heating cost', oil_water_cost_entity: 'Estimated hot water cost', currency: 'Currency code', energy_per_litre: 'Energy per litre (kWh/L)'
  };
  return {
    schema: [textField('name'), { name: 'sections', selector: { select: { multiple: true, reorder: true, options: [{value:'heating',label:'Heating'}, {value:'water',label:'Hot water / tank'}, {value:'oil',label:'Oil'}] } } },
      { name: 'layout', selector: { select: { options: [{value:'auto',label:'Automatic columns'}, {value:'stacked',label:'Stacked'}] } } },
      group('Appearance & controls', [toggleField('show_header'), toggleField('show_schedule'), toggleField('show_boost'), textField('hub'),entityField('boost_script','script'),entityField('cancel_boost_script','script'),{name:'schedule_entity',selector:{entity:{}}}]),
      group('Heating zones / TRVs', [{name:'heating_entities',selector:{entity:{filter:{domain:'climate'},multiple:true,reorder:true}}},textField('heating_name')]),
      group('Hot water & tank', [textField('water_name'), entityField('hot_water_entity',['climate','water_heater','switch']), {name:'tank_entities',selector:{entity:{filter:{domain:'sensor',device_class:'temperature'},multiple:true,reorder:true}}}, toggleField('show_tank_estimate'), {name:'tank_hot_threshold',selector:{number:{min:30,max:60,step:1,mode:'box'}}}]),
      group('Oil level', [textField('oil_name'), entityField('oil_level_entity'), entityField('oil_percentage_entity')]),
      group('Estimated oil costs · optional', [...Object.values(OIL_FIELDS).map(name=>entityField(name)), textField('currency'), {name:'energy_per_litre',selector:{number:{min:0.1,max:20,step:0.1,mode:'box'}}}])
    ],
    computeLabel: schema => labels[schema.name] || schema.name,
    computeHelper: schema => schema.name === 'boost_script' ? 'For systems without native timed boosts. HA receives target_entity and duration_minutes; the script must own the timer and restore the prior setting. No timer runs in the browser.' : schema.name === 'cancel_boost_script' ? 'Receives target_entity. Restore the previous setting in HA.' : schema.name === 'schedule_entity' ? 'Opens the selected schedule helper or integration entity. Wiser programmes can also be edited directly.' : schema.name === 'heating_entities' ? 'Choose the climate entities for your rooms or TRVs, from any HA integration. Each uses its supported controls. Multiple zones use their HA entity names.' : schema.name === 'tank_entities' ? 'Add any number of probes and drag them from top to bottom. The percentage estimate assumes even spacing across the tank height; one probe shows temperature only.' : schema.name === 'oil_cost_entity' ? 'Optional backend ledger; the card only displays estimates and never calculates or stores oil usage in the browser.' : schema.name === 'sections' ? 'Use one section as a standalone card, or combine them. Each card instance has its own entities.' : undefined
  };
}

export function oilCosts(states, config = DEFAULTS) {
  const entities = oilEntities(config), density = config.energy_per_litre ?? 9, currency = config.currency ?? 'EUR';
  const entity = key => states[entities[key]], value = key => oilReading(entity(key));
  const rate = (key, units) => units.includes(entity(key)?.attributes?.unit_of_measurement) && value(key) > 0 ? value(key) : null;
  const priceKwh = rate('priceKwh', [`${currency}/kWh`, ...(currency === 'EUR' ? ['€/kWh'] : [])]), price = rate('price', [`${currency}/L`, ...(currency === 'EUR' ? ['€/L'] : [])]) ?? (priceKwh == null ? null : priceKwh * density);
  const report = Date.parse(entity('date')?.state);
  const ledger = entity('total')?.attributes?.ledger, last = ledger?.last;
  const saved = last && Math.abs(last.report * 1000 - report) < 2000;
  return { price, priceKwh, report: Number.isFinite(report) ? report : null,
    start: saved ? last.start * 1000 : null, litres: saved ? last.litres : null,
    cost: saved ? last.cost : null, saved, refill: saved && last.refill,
    heating: saved ? last.heating : null, water: saved ? last.water : null, ledger };
}
export function tankTemperature(entity) {
  if (!available(entity) || entity.state == null || String(entity.state).trim() === '') return null;
  const value = Number(entity.state);
  return Number.isFinite(value) ? value : null;
}
export function tankColour(entity) {
  let value = tankTemperature(entity);
  if (value == null) return 'var(--disabled-text-color, #777)';
  if (entity.attributes?.unit_of_measurement === '°F') value = (value - 32) * 5 / 9;
  const warmth = Math.max(0, Math.min(1, (value - 20) / 40));
  return `rgb(${[96, 165, 250].map((cold, i) => Math.round(cold + ([251, 146, 60][i] - cold) * warmth)).join(', ')})`;
}
// Estimated volume at/above the reference temperature: linear profile between
// any number of evenly spaced probes spanning a vertical, uniform tank.
// This is a spatial estimate, not average temperature or a measured draw volume.
export function hotTankPercent(sensors, threshold = 40) {
  if (sensors.length < 2 || !Number.isFinite(threshold)) return null;
  const temperatures = sensors.map(entity => {
    const value = tankTemperature(entity), unit = entity?.attributes?.unit_of_measurement || '°C';
    if (value == null || !['°C', '°F'].includes(unit)) return null;
    const celsius = unit === '°F' ? (value - 32) * 5 / 9 : value;
    // Reject probe startup/error values, such as 85°C startup readings.
    return celsius === 85 || celsius === -127 ? null : celsius;
  });
  if (temperatures.some(value => value == null)) return null;
  let hot = 0;
  for (let i = 0; i < temperatures.length - 1; i++) {
    const low = Math.min(temperatures[i], temperatures[i + 1]);
    const high = Math.max(temperatures[i], temperatures[i + 1]);
    const fraction = 1 / (temperatures.length - 1);
    hot += low >= threshold ? fraction : high <= threshold ? 0 : fraction * (high - threshold) / (high - low);
  }
  return Math.round(hot * 20) * 5;
}

export function boostConfirmed(state, minutes) {
  return state.attributes.is_boosted === true && state.attributes.boost_time_remaining >= minutes - 2 && state.attributes.boost_time_remaining <= minutes + 1;
}

export function weeklyDays(schedule) {
  return WEEK.map(day => {
    const match = schedule.ScheduleData.find(entry => entry.day === day)
      || schedule.ScheduleData.find(entry => entry.day === (WEEK.indexOf(day) < 5 ? 'Weekdays' : 'Weekends'))
      || schedule.ScheduleData.find(entry => entry.day === 'All');
    return { day, slots: clone(match?.slots || []) };
  });
}
export function scheduleKey(schedule) {
  return JSON.stringify(weeklyDays(schedule).map(entry => [entry.day, entry.slots.map(slot => [slot.Time, String(slot.Setpoint)]).sort()]));
}
export function validateProgramme(schedule, type, min = 5, max = 30) {
  const days = weeklyDays(schedule);
  if (!days.some(day => day.slots.length)) throw new Error('Add at least one change to the week. Use Off for a programme that stays off.');
  for (const day of days) {
    if (day.slots.length > 8) throw new Error(`${day.day}: Wiser supports eight changes per day.`);
    const times = new Set();
    day.slots = day.slots.map(slot => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.Time)) throw new Error(`${day.day}: enter a valid time.`);
      if (times.has(slot.Time)) throw new Error(`${day.day}: two changes have the same time.`);
      times.add(slot.Time);
      let setting = slot.Setpoint;
      if (type === 'OnOff') {
        if (!['On', 'Off'].includes(setting)) throw new Error(`${day.day}: choose On or Off.`);
      } else if (setting !== 'Off') {
        if (setting === '' || !Number.isFinite(Number(setting)) || Number(setting) < min || Number(setting) > max || Number(setting) * 2 % 1 !== 0) throw new Error(`${day.day}: choose a temperature between ${min} and ${max} °C in 0.5° steps.`);
        setting = Number(setting);
      }
      return { Time: slot.Time, Setpoint: setting };
    }).sort((a, b) => a.Time.localeCompare(b.Time));
  }
  return { ...schedule, ScheduleData: days };
}
export function heatingCapabilities(entity) {
  const attr = entity?.attributes || {}, domain = entity?.entity_id?.split('.')[0] || 'climate';
  const wiser = domain === 'climate' && attr.schedule_id != null && 'is_boosted' in attr;
  const features = attr.supported_features;
  const scalar = domain !== 'switch' && !(wiser && attr.target_temp_low != null) && (features == null ? Number.isFinite(attr.temperature) : !!(features & 1));
  const range = domain === 'climate' && !wiser && (features == null ? attr.target_temp_low != null && attr.target_temp_high != null : !!(features & 2)) && (entity?.state === 'heat_cool' || attr.temperature == null);
  return { domain, wiser, scalar:scalar && !range, range,
    modes: domain === 'switch' ? ['off','on'] : domain === 'water_heater' ? attr.operation_list || [] : attr.hvac_modes || [],
    presets: domain === 'climate' ? attr.preset_modes || [] : [] };
}
export function modeCommand(entity, value) {
  const domain = heatingCapabilities(entity).domain;
  if (domain === 'switch') return {service:value === 'on' ? 'turn_on' : 'turn_off',data:{}};
  if (domain === 'water_heater') return {service:'set_operation_mode',data:{operation_mode:value}};
  return {service:'set_hvac_mode',data:{hvac_mode:value}};
}
export async function entityAction(hass, entityId, service, data, confirmed) {
  await hass.callService(entityId.split('.')[0], service, { entity_id: entityId, ...data });
  const states = Object.fromEntries((await hass.callWS({ type: 'get_states' })).map(state => [state.entity_id, state]));
  if (!available(states[entityId]) || !confirmed(states[entityId])) throw new Error('Home Assistant has not confirmed this change yet. Check the current settings and retry.');
  return states;
}
export const wiserAction = entityAction; // Compatibility export for the optional Wiser adapter.
export async function saveProgramme(hass, target, programme, baseline) {
  await hass.callService('homeassistant', 'update_entity', { entity_id: target.entityId });
  const state = (await hass.callWS({ type: 'get_states' })).find(state => state.entity_id === target.entityId);
  if (!available(state) || state.attributes.schedule_id !== target.id) throw new Error('The assigned programme changed. Reload it before saving.');
  const query = { type: 'wiser/schedule/id', hub: target.hub, schedule_type: target.type, schedule_id: target.id };
  const current = await hass.callWS(query);
  if (scheduleKey(current) !== baseline) throw new Error('The programme changed elsewhere. Reload it before saving your edits.');
  const validated = validateProgramme(programme, target.type, target.min, target.max);
  await hass.callWS({ ...query, type: 'wiser/schedule/save', schedule: validated });
  const saved = await hass.callWS(query);
  if (scheduleKey(saved) !== scheduleKey(validated)) throw new Error('Wiser did not confirm the saved programme. Reload to check its current settings.');
  return saved;
}

class SlateHeatingCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.view = 'controls'; this.kind = 'heating'; this.day = (new Date().getDay() + 6) % 7;
    this.programmes = {}; this.temperatureDirty = {}; this.busy = false; this.loading = false;
    this.shadowRoot.innerHTML = `
      <style>
        :host {display:block;container-type:inline-size;--ws-teal:#34bfa5;--ws-orange:#fb923c;--ws-blue:#60a5fa}
        *{box-sizing:border-box}[hidden]{display:none!important}
        ha-card{display:block;border-radius:var(--ha-card-border-radius,18px);background:var(--ha-card-background,var(--card-background-color,#1f1f1f));padding:20px;color:var(--primary-text-color);overflow:hidden}
        header,.panel-head,.schedule-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
        h2,h3{margin:0;display:flex;align-items:center;gap:8px}h2{font-size:18px;font-weight:600}h3{font-size:15px;font-weight:600}
        header{margin-bottom:22px}header ha-icon{color:var(--ws-teal)}.heating ha-icon{color:var(--ws-orange)}.water ha-icon{color:var(--ws-blue)}
        .badge{font-size:12px;padding:7px 10px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color)}
        .badge.active{color:#e5ad27;border-color:#695522;background:#352e1f}
        nav{display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--secondary-background-color);margin-bottom:20px}
        button,input,select{font:inherit;color:var(--primary-text-color);min-width:0;min-height:40px;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);padding:8px 10px}
        button,select{cursor:pointer}button{font-size:13px}button:hover{filter:brightness(1.13)}button:disabled,input:disabled,select:disabled{opacity:.45;cursor:default}
        button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
        nav button{flex:1;border:0;background:transparent;color:var(--secondary-text-color)}nav button[aria-pressed=true]{background:var(--card-background-color);color:var(--primary-text-color);box-shadow:0 1px 4px #0002}
        .panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panels.single,.panels.stacked{grid-template-columns:1fr}.panels>.oil{grid-column:1/-1;margin-top:0}.empty{padding:16px 0}.tank-vessel{min-height:90px}.panel{padding:18px;border:1px solid var(--divider-color);border-radius:14px;min-width:0}
        .hero{margin:22px 0}.eyebrow,.muted{font-size:12px;color:var(--secondary-text-color);line-height:1.6}.amount{font-size:42px;line-height:1.3;letter-spacing:-1px;font-weight:600;font-variant-numeric:tabular-nums}.unit{font-size:22px;letter-spacing:0;font-weight:400;color:var(--secondary-text-color);margin-left:4px}
        .tank-estimate{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}
        .tank-estimate-label{font-size:12px;color:var(--secondary-text-color)}
        .tank-percent{font-size:24px;font-weight:600;letter-spacing:-.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
        .tank-estimate-note{margin:12px 0 0;font-size:12px;color:var(--secondary-text-color);line-height:1.6}
        .tank-profile{display:grid;grid-template-columns:76px minmax(0,1fr);gap:16px;align-items:stretch}
        .tank-vessel{display:grid;grid-template-rows:repeat(3,1fr);border:1px solid var(--divider-color);border-radius:28px;overflow:hidden;background:var(--card-background-color);padding:4px;gap:3px}
        .tank-layer{background:var(--tank-colour);transition:background .4s}
        .tank-layer:first-child{border-radius:22px 22px 3px 3px}.tank-layer:last-child{border-radius:3px 3px 22px 22px}
        .tank-values{display:grid;gap:3px;min-width:0}
        .tank-value{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:5px 0 5px 10px;border:0;border-radius:8px;background:transparent;text-align:left}
        .tank-value:hover{background:var(--secondary-background-color)}
        .tank-label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--secondary-text-color)}
        .tank-dot{width:6px;height:6px;border-radius:50%;background:var(--tank-colour);flex:none}
        .tank-number{font-size:27px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.6px;white-space:nowrap}
        .tank-number .unit{font-size:14px;margin-left:3px}
.water .origin{margin-top:8px}
        .oil-costs{margin-top:12px}.oil-costs>summary{min-height:44px}
        .oil-report-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:5px;font-size:12px;color:var(--secondary-text-color);margin-bottom:10px}
        .oil-cost-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .oil-metric{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:12px;text-align:left;min-height:72px}
        .oil-metric span{font-size:12px;color:var(--secondary-text-color)}.oil-metric strong{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.4px}
        .oil-split{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0;font-size:12px;color:var(--secondary-text-color)}.oil-split strong{font-weight:500;color:var(--primary-text-color);margin-left:5px}
        .oil-tracking{margin-top:12px}.oil-tracking button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;background:transparent}
        .oil-cost-note{margin:8px 0 0;font-size:11px;line-height:1.5;color:var(--secondary-text-color)}
        .oil{margin-top:16px}.oil-summary{display:flex;align-items:center;gap:12px}.oil-title{flex:1;min-width:0}.oil-title ha-icon{color:var(--ws-orange)}.oil-title .muted{margin-top:4px}.oil-readings{text-align:right;font-variant-numeric:tabular-nums}.oil-amount{font-size:32px;font-weight:600;line-height:1.2;letter-spacing:-.5px;white-space:nowrap}.oil-percent-unit{font-size:18px;font-weight:400;color:var(--secondary-text-color);margin-left:3px}.oil-history{width:44px;height:44px;padding:9px;flex-shrink:0;background:transparent}.oil-history ha-icon{width:22px;height:22px;color:var(--secondary-text-color)}.oil-meter{height:7px;border-radius:99px;background:var(--secondary-background-color);overflow:hidden;margin-top:16px}.oil-fill{height:100%;width:0;background:var(--ws-teal);border-radius:inherit;transition:width .3s ease}
        .field{display:block;font-size:13px;margin-bottom:16px}.field>select{display:block;width:100%;margin-top:6px}
        .target-row{display:flex;align-items:center;gap:6px;margin-top:7px}.target-row input{width:100%;text-align:center;font-size:20px;font-variant-numeric:tabular-nums;appearance:textfield}.target-row input::-webkit-inner-spin-button{appearance:none}
        .target-row button{flex-shrink:0}.step{font-size:21px;width:40px;padding:4px}.primary{background:#223b33;border-color:#3d6c5b;color:#91dfce}
        .boost-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:20px 0 9px;font-size:13px}.boost-remaining{color:#e5ad27;font-size:12px}
        .boost-buttons{display:flex;gap:8px}.boost-buttons button{flex:1;min-height:44px;font-weight:500}.cancel{width:100%;margin-top:8px;background:transparent;color:var(--secondary-text-color)}
        .rows{margin-top:16px;border-top:1px solid var(--divider-color);padding-top:10px}.row{display:flex;justify-content:space-between;gap:14px;padding:6px 0;font-size:12px}.row strong{text-align:right;font-weight:500;overflow-wrap:anywhere}
        .water-target{padding:12px 0 18px;font-size:13px}.water-target strong{font-size:20px;font-weight:500;display:block;margin-top:7px}.water-target .muted{display:block}
        .schedule-switch{max-width:100%;overflow-x:auto;margin-bottom:16px}.schedule-switch button{flex:0 0 auto;min-width:90px}.week{display:flex;gap:5px;margin:18px 0}.week button{flex:1;padding:8px 2px;font-size:12px}.week button[aria-pressed=true]{background:#223b33;border-color:#3d6c5b;color:#91dfce}
        .programme{border:1px solid var(--divider-color);border-radius:14px;padding:16px}.schedule-head{margin-bottom:12px}.schedule-head h3{font-size:14px}
        .slot{display:grid;grid-template-columns:1fr 1fr 40px;gap:10px;align-items:end;margin:12px 0}.slot label{font-size:12px;color:var(--secondary-text-color)}.slot input,.slot select{display:block;width:100%;margin-top:6px;font-size:14px}.remove{font-size:20px;padding:4px;color:var(--error-color);background:transparent}
        .schedule-actions,.copy-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.schedule-actions button{flex:1}.copy-row{align-items:center;font-size:12px}.copy-row select{flex:1}.copy-row button{flex-shrink:0}.schedule-help{margin:12px 0 0}
        .feedback:empty{display:none}.feedback{margin-top:16px;font-size:13px;line-height:1.5;color:#91dfce}.feedback.error{color:var(--error-color)}
        @container(max-width:650px){.panels{grid-template-columns:1fr}.panel{padding:16px}ha-card{padding:16px}.week{gap:3px}.week button{font-size:11px}.slot{gap:6px}.programme{padding:12px}}
        .channel-details{margin-top:14px;border-top:1px solid var(--divider-color)}
        .channel-details summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;color:var(--secondary-text-color);cursor:pointer;list-style:none}
        .channel-details summary::-webkit-details-marker{display:none}.channel-details summary::after{content:'+';font-size:20px}.channel-details[open]>summary::after{content:'−'}
        .channel-details summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px;border-radius:8px}
        .channel-details .field{margin-top:8px}.channel-details .rows{margin-top:8px}.channel-details .water-target{padding:4px 0 12px}
        .oil .oil-amount{font-size:28px}.oil .oil-meter{margin-top:10px}.oil .oil-title .muted{display:none}
      </style>
      <ha-card>
        <header><h2><ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span>Heating & hot water</span></h2><span class="badge">Heating</span></header>
        <nav aria-label="Heating card view"><button data-view="controls" aria-pressed="true">Controls</button><button data-view="schedule" aria-pressed="false">Schedule</button></nav>
        <p class="muted empty" hidden>Choose sections and entities in the card editor.</p>
        <section class="panels" aria-label="Heating controls"></section>
        <section class="panel oil" aria-label="Oil Level" hidden>
          <div class="oil-summary"><div class="oil-title"><h3><ha-icon icon="mdi:barrel-outline"></ha-icon><span>Oil Level</span></h3><div class="muted">Heating oil</div></div><div class="oil-readings"><div class="oil-amount"><span class="oil-percent">—</span><span class="oil-percent-unit">%</span></div><div class="muted oil-level">— L remaining</div></div><button class="oil-history" aria-label="View oil level history" title="View oil history"><ha-icon icon="mdi:chart-line"></ha-icon></button></div>
          <div class="oil-meter" role="progressbar" aria-label="Oil tank level" aria-valuemin="0" aria-valuemax="100"><div class="oil-fill"></div></div>
          <details class="channel-details oil-costs"><summary>View costs</summary>
            <div class="oil-report-head"><span>Reading interval</span><span class="oil-report-date">—</span></div>
            <p class="muted oil-waiting"></p>
            <div class="oil-cost-grid"><button class="oil-metric" data-oil-history="trackedUsage"><span>Estimated oil used</span><strong class="oil-used">—</strong></button><button class="oil-metric" data-oil-history="total"><span class="oil-cost-label">Estimated cost</span><strong class="oil-report-cost">—</strong></button></div>
            <div class="oil-split"><span>Est. heating <strong class="oil-heating-cost">—</strong></span><span>Est. hot water <strong class="oil-water-cost">—</strong></span></div>
            <div class="muted oil-rate"></div>
            <details class="channel-details oil-tracking"><summary>Usage & estimated cost history</summary><p class="muted oil-tracked-since"></p><div class="oil-tracked-totals"></div><p class="oil-cost-note"></p></details>
          </details>
        </section>
        <section class="schedule" aria-label="Heating schedules" hidden>
          <div class="external-schedule" hidden><p class="muted">Use your integration’s controls or the configured schedule helper.</p><button class="open-zone">Open zone controls</button><button class="open-schedule">Open schedule</button></div>
          <nav class="schedule-switch" aria-label="Programme"><button data-kind="heating" aria-pressed="true">Heating</button><button data-kind="water" aria-pressed="false">Hot water</button></nav>
          <div class="muted programme-name"></div><div class="week" aria-label="Day of week"></div>
          <div class="programme"><div class="schedule-head"><h3 class="day-title"></h3><button class="add">Add change</button></div><div class="slots"></div>
            <div class="copy-row"><span>Copy this day to</span><select aria-label="Copy day to"><option value="weekdays">Weekdays</option><option value="weekend">Weekend</option><option value="all">Every day</option></select><button class="copy">Copy day</button></div>
          </div>
          <p class="muted schedule-help">Each setting stays active until the next change, including overnight.</p>
          <div class="schedule-actions"><button class="save primary">Save programme</button><button class="reload">Reload programme</button></div>
          <div class="muted draft-state"></div>
        </section>
        <div class="feedback" role="status" aria-live="polite"></div>
      </ha-card>`;
    const root = this.shadowRoot;
    root.querySelector('.open-zone').onclick = () => this.moreInfo(this.entityId(this.kind));
    root.querySelector('.open-schedule').onclick = () => this.moreInfo(this.config.schedule_entity);
    root.querySelector('.oil-history').onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this._hass?.states[this.config.oil_level_entity] ? this.config.oil_level_entity : this.config.oil_percentage_entity }, bubbles: true, composed: true }));
    root.querySelectorAll('[data-oil-history]').forEach(button => button.onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: oilEntities(this.config)[button.dataset.oilHistory] }, bubbles: true, composed: true })));
    for (const kind of ['heating', 'water']) this.buildPanel(kind);
    root.querySelectorAll('[data-view]').forEach(button => button.onclick = () => { this.view = button.dataset.view; this.render(); if (this.view === 'schedule') this.loadProgramme(); });
    root.querySelectorAll('[data-kind]').forEach(button => button.onclick = () => { this.kind = button.dataset.kind; this.render(); this.renderProgramme(); this.loadProgramme(); });
    WEEK.forEach((day, index) => { const button = node('button', day.slice(0, 3)); button.setAttribute('aria-label', day); button.onclick = () => { this.day = index; this.renderProgramme(); }; root.querySelector('.week').append(button); });
    for (const day of WEEK) { const option = node('option', day); option.value = day; root.querySelector('.copy-row select').append(option); }
    root.querySelector('.add').onclick = () => {
      const draft = this.programmes[this.kind], slots = draft.data.ScheduleData[this.day].slots;
      const used = new Set(slots.map(slot => slot.Time));
      let hour = 6; while (used.has(`${String(hour).padStart(2, '0')}:00`) && hour < 24) hour++;
      slots.push({ Time: `${String(hour % 24).padStart(2, '0')}:00`, Setpoint: this.kind === 'water' ? 'Off' : 18 });
      draft.dirty = true; this.renderProgramme();
    };
    root.querySelector('.copy').onclick = () => {
      const target = root.querySelector('.copy-row select').value, draft = this.programmes[this.kind];
      for (const [index, day] of draft.data.ScheduleData.entries()) if (target === 'all' || target === 'weekdays' && index < 5 || target === 'weekend' && index > 4 || target === day.day) day.slots = clone(draft.data.ScheduleData[this.day].slots);
      draft.dirty = true; this.renderProgramme();
    };
    root.querySelector('.reload').onclick = () => this.loadProgramme(true);
    root.querySelector('.save').onclick = () => this.save();
  }

  static getStubConfig() { return { ...DEFAULTS, tank_entities: [], heating_entities: [], sections: ['heating', 'water'] }; }
  static getConfigForm() { return configForm(); }
  setConfig(config) {
    this.config = normalizeConfig(config);
    this._generation = (this._generation || 0) + 1; this.loading = false;
    this.programmes = {}; this.hub = config.hub; this.temperatureDirty = {};
    const channels = this.channels();
    if (!channels.includes(this.kind)) this.kind = channels[0] || 'heating';
    if (!this.config.show_schedule || !channels.length) this.view = 'controls';
    this.render();
  }
  set hass(hass) {
    const changed = !this._hass || [...ENTITY_FIELDS.map(key => this.config?.[key]), ...(this.config?.tank_entities || []), ...(this.config?.heating_entities || [])].some(id => this._hass.states[id] !== hass.states[id]) || this._hass.locale !== hass.locale;
    this._hass = hass; if (changed) this.render();
  }
  getCardSize() { return this.config?.sections.length === 1 ? 7 : 12; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  heatingKinds() { return (this.config?.heating_entities || []).map((_,i) => `heating_${i}`); }
  channels() { return this.config.sections.flatMap(s => s === 'heating' ? this.heatingKinds() : s === 'water' && this.config.hot_water_entity ? ['water'] : []); }
  entityId(kind) { return kind === 'water' ? this.config?.hot_water_entity : this.config?.heating_entities?.[Number(kind.split('_')[1] || 0)]; }
  channelName(kind) {
    if (kind === 'water') return this.config.water_name;
    if (this.config.heating_entities.length < 2) return this.config.heating_name;
    const id = this.entityId(kind);
    return this._hass?.states[id]?.attributes.friendly_name || id?.split('.')[1].replaceAll('_',' ') || 'Heating';
  }
  syncZones() {
    const key = JSON.stringify(this.config.heating_entities);
    if (this._zones === key) return;
    this._zones = key; this._sectionOrder = undefined;
    this.shadowRoot.querySelectorAll('.panel.heating').forEach(p => p.remove());
    for (const kind of this.heatingKinds().length ? this.heatingKinds() : ['heating_0']) this.buildPanel(kind);
    const nav = this.shadowRoot.querySelector('.schedule-switch'); nav.replaceChildren();
    for (const kind of [...this.heatingKinds(), 'water']) {
      const button = node('button', this.channelName(kind)); button.dataset.kind = kind;
      button.onclick = () => { this.kind = kind; this.render(); this.renderProgramme(); this.loadProgramme(); };
      nav.append(button);
    }
  }
  entity(kind) { const id = this.entityId(kind), state = this._hass?.states[id]; return state ? {...state,entity_id:id} : undefined; }
  moreInfo(entityId) { if (entityId) this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId},bubbles:true,composed:true})); }
  async scriptAction(kind, cancel = false, minutes = 0) {
    const script = this.config[cancel ? 'cancel_boost_script' : 'boost_script'];
    if (!script || this.busy || !this.entityId(kind)) return;
    this.busy = true; this.render();
    try {
      await this._hass.callService('script','turn_on',{entity_id:script,variables:{target_entity:this.entityId(kind),...(cancel ? {} : {duration_minutes:minutes})}});
      this.message(`${this.channelName(kind)}: ${cancel ? 'cancel' : 'boost'} requested.`);
    } catch(error) { this.message(error.message || 'The script could not be started.',true); }
    finally { this.busy = false; this.render(); }
  }
  temperature(value) { return value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString(this._hass?.locale?.language || undefined, { maximumFractionDigits: 1 }); }
  message(text, error = false) { const el = this.shadowRoot.querySelector('.feedback'); el.textContent = text; el.classList.toggle('error', error); }
  async action(kind, service, data, confirmed, success) {
    if (this.busy || !this.entityId(kind) || !this.config.sections.includes(kind === 'water' ? 'water' : 'heating')) return;
    this.busy = true; this.message('Updating…'); this.render();
    try { const states = await entityAction(this._hass, this.entityId(kind), service, data, confirmed); if (service === 'set_temperature') this.temperatureDirty[kind] = false; this.hass = { ...this._hass, states }; this.message(success); }
    catch (error) { this.message(error.message || 'The device could not complete this change.', true); }
    finally { this.busy = false; this.render(); }
  }
  buildPanel(kind) {
    const panel = node('article', undefined, `panel ${kind === 'water' ? 'water' : 'heating'}`);
    panel.dataset.channel = kind;
    panel.setAttribute('aria-label', kind !== 'water' ? 'Heating controls' : 'Hot water controls');
    panel.innerHTML = `<div class="panel-head"><h3><ha-icon icon="mdi:${kind !== 'water' ? 'radiator' : 'water-boiler'}"></ha-icon><span>${kind !== 'water' ? 'Heating' : 'Hot water'}</span></h3><span class="badge state">Connecting</span></div>
      <div class="hero">${kind !== 'water' ? '<div class="eyebrow">Room temperature</div><div class="amount"><span class="reading">—</span><span class="unit">°C</span></div>' : `<div class="water-reading" hidden><div class="eyebrow">Water temperature</div><div class="amount"><span class="reading">—</span><span class="unit">°C</span></div></div><div class="tank-estimate"><span class="tank-estimate-label">Estimated hot water</span><span class="tank-percent">—</span></div><div class="tank-profile" role="group" aria-label="Water tank temperatures"><div class="tank-vessel" aria-hidden="true"></div><div class="tank-values"></div></div>`}<div class="muted origin"></div></div>
      <label class="field target-field">Target temperature<div class="target-row"><button class="step minus" aria-label="Lower target temperature">−</button><input class="target" type="number" required aria-label="Target temperature"><button class="step plus" aria-label="Raise target temperature">+</button><button class="set primary">Set</button></div></label>
      <div class="field range-field" hidden><span>Target range</span><div class="target-row"><input class="target-low" type="number" required aria-label="Minimum target temperature"><span>–</span><input class="target-high" type="number" required aria-label="Maximum target temperature"><button class="set-range primary">Set</button></div></div>
      ${kind === 'water' ? '<div class="water-target">Temperature range<strong class="range">—</strong></div>' : ''}
      <label class="field">Mode<select class="mode" aria-label="${kind !== 'water' ? 'Heating' : 'Hot water'} mode"></select></label>
      <label class="field preset-field" hidden>Preset<select class="preset" aria-label="Preset"></select></label><div class="boost-head"><span>Boost ${kind !== 'water' ? 'heating' : 'hot water'}</span><span class="boost-remaining"></span></div><div class="boost-buttons"></div><button class="cancel">Cancel boost / override</button><div class="rows"></div>`;
    const details = node('details', undefined, 'channel-details');
    const summary = node('summary', 'Mode & details');
    details.append(summary, panel.querySelector('.mode').closest('label'), panel.querySelector('.preset-field'));
    const more = node('button','More controls'); more.onclick = () => this.moreInfo(this.entityId(kind)); details.append(more);
    if (kind === 'water') details.append(panel.querySelector('.water-target'));
    details.append(panel.querySelector('.rows'));
    if (kind === 'water') details.append(node('p', undefined, 'tank-estimate-note'));
    panel.append(details);
    this.shadowRoot.querySelector('.panels').append(panel);
    panel.querySelector('.mode').onchange = event => { const value = event.target.value, command = modeCommand(this.entity(kind),value); this.action(kind, command.service, command.data, state => (state.attributes.operation_mode || state.state) === value, `${kind !== 'water' ? 'Heating' : 'Hot water'} mode updated.`); };
    panel.querySelector('.preset').onchange = event => { const value = event.target.value; this.action(kind,'set_preset_mode',{preset_mode:value},state=>state.attributes.preset_mode===value,'Preset updated.'); };
    for (const [label, preset, minutes] of [['30 min', 'Boost 30m', 30], ['1 hour', 'Boost 1h', 60], ['2 hours', 'Boost 2h', 120]]) {
      const button = node('button', label); button.dataset.preset = preset; button.setAttribute('aria-label', `Boost ${kind !== 'water' ? 'heating' : 'hot water'} for ${minutes} minutes`);
      button.onclick = () => heatingCapabilities(this.entity(kind)).wiser ? this.action(kind, 'set_preset_mode', { preset_mode: preset }, state => boostConfirmed(state, minutes), `${kind !== 'water' ? 'Heating' : 'Hot water'} boost started for ${minutes} minutes.`) : this.scriptAction(kind,false,minutes);
      panel.querySelector('.boost-buttons').append(button);
    }
    panel.querySelector('.cancel').onclick = () => heatingCapabilities(this.entity(kind)).wiser ? this.action(kind, 'set_preset_mode', { preset_mode: 'Cancel Overrides' }, state => !state.attributes.is_boosted && !state.attributes.is_override, 'Boost and override cancelled.') : this.scriptAction(kind,true);
    {
      const input = panel.querySelector('.target'); input.oninput = () => { this.temperatureDirty[kind] = true; };
      for (const [selector, direction] of [['.minus', -1], ['.plus', 1]]) panel.querySelector(selector).onclick = () => { if (direction > 0) input.stepUp(); else input.stepDown(); this.temperatureDirty[kind] = true; };
      for (const selector of ['.target-low','.target-high']) panel.querySelector(selector).oninput = () => { this.temperatureDirty[kind] = true; };
      panel.querySelector('.set-range').onclick = () => {
        const low = panel.querySelector('.target-low'), high = panel.querySelector('.target-high');
        if (!low.reportValidity() || !high.reportValidity()) return;
        if (Number(low.value) > Number(high.value)) { this.message('The minimum target must not exceed the maximum.',true); return; }
        const target_temp_low = Number(low.value), target_temp_high = Number(high.value);
        this.action(kind,'set_temperature',{target_temp_low,target_temp_high},state=>state.attributes.target_temp_low===target_temp_low && state.attributes.target_temp_high===target_temp_high,'Target range updated.');
      };
      panel.querySelector('.set').onclick = () => { if (!input.reportValidity()) return; const temperature = Number(input.value); this.action(kind, 'set_temperature', { temperature }, state => Number(state.attributes.temperature) === temperature, 'Heating target updated.'); };
    }
  }

  syncTank(panel) {
    const ids = this.config.tank_entities, key = JSON.stringify(ids);
    if (panel.dataset.probes === key) return;
    panel.dataset.probes = key;
    const vessel = panel.querySelector('.tank-vessel'), values = panel.querySelector('.tank-values');
    vessel.replaceChildren(); values.replaceChildren();
    vessel.style.gridTemplateRows = `repeat(${ids.length || 1},1fr)`;
    ids.forEach((id, index) => {
      const label = ids.length === 1 ? 'Tank' : index === 0 ? 'Top' : index === ids.length - 1 ? 'Bottom' : index === (ids.length - 1) / 2 ? 'Middle' : `${Math.round((1 - index / (ids.length - 1)) * 100)}% height`;
      const layer = node('div', undefined, 'tank-layer'); layer.dataset.layer = String(index); vessel.append(layer);
      const button = node('button', undefined, 'tank-value'); button.dataset.tank = String(index); button.dataset.label = label;
      button.innerHTML = '<span class="tank-label"><span class="tank-dot" aria-hidden="true"></span><span class="probe-label"></span></span><span class="tank-number"><span class="reading">—</span><span class="unit">°C</span></span>';
      button.querySelector('.probe-label').textContent = label;
      button.onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info', {detail:{entityId:id},bubbles:true,composed:true}));
      values.append(button);
    });
  }

  async loadProgramme(reload = false) {
    if (!this.config.show_schedule || !this.entityId(this.kind) || this.loading || this.busy || !this._hass || !reload && this.programmes[this.kind]) return;
    const kind = this.kind, generation = this._generation;
    if (!heatingCapabilities(this.entity(kind)).wiser) { this.message(''); this.renderProgramme(); return; }
    this.loading = true; this.message('Loading programme…'); this.updateScheduleButtons();
    try {
      if (!this.hub) { const hubs = await this._hass.callWS({ type: 'wiser/hubs' }); if (hubs.length !== 1) throw new Error('Set the Wiser hub name in this card’s configuration.'); this.hub = hubs[0]; }
      if (generation !== this._generation) return;
      const entityId = this.entityId(kind);
      await this._hass.callService('homeassistant', 'update_entity', { entity_id: entityId });
      const state = (await this._hass.callWS({ type: 'get_states' })).find(state => state.entity_id === entityId);
      if (!available(state) || state.attributes.schedule_id == null) throw new Error('No programme is assigned to this Wiser channel.');
      const target = { entityId, hub: this.hub, type: kind !== 'water' ? 'Heating' : 'OnOff', id: state.attributes.schedule_id, min: state.attributes.min_temp ?? 5, max: state.attributes.max_temp ?? 30 };
      const schedule = await this._hass.callWS({ type: 'wiser/schedule/id', hub: target.hub, schedule_type: target.type, schedule_id: target.id });
      if (generation !== this._generation) return;
      this.programmes[kind] = { target, data: { ...schedule, ScheduleData: weeklyDays(schedule) }, baseline: scheduleKey(schedule), dirty: false };
      this.message('');
    } catch (error) { this.message(error.message || 'The programme could not be loaded.', true); }
    finally { if (generation === this._generation) { this.loading = false; this.renderProgramme(); } }
  }
  async save() {
    const kind = this.kind, draft = this.programmes[kind]; if (!draft || this.busy) return;
    this.busy = true; this.message('Saving programme…'); this.render();
    try {
      const saved = await saveProgramme(this._hass, draft.target, draft.data, draft.baseline);
      this.programmes[kind] = { ...draft, data: { ...saved, ScheduleData: weeklyDays(saved) }, baseline: scheduleKey(saved), dirty: false };
      this.message(`${kind !== 'water' ? 'Heating' : 'Hot water'} programme saved.`);
    } catch (error) { this.message(error.message || 'The programme could not be saved.', true); }
    finally { this.busy = false; this.renderProgramme(); this.render(); }
  }
  renderProgramme() {
    const root = this.shadowRoot, draft = this.programmes[this.kind];
    this.renderScheduleMode();
    root.querySelector('.day-title').textContent = WEEK[this.day];
    root.querySelectorAll('.week button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === this.day)));
    root.querySelector('.programme-name').textContent = draft ? draft.data.Name : 'Choose a programme to load its week.';
    const slots = draft?.data.ScheduleData[this.day].slots || [], list = root.querySelector('.slots'); list.replaceChildren();
    if (draft && !slots.length) list.append(node('p', 'No changes. The previous setting continues.', 'muted'));
    slots.forEach((slot, index) => {
      const row = node('div', undefined, 'slot'), timeLabel = node('label', 'Time'), input = node('input'); input.type = 'time'; input.required = true; input.step = '60'; input.value = slot.Time; input.setAttribute('aria-label', `${WEEK[this.day]} change ${index + 1} time`);
      input.oninput = () => { slot.Time = input.value; draft.dirty = true; this.updateScheduleButtons(); }; timeLabel.append(input);
      const label = node('label', this.kind !== 'water' ? 'Temperature' : 'Hot water'), select = node('select'); select.setAttribute('aria-label', `${WEEK[this.day]} change ${index + 1} setting`);
      const values = this.kind === 'water' ? ['Off', 'On'] : ['Off', ...Array.from({ length: Math.round((draft.target.max - draft.target.min) * 2) + 1 }, (_, i) => draft.target.min + i / 2)];
      for (const value of values) { const option = node('option', typeof value === 'number' ? `${value} °C` : value); option.value = String(value); select.append(option); }
      select.value = String(slot.Setpoint); select.onchange = () => { slot.Setpoint = select.value; draft.dirty = true; this.updateScheduleButtons(); }; label.append(select);
      const remove = node('button', '×', 'remove'); remove.setAttribute('aria-label', `Remove ${WEEK[this.day]} change ${index + 1}`); remove.onclick = () => { slots.splice(index, 1); draft.dirty = true; this.renderProgramme(); };
      row.append(timeLabel, label, remove); list.append(row);
    });
    this.updateScheduleButtons();
  }
  renderScheduleMode() {
    const native = heatingCapabilities(this.entity(this.kind)).wiser, root = this.shadowRoot;
    for (const selector of ['.programme-name','.week','.programme','.schedule-help','.schedule-actions','.draft-state']) root.querySelector(selector).hidden = !native;
    root.querySelector('.external-schedule').hidden = native;
    root.querySelector('.open-zone').disabled = !this.entityId(this.kind);
    root.querySelector('.open-schedule').hidden = !this.config.schedule_entity;
  }
  updateScheduleButtons() {
    const root = this.shadowRoot, draft = this.programmes[this.kind], disabled = this.busy || this.loading || !draft;
    root.querySelectorAll('.programme button,.programme input,.programme select').forEach(el => { el.disabled = disabled; });
    root.querySelector('.add').disabled = disabled || draft.data.ScheduleData[this.day].slots.length >= 8;
    root.querySelector('.save').disabled = disabled || !draft.dirty;
    root.querySelector('.reload').disabled = this.busy || this.loading;
    root.querySelectorAll('[data-kind]').forEach(el => { el.disabled = this.busy || this.loading; });
    root.querySelector('.reload').textContent = draft?.dirty ? 'Discard edits' : 'Reload programme';
    root.querySelector('.draft-state').textContent = draft?.dirty ? 'Unsaved changes' : '';
  }
  renderOilCosts(oil) {
    const entities = oilEntities(this.config), data = oilCosts(this._hass.states, this.config), locale = this._hass.locale?.language || undefined;
    const money = value => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: this.config.currency }).format(value);
    const number = value => value == null ? '—' : value.toLocaleString(locale, { maximumFractionDigits: 2 });
    const date = value => new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const ledger = data.ledger;
    oil.querySelector('.oil-report-date').textContent = data.report == null ? 'Reading date unavailable' : data.start ? `${date(data.start)} – ${date(data.report)}` : `Latest reading ${date(data.report)}`;
    oil.querySelector('.oil-waiting').textContent = data.saved ? '' : 'Awaiting the next tank reading to estimate usage and cost.';
    oil.querySelector('.oil-cost-grid').hidden = !data.saved;
    oil.querySelector('.oil-split').hidden = !data.saved;
    oil.querySelector('.oil-used').textContent = data.litres == null ? '—' : `${number(data.litres)} L`;
    oil.querySelector('.oil-report-cost').textContent = money(data.cost);
    oil.querySelector('.oil-cost-label').textContent = 'Estimated cost';
    oil.querySelector('.oil-heating-cost').textContent = money(data.heating);
    oil.querySelector('.oil-water-cost').textContent = money(data.water);
    oil.querySelector('.oil-rate').textContent = `${money(data.price)}/L · ${data.priceKwh == null ? '—' : new Intl.NumberFormat(locale, {style:'currency',currency:this.config.currency,maximumFractionDigits:3}).format(data.priceKwh)}/kWh · ${this.config.energy_per_litre} kWh/L`;
    oil.querySelectorAll('[data-oil-history]').forEach(button => { button.disabled = !this._hass.states[oilEntities(this.config)[button.dataset.oilHistory]]; });
    oil.querySelector('.oil-tracked-since').textContent = !ledger ? 'Starting cost tracking…' : ledger.reports ? `Tracked since ${date(ledger.since)} · ${ledger.reports} report${ledger.reports === 1 ? '' : 's'}` : `Tracking since ${date(ledger.since)}`;
    const totals = oil.querySelector('.oil-tracked-totals'); totals.replaceChildren();
    if (ledger?.reports) {
      for (const [label, value, key] of [['Estimated oil used', `${number(ledger.litres)} L`, 'trackedUsage'], ['Estimated total cost', money(ledger.cost), 'total'], ['Heating estimate', money(ledger.heating), 'heating'], ['Hot water estimate', money(ledger.water), 'water']]) {
        const button = node('button'); button.append(node('span', label), node('strong', value)); button.onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: entities[key] }, bubbles: true, composed: true })); totals.append(button);
      }
      if (ledger.unallocated > 0) totals.append(node('p', `${money(ledger.unallocated)} not allocated to a heating channel.`, 'muted'));
      if (ledger.unpriced_litres > 0) totals.append(node('p', `${number(ledger.unpriced_litres)} L has no recorded price; the estimated cost total is incomplete.`, 'muted'));
    }
    oil.querySelector('.oil-cost-note').textContent = (data.refill ? 'Tank refill detected; usage during that interval cannot be estimated. ' : '') + 'Usage is estimated from the drop in tank level between readings, including gaps of several days. All costs are estimates, using the price when the reading arrives. Heating and hot water are split by demand time across that interval where enough history exists. Sensor variation and refills affect accuracy.';
  }

  render() {
    if (!this.config || !this._hass) return;
    const root = this.shadowRoot;
    this.syncZones();
    const titles = this.config.sections.map(section => this.config[`${section === 'water' ? 'water' : section}_name`]);
    root.querySelector('header h2 span').textContent = this.config.name.trim() || titles.join(' & ') || 'Slate Heating Card';
    root.querySelector('header ha-icon').setAttribute('icon', this.config.sections.length === 1 ? ({heating:'mdi:radiator',water:'mdi:water-boiler',oil:'mdi:barrel-outline'}[this.config.sections[0]]) : 'mdi:home-thermometer-outline');
    root.querySelector('header').hidden = !this.config.show_header;
    root.querySelector('.empty').hidden = this.config.sections.length > 0;
    const channels = this.channels();
    const zoneCount = channels.filter(k => k.startsWith('heating')).length;
    root.querySelector('header .badge').hidden = zoneCount < 2;
    root.querySelector('header .badge').textContent = `${zoneCount} zones`;
    this.renderScheduleMode();
    const hasSchedule = this.config.show_schedule && channels.length && (this.config.schedule_entity || channels.some(k => heatingCapabilities(this.entity(k)).wiser));
    root.querySelector('nav[aria-label="Heating card view"]').hidden = !hasSchedule;
    if (!hasSchedule) this.view = 'controls';
    root.querySelector('.schedule-switch').hidden = channels.length < 2;
    root.querySelectorAll('[data-kind]').forEach(el => { el.hidden = !channels.includes(el.dataset.kind); el.textContent = this.channelName(el.dataset.kind); });
    const panels = root.querySelector('.panels');
    panels.classList.toggle('stacked', this.config.layout === 'stacked');
    panels.classList.toggle('single', (this.config.sections.includes('heating') ? Math.max(1,this.config.heating_entities.length) : 0) + Number(this.config.sections.includes('water')) < 2);
    const order = JSON.stringify(this.config.sections);
    if (this._sectionOrder !== order) {
      for (const section of this.config.sections) {
        if (section === 'heating') panels.append(...root.querySelectorAll('.panel.heating'));
        else panels.append(root.querySelector(`.panel.${section}`));
      }
      this._sectionOrder = order;
    }

    root.querySelector('.panels').hidden = this.view !== 'controls'; root.querySelector('.schedule').hidden = this.view !== 'schedule';
    root.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.view === this.view)));
    root.querySelectorAll('[data-kind]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.kind === this.kind)));
    const oil = root.querySelector('.oil'), levelEntity = this._hass.states[this.config.oil_level_entity];
    oil.hidden = this.view !== 'controls' || !this.config.sections.includes('oil');
    oil.querySelector('h3 span').textContent = this.config.oil_name;
    oil.setAttribute('aria-label',this.config.oil_name);
    oil.querySelector('.oil-costs').hidden = !this.config.oil_cost_entity;
    oil.querySelector('.oil-readings').hidden = !this.config.oil_level_entity && !this.config.oil_percentage_entity;
    oil.querySelector('.oil-amount').hidden = !this.config.oil_percentage_entity;
    oil.querySelector('.oil-level').hidden = !this.config.oil_level_entity;
    oil.querySelector('.oil-meter').hidden = !this.config.oil_percentage_entity;
    const litres = oilReading(levelEntity), percent = oilReading(this._hass.states[this.config.oil_percentage_entity], 100);
    const formatOil = value => value == null ? '—' : value.toLocaleString(this._hass.locale?.language || undefined, { maximumFractionDigits: 1 });
    oil.querySelector('.oil-percent').textContent = formatOil(percent);
    oil.querySelector('.oil-level').textContent = `${formatOil(litres)} ${levelEntity?.attributes.unit_of_measurement || 'L'} remaining`;
    oil.querySelector('.oil-fill').style.width = `${percent ?? 0}%`;
    const meter = oil.querySelector('.oil-meter');
    if (percent == null) meter.removeAttribute('aria-valuenow'); else meter.setAttribute('aria-valuenow', String(percent));
    meter.setAttribute('aria-valuetext', percent == null ? 'Oil percentage unavailable' : `${formatOil(percent)}% full`);
    oil.querySelector('.oil-history').disabled = !levelEntity && !this._hass.states[this.config.oil_percentage_entity];
    this.renderOilCosts(oil);
    for (const kind of [...(this.heatingKinds().length ? this.heatingKinds() : ['heating_0']), 'water']) {
      const entity = this.entity(kind), attr = entity?.attributes || {}, panel = [...root.querySelectorAll('.panel[data-channel]')].find(p => p.dataset.channel === kind), ready = available(entity);
      panel.hidden = !this.config.sections.includes(kind === 'water' ? 'water' : 'heating');
      if (panel.hidden) continue;
      panel.querySelector('h3 span').textContent = this.channelName(kind);
      panel.setAttribute('aria-label', `${this.channelName(kind)} controls`);
      panel.querySelector('.boost-head').hidden = panel.querySelector('.boost-buttons').hidden = !this.config.show_boost || !this.entityId(kind);
      panel.querySelector('.channel-details').hidden = !this.entityId(kind);
      const caps = heatingCapabilities(entity), badge = panel.querySelector('.state'); badge.textContent = !ready ? 'Unavailable' : attr.is_boosted ? 'Boosting' : attr.is_heating || attr.hvac_action === 'heating' ? 'Heating' : attr.hvac_action && attr.hvac_action !== 'off' ? titleCase(attr.hvac_action) : entity.state === 'off' ? 'Off' : caps.domain === 'climate' ? 'Idle' : titleCase(entity.state); badge.classList.toggle('active', !!attr.is_boosted || !!attr.is_heating);
      if (kind !== 'water') panel.querySelector('.reading').textContent = ready ? this.temperature(attr.current_temperature) : '—';
      else { this.syncTank(panel); panel.querySelectorAll('[data-tank]').forEach(el => {
        const sensor = this._hass.states[this.config.tank_entities[Number(el.dataset.tank)]];
        el.querySelector('.reading').textContent = this.temperature(tankTemperature(sensor));
        const colour = tankColour(sensor);
        el.style.setProperty('--tank-colour', colour);
        panel.querySelector(`[data-layer="${el.dataset.tank}"]`).style.setProperty('--tank-colour', colour);
        el.setAttribute('aria-label', `Tank ${el.dataset.label}: ${tankTemperature(sensor) == null ? 'unavailable' : `${this.temperature(sensor.state)} ${sensor.attributes?.unit_of_measurement || '°C'}`}. Open history`);
        el.querySelector('.unit').textContent = sensor?.attributes.unit_of_measurement || '°C';
      }); }
      if (kind === 'water') {
        const positions = this.config.tank_entities;
        panel.querySelector('.water-reading').hidden = positions.length > 0 || !Number.isFinite(attr.current_temperature);
        panel.querySelector('.water-reading .reading').textContent = this.temperature(attr.current_temperature);
        panel.querySelector('.water-reading .unit').textContent = attr.temperature_unit || this._hass.config?.unit_system?.temperature || '°C';
        panel.querySelector('.tank-profile').hidden = !positions.length;
        panel.querySelector('.tank-vessel').style.gridTemplateRows = `repeat(${positions.length || 1},1fr)`;
        panel.querySelector('.tank-estimate').hidden = positions.length < 2 || !this.config.show_tank_estimate;
        panel.querySelector('.tank-estimate-note').hidden = positions.length < 2 || !this.config.show_tank_estimate;
        panel.querySelector('.state').hidden = !this.entityId(kind);
        panel.querySelector('.origin').hidden = !this.entityId(kind);
        const threshold = this.config.tank_hot_threshold;
        const sensors = this.config.tank_entities.map(id => this._hass.states[id]);
        const estimate = hotTankPercent(sensors, threshold);
        const summary = panel.querySelector('.tank-estimate');
        panel.querySelector('.tank-percent').textContent = estimate == null ? '—' : `≈${estimate}%`;
        summary.setAttribute('aria-label', estimate == null ? 'Hot water estimate unavailable' : `Approximately ${estimate}% of the tank at or above ${threshold} degrees Celsius`);
        summary.title = `Approximate share of the tank at or above ${threshold} °C`;
        panel.querySelector('.tank-estimate-note').textContent = `Estimated share of the tank at or above ${threshold} °C, interpolated between ${sensors.length} evenly spaced probes across the tank height and rounded to 5%. This estimates the hot portion of the tank, not litres or time remaining.`;
      }
      panel.querySelector('.origin').textContent = !ready ? 'Waiting for device' : attr.is_boosted ? 'Timed boost active' : attr.is_override ? 'Temporary override' : caps.wiser && entity.state === 'auto' ? 'Following your programme' : modes[entity.state] || titleCase(entity.state);
      panel.querySelector('.boost-remaining').textContent = attr.is_boosted ? `${Number(attr.boost_time_remaining || 0)} min left` : '';
      const select = panel.querySelector('.mode'), options = caps.modes;
      select.closest('label').hidden = !options.length;
      if (select.dataset.options !== JSON.stringify(options)) { select.replaceChildren(...options.map(value => { const option = node('option', caps.wiser && value === 'auto' ? 'Schedule' : caps.wiser && value === 'heat' ? 'Manual' : modes[value] || titleCase(value)); option.value = value; return option; })); select.dataset.options = JSON.stringify(options); }
      select.value = attr.operation_mode || entity?.state || '';
      const preset = panel.querySelector('.preset');
      panel.querySelector('.preset-field').hidden = caps.wiser || !caps.presets.length;
      if (preset.dataset.options !== JSON.stringify(caps.presets)) { preset.replaceChildren(...caps.presets.map(value => { const option = node('option',titleCase(value)); option.value=value; return option; })); preset.dataset.options=JSON.stringify(caps.presets); }
      preset.value = attr.preset_mode || '';
      panel.querySelectorAll('button,input,select').forEach(el => { el.disabled = this.busy || !ready; });
      panel.querySelectorAll('[data-tank]').forEach(el => { el.disabled = !this._hass.states[this.config.tank_entities[Number(el.dataset.tank)]]; });
      panel.querySelector('.boost-head').hidden = panel.querySelector('.boost-buttons').hidden = !this.config.show_boost || !(caps.wiser || this.config.boost_script);
      panel.querySelectorAll('[data-preset]').forEach(el => { el.disabled ||= caps.wiser ? !caps.presets.includes(el.dataset.preset) : !this.config.boost_script; });
      panel.querySelector('.cancel').disabled ||= caps.wiser ? !(attr.is_boosted || attr.is_override) : !this.config.cancel_boost_script;
      panel.querySelector('.cancel').hidden = !this.entityId(kind) || (caps.wiser ? ready && !(attr.is_boosted || attr.is_override) : !this.config.cancel_boost_script);
      const unit = attr.temperature_unit || this._hass.config?.unit_system?.temperature || '°C';
      if (kind !== 'water') panel.querySelector('.hero .unit').textContent = unit;
      panel.querySelector('.target-field').hidden = !caps.scalar;
      panel.querySelector('.range-field').hidden = !caps.range;
      for (const selector of ['.target-low','.target-high']) {
        const input = panel.querySelector(selector); input.min = attr.min_temp ?? (unit === '°F' ? 40 : 5); input.max = attr.max_temp ?? (unit === '°F' ? 95 : 35); input.step=attr.target_temp_step ?? (unit === '°F' ? 1 : .5);
        if (!this.temperatureDirty[kind]) input.value = (selector === '.target-low' ? attr.target_temp_low : attr.target_temp_high) ?? '';
      }
      {
        const input = panel.querySelector('.target'); input.min = attr.min_temp ?? (unit === '°F' ? 40 : 5); input.max = attr.max_temp ?? (unit === '°F' ? 95 : 35); input.step = attr.target_temp_step ?? (unit === '°F' ? 1 : .5);
        if (!this.temperatureDirty[kind]) input.value = ready && attr.temperature != null ? attr.temperature : '';
      }
      if (kind === 'water') { panel.querySelector('.water-target').hidden = !caps.wiser || attr.target_temp_low == null; panel.querySelector('.range').textContent = `${this.temperature(attr.target_temp_low)}–${this.temperature(attr.target_temp_high)} ${unit}`; }
      const next = attr.next_schedule_datetime ? new Date(attr.next_schedule_datetime.replace(' ', 'T')) : null;
      const nextTime = next && !Number.isNaN(next.valueOf()) ? next.toLocaleString(this._hass.locale?.language || undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      const setting = attr.next_schedule_temp, nextSetting = typeof setting === 'number' ? `${setting} °C` : setting || '';
      const rows = kind !== 'water' ? [['Heating demand', attr.percentage_demand == null ? '—' : `${attr.percentage_demand}%`], ['Humidity', attr.current_humidity == null ? '—' : `${attr.current_humidity}%`]] : [['Hot water output', attr.control_output_state || '—']];
      if (next) rows.push(['Next change', `${nextTime}${nextSetting ? ` · ${nextSetting}` : ''}`]);
      for (let i=rows.length-1;i>=0;i--) if (rows[i][1] === '—') rows.splice(i,1);
      panel.querySelector('.rows').hidden = !rows.length;
      panel.querySelector('.rows').replaceChildren(...rows.map(([label, value]) => { const row = node('div', undefined, 'row'); row.append(node('span', label), node('strong', value)); return row; }));
    }
    this.updateScheduleButtons();
  }
}
if (!customElements.get('slate-heating-card')) {
  customElements.define('slate-heating-card', SlateHeatingCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'slate-heating-card', name: 'Slate Heating Card', description: 'Heating zones, hot water, any number of tank probes and optional oil costs.', preview: true });
}
// Preserve the previous dashboard type without adding a duplicate picker entry.
if (!customElements.get('wiser-slate-card')) customElements.define('wiser-slate-card', class extends SlateHeatingCard {});
