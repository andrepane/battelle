let activeDialog = null;
const toastState = new WeakMap();

const appendText = (doc, parent, tag, text, attributes = {}) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.textContent = String(text ?? '');
  parent.append(node);
  return node;
};

const focusable = dialog => [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];

function presentDialog(options, env = {}) {
  const doc = env.document ?? globalThis.document;
  const requestFrame = env.requestFrame ?? globalThis.requestAnimationFrame;
  if (activeDialog) return activeDialog;
  const trigger = options.trigger ?? doc.activeElement;
  activeDialog = new Promise(resolve => {
    const dialog = doc.createElement('dialog');
    const id = `battelle-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dialog.className = 'battelle-dialog';
    dialog.dataset.tone = options.tone ?? 'neutral';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-description`);
    const form = doc.createElement('form');
    form.setAttribute('method', 'dialog');
    const body = doc.createElement('div'); body.className = 'battelle-dialog__body';
    appendText(doc, body, 'h2', options.title, { id: `${id}-title` });
    appendText(doc, body, 'p', options.message, { id: `${id}-description` });
    if (options.details?.length) {
      const details = doc.createElement('details'); details.className = 'battelle-dialog__details';
      appendText(doc, details, 'summary', 'Detalles');
      const list = doc.createElement('ul');
      for (const detail of options.details) appendText(doc, list, 'li', detail);
      details.append(list); body.append(details);
    }
    const error = appendText(doc, body, 'p', '', { role: 'alert' }); error.className = 'battelle-dialog__error'; error.hidden = true;
    const actions = doc.createElement('footer'); actions.className = 'battelle-dialog__actions';
    let cancel = null;
    if (options.confirmLabel) {
      cancel = appendText(doc, actions, 'button', options.cancelLabel ?? 'Cancelar', { type: 'button' });
      cancel.className = 'secondary-button battelle-dialog__cancel';
    }
    const primary = appendText(doc, actions, 'button', options.confirmLabel ?? options.closeLabel ?? 'Cerrar', { type: 'button' });
    primary.className = `primary-button battelle-dialog__primary${options.tone === 'danger' ? ' danger-button' : ''}`;
    form.append(body, actions); dialog.append(form);
    let settled = false; let working = false;
    const cleanup = () => {
      dialog.removeEventListener('cancel', onCancel); dialog.removeEventListener('keydown', onKeydown);
      cancel?.removeEventListener('click', onCancelClick); primary.removeEventListener('click', onPrimary);
    };
    const finish = value => {
      if (settled) return; settled = true; cleanup();
      if (dialog.open) dialog.close(); dialog.remove(); activeDialog = null; resolve(value);
      requestFrame?.(() => { if (trigger?.isConnected) trigger.focus(); });
    };
    const onCancel = event => { event.preventDefault(); if (!working) finish(false); };
    const onCancelClick = () => { if (!working) finish(false); };
    const onKeydown = event => {
      if (event.key !== 'Tab') return;
      const items = focusable(dialog); if (!items.length) return;
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onPrimary = async () => {
      if (working || settled) return;
      if (!options.onConfirm) { finish(options.confirmLabel ? true : undefined); return; }
      working = true; primary.disabled = true; if (cancel) cancel.disabled = true;
      const label = primary.textContent; primary.textContent = options.pendingLabel ?? 'Procesando…'; error.hidden = true;
      try { await options.onConfirm(); finish(true); }
      catch { error.textContent = options.errorMessage ?? 'No se pudo completar la operación. Comprueba la conexión e inténtalo de nuevo.'; error.hidden = false; working = false; primary.disabled = false; if (cancel) cancel.disabled = false; primary.textContent = label; primary.focus(); }
    };
    dialog.addEventListener('cancel', onCancel); dialog.addEventListener('keydown', onKeydown);
    cancel?.addEventListener('click', onCancelClick); primary.addEventListener('click', onPrimary);
    doc.body.append(dialog); dialog.showModal(); requestFrame?.(() => (cancel ?? primary).focus());
  });
  return activeDialog;
}

export function showConfirmDialog(options, env) { return presentDialog(options, env); }
export function showMessageDialog(options, env) { return presentDialog(options, env); }

export function showToast({ message, tone = 'neutral', duration = 6000 }, { document: doc = globalThis.document, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  let state = toastState.get(doc);
  if (!state) {
    const region = doc.createElement('section'); region.className = 'battelle-toasts'; region.setAttribute('aria-label', 'Notificaciones'); region.setAttribute('aria-live', 'polite'); region.setAttribute('aria-relevant', 'additions');
    doc.body.append(region); state = { region, recent: new Map() }; toastState.set(doc, state);
  }
  const key = `${tone}:${message}`; if (state.recent.has(key)) return state.recent.get(key).toast;
  const toast = doc.createElement('div'); toast.className = 'battelle-toast'; toast.dataset.tone = tone; toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  appendText(doc, toast, 'span', message);
  const close = appendText(doc, toast, 'button', 'Cerrar notificación', { type: 'button', 'aria-label': 'Cerrar notificación' }); close.className = 'battelle-toast__close';
  toast.append(close); state.region.prepend(toast);
  while (state.region.children.length > 3) state.region.lastElementChild.remove();
  let remaining = duration, started = Date.now(), timer;
  const remove = () => { clearTimer(timer); state.recent.delete(key); toast.remove(); };
  const resume = () => { started = Date.now(); timer = setTimer(remove, remaining); };
  const pause = () => { clearTimer(timer); remaining = Math.max(0, remaining - (Date.now() - started)); };
  close.addEventListener('click', remove, { once: true }); toast.addEventListener('mouseenter', pause); toast.addEventListener('mouseleave', resume); toast.addEventListener('focusin', pause); toast.addEventListener('focusout', resume);
  state.recent.set(key, { toast }); resume(); return toast;
}
