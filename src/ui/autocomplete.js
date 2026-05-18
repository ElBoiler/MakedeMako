/**
 * Generic autocomplete widget.
 *
 * Use acField() to render the DOM structure, then wireAc() to attach behaviour.
 * The widget does NOT call onChange during typing — only on item selection or
 * blur — so no rerender fires while the search is in flight.
 */

import { el } from './render.js';

// ── DOM builder ────────────────────────────────────────────────────────────

/**
 * Render an autocomplete-capable field.
 * @param {{ id, label, value?, error?, multiline? }} opts
 */
export function acField({ id, label, value = '', error, multiline = false }) {
  const inputEl = multiline
    ? el('textarea', { id, rows: 3, autocomplete: 'off',
        ...(error ? { class: 'invalid' } : {}) }, value)
    : el('input', { id, type: 'text', value, autocomplete: 'off',
        ...(error ? { class: 'invalid' } : {}) });

  return el('div', {},
    el('label', { for: id }, label),
    el('div', { class: 'autocomplete-wrap' },
      inputEl,
      el('ul', { id: _dropId(id), class: 'autocomplete-drop', role: 'listbox' }),
    ),
    error ? el('div', { class: 'field-error' }, error) : null,
  );
}

// ── Wiring ─────────────────────────────────────────────────────────────────

/**
 * Wire autocomplete behaviour onto an existing acField in the DOM.
 *
 * @param {HTMLElement} root
 * @param {{
 *   id: string,
 *   minChars?: number,
 *   debounce?: number,
 *   search: (q: string) => Promise<Array<{ label: string, sublabel?: string, select: () => void }>>,
 *   onBlur?: (value: string) => void,
 *   signal: AbortSignal,
 * }} opts
 */
export function wireAc(root, { id, minChars = 2, debounce = 320, search, onBlur, signal }) {
  const input = root.querySelector(`[id="${id}"]`);
  const drop  = root.querySelector(`#${_dropId(id)}`);
  if (!input || !drop) return;

  let timer = null;

  // ── typing ──────────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < minChars) { _close(drop); return; }
    _loading(drop);
    timer = setTimeout(async () => {
      let items;
      try { items = await search(q); } catch { _close(drop); return; }
      if (signal.aborted) return;
      _populate(drop, items, () => _close(drop));
    }, debounce);
  }, { signal });

  // ── blur: sync state if user typed freely without selecting ─────────────
  input.addEventListener('blur', () => {
    // delay so mousedown on an item fires before we close
    setTimeout(() => {
      if (!drop.contains(document.activeElement)) {
        _close(drop);
        onBlur?.(input.value.trim());
      }
    }, 160);
  }, { signal });

  // ── keyboard nav ─────────────────────────────────────────────────────────
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { _close(drop); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      drop.querySelector('li[role="option"]')?.focus();
    }
  }, { signal });

  drop.addEventListener('keydown', e => {
    const opts = [...drop.querySelectorAll('li[role="option"]')];
    const i    = opts.indexOf(e.target);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[i + 1]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); i > 0 ? opts[i - 1].focus() : input.focus(); }
    if (e.key === 'Escape')    { _close(drop); input.focus(); }
    if (e.key === 'Enter')     { e.preventDefault(); e.target.click(); }
  }, { signal });
}

// ── internals ──────────────────────────────────────────────────────────────

function _dropId(id) { return id.replace(/\./g, '-') + '-drop'; }

function _loading(drop) {
  drop.replaceChildren(
    Object.assign(document.createElement('li'), { className: 'ac-status', textContent: 'Suche …' }),
  );
  drop.classList.add('is-open');
}

function _populate(drop, items, onClose) {
  if (!items.length) {
    drop.replaceChildren(
      Object.assign(document.createElement('li'), { className: 'ac-status', textContent: 'Keine Ergebnisse' }),
    );
    drop.classList.add('is-open');
    return;
  }
  drop.replaceChildren(...items.map(({ label, sublabel, select }) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '-1');

    const lbl = document.createElement('span');
    lbl.className = 'ac-label';
    lbl.textContent = label;
    li.appendChild(lbl);

    if (sublabel) {
      const sub = document.createElement('span');
      sub.className = 'ac-sublabel';
      sub.textContent = sublabel;
      li.appendChild(sub);
    }

    // preventDefault on mousedown keeps focus on the input so blur fires AFTER click
    li.addEventListener('mousedown', e => e.preventDefault());
    li.addEventListener('click', () => { onClose(); select(); });
    return li;
  }));
  drop.classList.add('is-open');
}

function _close(drop) {
  drop.classList.remove('is-open');
  drop.replaceChildren();
}
