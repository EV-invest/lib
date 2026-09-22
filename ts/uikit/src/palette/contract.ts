/**
 * The colour contract, read out of the kit's own token sheet rather than
 * restated here: `@theme inline` maps every name the class tables can paint
 * (`--color-X: var(--X)`), and the derived rule lists the ones the contract
 * computes from the rest. A palette owes the difference.
 */
export interface Contract {
  /** Names every palette scope must declare. */
  required: readonly string[];
  /** Names the contract derives from the palette; a palette may override them. */
  derived: readonly string[];
  /** The tokens each derived default reads, so a palette's references can be checked for cycles through them. */
  derivedFrom: Readonly<Record<string, readonly string[]>>;
}

/** The `--name`s a value reads through `var()`. */
export function references(value: string): string[] {
  return [...value.matchAll(/var\(--([A-Za-z0-9-]+)/g)].flatMap((m) => (m[1] ? [m[1]] : []));
}

/** The rule the derived tokens live on — see `theme.css`, the contract half of `tokens.css`. */
export const DERIVED_SCOPE = ":where(:root, .dark, .light, [data-brand])";

export interface CssRule {
  selector: string;
  /** Custom properties declared directly in the rule, in source order. */
  declarations: Map<string, string>;
}

/**
 * Top-level and `@media`-nested rules of a flat sheet, comments stripped. Only
 * as much CSS as a token sheet is made of: no strings containing braces.
 */
export function readRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "{") {
      stack.push(src.slice(start, i).trim());
      start = i + 1;
    } else if (c === "}") {
      const selector = stack.pop();
      if (selector === undefined) throw new Error("unbalanced `}` in token sheet");
      const body = src.slice(start, i);
      if (!body.includes("{")) rules.push({ selector: normalise(selector), declarations: declarations(body) });
      start = i + 1;
    } else if (c === ";" && stack.length === 0) {
      start = i + 1;
    }
  }
  if (stack.length > 0) throw new Error("unbalanced `{` in token sheet");
  return rules;
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of body.split(";")) {
    const match = /^\s*--([A-Za-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/.exec(decl);
    if (match?.[1] && match[2]) out.set(match[1], match[2]);
  }
  return out;
}

export function normalise(selector: string): string {
  return selector.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

export function readContract(css: string): Contract {
  const rules = readRules(css);
  const theme = rules.find((r) => r.selector === "@theme inline");
  if (!theme) throw new Error("token sheet has no `@theme inline` block — not the kit's contract");
  const painted: string[] = [];
  for (const [name, value] of theme.declarations) {
    const match = /^color-(.+)$/.exec(name);
    if (match?.[1] && value === `var(--${match[1]})`) painted.push(match[1]);
  }
  const derivedRule = rules.find((r) => r.selector === DERIVED_SCOPE);
  if (!derivedRule) throw new Error(`token sheet has no \`${DERIVED_SCOPE}\` rule — not the kit's contract`);
  const derived = [...derivedRule.declarations.keys()];
  const stray = derived.filter((d) => !painted.includes(d));
  if (stray.length > 0) throw new Error(`derived tokens with no @theme mapping: ${stray.join(", ")}`);
  const derivedFrom = Object.fromEntries([...derivedRule.declarations].map(([name, value]) => [name, references(value)]));
  return { required: painted.filter((p) => !derived.includes(p)), derived, derivedFrom };
}
