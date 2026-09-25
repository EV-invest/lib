// Shared by check-template.mjs and the template-version guard in `npm test`,
// so both hold the template to the same reading of a range.

/** The slice of semver ranges these manifests use: `^x.y.z`, `>=`, `<`, AND by space, `||`, `*`. */
export function satisfies(version, range) {
  const v = version.split(".").map(Number);
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const one = term => {
    if (term === "*" || term === "") return true;
    const m = /^(\^|>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(term);
    if (!m) throw new Error(`unsupported range term ${term}`);
    const b = [Number(m[2]), Number(m[3] ?? 0), Number(m[4] ?? 0)];
    const c = cmp(v, b);
    switch (m[1]) {
      case "^": {
        if (c < 0) return false;
        const upper = b[0] > 0 ? [b[0] + 1, 0, 0] : b[1] > 0 ? [0, b[1] + 1, 0] : [0, 0, b[2] + 1];
        return cmp(v, upper) < 0;
      }
      case ">=": return c >= 0;
      case "<=": return c <= 0;
      case ">": return c > 0;
      case "<": return c < 0;
      default: return c === 0;
    }
  };
  return range.split("||").some(alt => alt.trim().split(/\s+/).every(one));
}
