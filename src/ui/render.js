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

export function renderStepNav(currentStep, errorsByStep) {
  const nav = document.getElementById('stepNav');
  for (const li of nav.querySelectorAll('li')) {
    const step = Number(li.dataset.step);
    li.classList.toggle('active', step === currentStep);
    li.classList.toggle('error',  !!errorsByStep[step]);
    li.classList.toggle('done',   step < currentStep && !errorsByStep[step]);
  }
}
