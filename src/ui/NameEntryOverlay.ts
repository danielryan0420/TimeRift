import { MAX_NAME_LENGTH, isValidName, sanitizeName } from '../core/names';

export interface NameEntryOptions {
  title: string;
  initialValue?: string;
  confirmLabel?: string;
  placeholder?: string;
  onConfirm: (name: string) => void;
  onCancel?: () => void;
}

/**
 * A real HTML <input> overlaid on top of the canvas, not a Phaser DOM element.
 * iOS only shows its on-screen keyboard (and only avoids the auto-zoom-on-focus
 * behavior) for genuine form fields with a >=16px font-size, which a canvas-drawn
 * text box can't provide.
 */
export function openNameEntry(options: NameEntryOptions): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'rift-modal-backdrop';

  const panel = document.createElement('div');
  panel.className = 'rift-modal-panel';

  const title = document.createElement('h2');
  title.className = 'rift-modal-title';
  title.textContent = options.title;

  const input = document.createElement('input');
  input.className = 'rift-modal-input';
  input.type = 'text';
  input.maxLength = MAX_NAME_LENGTH;
  input.value = options.initialValue ?? '';
  input.placeholder = options.placeholder ?? 'Explorer name';
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  input.spellcheck = false;
  input.setAttribute('enterkeyhint', 'done');

  const error = document.createElement('p');
  error.className = 'rift-modal-error';
  error.textContent = 'Name cannot be empty.';
  error.style.visibility = 'hidden';

  const actions = document.createElement('div');
  actions.className = 'rift-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'rift-modal-btn';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'rift-modal-btn rift-modal-btn-primary';
  confirmBtn.textContent = options.confirmLabel ?? 'Save';

  actions.append(cancelBtn, confirmBtn);
  panel.append(title, input, error, actions);
  backdrop.append(panel);
  document.body.append(backdrop);

  const updateValidity = () => {
    const valid = isValidName(input.value);
    confirmBtn.disabled = !valid;
    error.style.visibility = valid || input.value.length === 0 ? 'hidden' : 'visible';
  };
  updateValidity();

  const reposition = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    backdrop.style.height = `${vv.height}px`;
    backdrop.style.top = `${vv.offsetTop}px`;
    backdrop.style.left = `${vv.offsetLeft}px`;
  };
  reposition();

  const close = () => {
    window.visualViewport?.removeEventListener('resize', reposition);
    window.visualViewport?.removeEventListener('scroll', reposition);
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
  };

  const confirm = () => {
    if (!isValidName(input.value)) return;
    const name = sanitizeName(input.value);
    close();
    options.onConfirm(name);
  };

  const cancel = () => {
    close();
    options.onCancel?.();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') confirm();
    else if (e.key === 'Escape') cancel();
  };

  input.addEventListener('input', updateValidity);
  confirmBtn.addEventListener('click', confirm);
  cancelBtn.addEventListener('click', cancel);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) cancel();
  });
  document.addEventListener('keydown', onKeydown);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);

  input.focus();
  input.select();
}
