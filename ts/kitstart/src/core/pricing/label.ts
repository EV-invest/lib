import type { PricingLabels } from "./model";

/**
 * The label for `locale`, or the first one the model has. Apart from the
 * validator: the form names its answers with it in the browser, where the
 * validator's weight has no use.
 */
export function labelOf(labels: PricingLabels, locale: string): string {
  return (Object.hasOwn(labels, locale) ? labels[locale] : undefined) ?? Object.values(labels)[0] ?? "";
}
