import { el } from './render.js';

export function showModal({ title, body, detail }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';

  const close = () => { root.innerHTML = ''; };
  const backdrop = el('div', { class: 'modal-backdrop', onclick: e => { if (e.target === backdrop) close(); } },
    el('div', { class: 'modal' },
      el('h3', {}, title),
      el('p', {}, body),
      detail ? el('details', {},
        el('summary', {}, 'Technische Details'),
        el('pre', { style: 'white-space: pre-wrap; font-size: 11px' }, detail),
      ) : null,
      el('div', { style: 'text-align: right; margin-top: 16px' },
        el('button', { class: 'primary', onclick: close }, 'OK'),
      ),
    ),
  );
  root.appendChild(backdrop);
}
