import { h } from './dom';

export interface InlineEditOptions {
  value: string;
  /** Accessible name of the text field. */
  label: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  /** Grow the field with its text (for short labels such as tab names). */
  autoSize?: boolean;
  /** Called with the trimmed text on Enter or when the field loses focus. */
  onCommit(value: string): void;
  /** Called on Escape; the original element is already back in place. */
  onCancel?(): void;
}

/**
 * Swaps `target` for a text field holding `value`. Enter or leaving the field
 * saves, Escape cancels; either way `target` is put back before the callback
 * runs (the caller usually re-renders on save).
 */
export function startInlineEdit(target: HTMLElement, options: InlineEditOptions): HTMLInputElement {
  const input = h('input', {
    type: 'text',
    class: `inline-edit ${options.className ?? ''}`.trim(),
    value: options.value,
    'aria-label': options.label,
    placeholder: options.placeholder,
    maxlength: options.maxLength ?? 80,
    autocomplete: 'off',
    spellcheck: false,
  });
  if (options.autoSize) {
    const fit = () => (input.size = Math.max(8, input.value.length + 1));
    fit();
    input.addEventListener('input', fit);
  }
  let done = false;
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    if (input.isConnected) input.replaceWith(target);
    if (save) {
      options.onCommit(input.value.trim());
    } else {
      target.focus();
      options.onCancel?.();
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  // Keep clicks inside the field from reaching handlers on the parent.
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
  target.replaceWith(input);
  input.focus();
  input.select();
  return input;
}
