/**
 * Where the focus goes after an answer: the next field the visitor has not
 * filled — a radio group with nothing checked takes it at its first radio, a
 * typed field when empty. Read from the DOM, in document order, so a brand's
 * extras take their turn too; a field on a screen that is off (another step) is
 * not there to be filled.
 */
const FIELDS = "[data-lead-field]";

function empty(el: HTMLInputElement, form: HTMLFormElement): boolean {
  if (el.type === "radio") return !form.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`);
  if (el.type === "checkbox") return !el.checked;
  return el.value.trim() === "";
}

/** `LeadSteps`' mark of a screen that is off (`STEP_OFF`), and the attribute. */
export const OFF_SELECTOR = "[data-lead-off], [hidden]";
const shown = (el: Element) => el.closest(OFF_SELECTOR) === null;

/** The fields of `scope` in document order, a radio group once — at its checked radio, else its first. */
function fields(scope: ParentNode, hiddenToo = false): HTMLInputElement[] {
  const seen = new Set<string>();
  const out: HTMLInputElement[] = [];
  for (const el of scope.querySelectorAll<HTMLInputElement>(FIELDS)) {
    if (!(el instanceof HTMLInputElement) || el.disabled || el.type === "hidden" || (!hiddenToo && !shown(el))) continue;
    if (el.type === "radio") {
      if (seen.has(el.name)) continue;
      seen.add(el.name);
      out.push(el.form?.querySelector<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`) ?? el);
      continue;
    }
    out.push(el);
  }
  return out;
}

/**
 * The next empty field of `form` after `from` (from the top without one), or
 * `null`. `hiddenToo`: on a screen not shown yet, too — the next screen's.
 */
export function nextEmpty(form: HTMLFormElement, from: Element | null, hiddenToo = false): HTMLInputElement | null {
  const after = (el: Element) => from === null || (from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  return fields(form, hiddenToo).find(el => after(el) && !from?.contains(el) && empty(el, form)) ?? null;
}

/** Focuses the next empty field after `from`; `true` when there was one. */
export function focusNext(form: HTMLFormElement | null | undefined, from: Element | null): boolean {
  const next = form ? nextEmpty(form, from) : null;
  next?.focus();
  return next !== null;
}

/** Focuses a step's first empty field, else its first field: what the screen asks. */
export function focusStep(step: Element | null | undefined): void {
  const form = step?.closest("form");
  if (!step || !form) return;
  const all = fields(step);
  (all.find(el => empty(el, form)) ?? all[0])?.focus();
}
