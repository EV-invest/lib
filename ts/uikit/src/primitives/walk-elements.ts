import * as React from "react";

export type ElementWithChildren = React.ReactElement<{ children?: unknown }>;

/**
 * Visits the elements of a children tree, looking through arrays and
 * fragments; `visit` returns whether to descend into that element's children.
 *
 * Only elements, arrays and fragments are walked. `children` is whatever the
 * caller passed — a render function, or a plain object an i18n component
 * interpolates (`{ count }` under Trans) — and `React.Children` throws on an
 * object, so anything else is skipped rather than handed to it.
 */
export function walkElements(node: unknown, visit: (element: ElementWithChildren) => boolean): void {
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, visit);
    return;
  }
  if (!React.isValidElement<{ children?: unknown }>(node)) return;
  if (node.type === React.Fragment || visit(node)) walkElements(node.props.children, visit);
}
