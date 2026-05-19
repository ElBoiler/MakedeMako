export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'hidden' && !v) {}
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function field({ id, label, type = 'text', value = '', error, helper, multiline = false }) {
  const inputEl = multiline
    ? el('textarea', { id, rows: 3 }, value)
    : el('input', { id, type, value });
  if (error) inputEl.classList.add('invalid');
  return el('div', {},
    el('label', { for: id }, label),
    inputEl,
    error  ? el('div', { class: 'field-error' }, error) : null,
    helper ? el('div', { class: 'helper' }, helper)     : null,
  );
}

export function radioGroup({ id, label, options, value, error, helper }) {
  const radios = options.map(opt =>
    el('label', {},
      el('input', { type: 'radio', name: id, value: opt.value, ...(opt.value === value ? { checked: 'checked' } : {}) }),
      ' ', opt.label,
    )
  );
  return el('div', {},
    el('label', {}, label),
    el('div', { class: 'radios' }, ...radios),
    error  ? el('div', { class: 'field-error' }, error) : null,
    helper ? el('div', { class: 'helper' }, helper)     : null,
  );
}

/**
 * Render a three-field address block (Straße, PLZ, Ort) with autocomplete drop.
 * @param {{ prefix: string, label: string, values: object, errors: object }} opts
 */
export function addressBlock({ prefix, label, values, errors }) {
  const strId = `${prefix}.strasse`;
  const plzId = `${prefix}.plz`;
  const ortId = `${prefix}.ort`;
  const dropId = strId.replace(/\./g, '-') + '-drop';  // matches wireAc _dropId()

  return el('div', { class: 'address-block' },
    el('label', {}, label),
    el('div', { class: 'autocomplete-wrap' },
      el('input', { id: strId, type: 'text', value: values.strasse ?? '', autocomplete: 'off',
        ...(errors[strId] ? { class: 'invalid' } : {}) }),
      el('ul', { id: dropId, class: 'autocomplete-drop', role: 'listbox' }),
    ),
    errors[strId] ? el('div', { class: 'field-error' }, errors[strId]) : null,
    el('div', { class: 'addr-row2' },
      el('div', {},
        el('label', { for: plzId }, 'PLZ'),
        el('input', { id: plzId, type: 'text', value: values.plz ?? '', style: 'width: 6em',
          ...(errors[plzId] ? { class: 'invalid' } : {}) }),
        errors[plzId] ? el('div', { class: 'field-error' }, errors[plzId]) : null,
      ),
      el('div', { style: 'flex: 1' },
        el('label', { for: ortId }, 'Ort'),
        el('input', { id: ortId, type: 'text', value: values.ort ?? '',
          ...(errors[ortId] ? { class: 'invalid' } : {}) }),
        errors[ortId] ? el('div', { class: 'field-error' }, errors[ortId]) : null,
      ),
    ),
  );
}

export function renderStepNav(currentStep, errorsByStep) {
  const nav = document.getElementById('stepNav');
  for (const li of nav.querySelectorAll('li')) {
    const step = Number(li.dataset.step);
    li.classList.toggle('active', step === currentStep);
    li.classList.toggle('error',  !!errorsByStep[step]);
    li.classList.toggle('done',   step < currentStep && !errorsByStep[step]);
  }
}
