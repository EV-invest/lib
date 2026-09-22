import { Children, isValidElement, type ReactNode } from "react";

/**
 * One animatable unit of a headline. `space` records whether a real space
 * followed it in the source, so the rendered spans still wrap like prose
 * instead of running together.
 */
export type Token =
  | { kind: "word"; node: ReactNode; space: boolean }
  | { kind: "break" };

const isBreak = (node: ReactNode) => isValidElement(node) && node.type === "br";

/**
 * Split rich children into per-word tokens.
 *
 * Bare strings split on whitespace. **Elements are never split** — a styled
 * `<span>` is one token, because reaching inside it to split its text would
 * either drop its wrapper or duplicate it per word. In practice this is what
 * you want: the accent words in display headlines are single words already.
 * `<br />` becomes a break token so the line structure survives.
 */
export function tokenize(children: ReactNode): Token[] {
  const tokens: Token[] = [];

  for (const child of Children.toArray(children)) {
    if (isBreak(child)) {
      // A break absorbs the trailing space of the word before it, or the
      // rendered line would start with a stray gap.
      const last = tokens.at(-1);
      if (last?.kind === "word") last.space = false;
      tokens.push({ kind: "break" });
      continue;
    }

    if (typeof child === "string" || typeof child === "number") {
      // Capture the separators so a string that starts or ends with a space
      // (JSX puts them there deliberately) keeps it.
      for (const part of String(child).split(/(\s+)/)) {
        if (part === "") continue;
        if (/^\s+$/.test(part)) {
          const last = tokens.at(-1);
          if (last?.kind === "word") last.space = true;
          continue;
        }
        tokens.push({ kind: "word", node: part, space: false });
      }
      continue;
    }

    tokens.push({ kind: "word", node: child, space: false });
  }

  return tokens;
}

/**
 * The headline as one plain string, for the visually-hidden copy screen
 * readers announce. Recurses into elements so an accent `<span>`'s text is
 * not lost.
 */
export function flattenText(children: ReactNode): string {
  let out = "";

  for (const child of Children.toArray(children)) {
    if (isBreak(child)) {
      out += " ";
    } else if (typeof child === "string" || typeof child === "number") {
      out += String(child);
    } else if (isValidElement<{ children?: ReactNode }>(child)) {
      out += flattenText(child.props.children);
    }
  }

  return out.replace(/\s+/g, " ").trim();
}
