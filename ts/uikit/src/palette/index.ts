// `@evinvest/uikit/palette`: build-time only (Node, no React, no DOM). Brand
// palettes as data, validated against the contract the kit's own sheet declares.
export { readContract, readRules, DERIVED_SCOPE, type Contract, type CssRule } from "./contract";
export {
  brandFromToml,
  renderPalette,
  validateBrand,
  PaletteError,
  POLARITIES,
  FONT_ROLES,
  type BrandConfig,
  type FontRole,
  type PolarityName,
} from "./brand";
export { parseToml, type TomlTable, type TomlValue } from "./toml";
