// Generates the runtime CSS variables from the Open Core 03.1 token registry.
// The registry is the single source of truth: never edit tokens.css by hand.
// Usage: node apps/web/scripts/design-tokens.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const directory = fileURLToPath(new URL("../src/design-system/", import.meta.url));
const tokens = JSON.parse(readFileSync(directory + "tokens.json", "utf8"));
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
const block = (selector, entries) =>
  selector + " {\n" + entries.map(([name, value]) => `  --${name}: ${value};`).join("\n") + "\n}\n";
const theme = (name) =>
  Object.entries(tokens.themes[name]).map(([key, value]) => [kebab(key), value]);

const constants = [
  ...Object.entries(tokens.colors).map(([key, value]) => ["brand-" + kebab(key), value]),
  ...tokens.space.map((value, index) => ["space-" + (index + 1), value + "px"]),
  ...Object.entries(tokens.type).map(([key, value]) => ["type-" + kebab(key), value + "px"]),
  ...Object.entries(tokens.motion).map(([key, value]) => ["motion-" + key, value + "ms"]),
  ["density-gap", tokens.density.standard.gap + "px"],
  ["density-padding", tokens.density.standard.padding + "px"],
];
const density = (name) => [
  ["density-gap", tokens.density[name].gap + "px"],
  ["density-padding", tokens.density[name].padding + "px"],
];

const css =
  "/* Generated from tokens.json by apps/web/scripts/design-tokens.mjs. Do not edit. */\n" +
  `/* ${tokens.source.system} · ${tokens.source.registryEdition} (${tokens.source.editionDate}) */\n` +
  block(":root", [...constants, ...theme("light"), ["color-scheme", "light"]]) +
  "@media (prefers-color-scheme: dark) {\n" +
  block(':root:not([data-theme="light"])', [...theme("dark"), ["color-scheme", "dark"]])
    .split("\n")
    .map((line) => (line ? "  " + line : line))
    .join("\n") +
  "}\n" +
  block(':root[data-theme="dark"]', [...theme("dark"), ["color-scheme", "dark"]]) +
  block(':root[data-density="compact"]', density("compact")) +
  block(':root[data-density="feature"]', density("feature"));

// color-scheme is a real property, not a custom property.
const output = await format(css.replace(/--color-scheme: (\w+);/g, "color-scheme: $1;"), {
  parser: "css",
});
const target = directory + "tokens.css";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) {
    console.error("tokens.css is out of date. Run npm run design:tokens.");
    process.exit(1);
  }
  console.log("Design tokens match tokens.json.");
} else {
  writeFileSync(target, output);
  console.log("Wrote " + target);
}
