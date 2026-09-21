# fintech-algorithms integration

Status: dependency and lookup tooling ready; application adapter planned. Exact baseline: 0.13.1.

## API discovery before implementation

Read the installed skill under node_modules/fintech-algorithms/skills/fintech-algorithms. Run npm run algorithms:lookup -- show TOPIC_ID for each required method. Read its input contract, import, exported entry, captured output, warm-up behavior, errors, and verification tier. Check declarations and exports when prose disagrees.

The package root exposes registry helpers rather than all algorithm functions. Use verified subpath imports. Application results may wrap library fields, but the adapter must explicitly map and test those fields.

## Integration record per algorithm

Record topic ID, exact package version, export subpath and function, input shape, units, as-of semantics, null/warm-up handling, returned keys, verification tier, test oracle, and limitations. Add this record in the chapter that introduces the call. Do not copy every library function into this project.

The [capability inventory](../references/dependency-capabilities.json) records the installed baseline and domain counts. It is an inventory, not evidence that Portfolio Atlas has implemented those capabilities.

## Existing material versus runnable exports

Catalog topics, canonical articles, installed npm functions, and Portfolio Atlas features have separate states. A chapter can teach a planned catalog topic without pretending an npm import exists. Application-specific ledger, workflow, and reporting behavior may need implementation here from explicitly researched definitions.

D14 remains gated by [ADR 0003](../decisions/0003-d14-release-gate.md). Do not import local private D14 source or guess future package paths.

## Numerical evidence

Verified in package metadata denotes replay against shared expected fixtures, frequently paired Python/TypeScript implementations. It does not establish independent external validation or investment usefulness. Contract denotes shape/API checking without that arithmetic assertion. The application adds its own independent examples for quantities that affect cash, positions, NAV, returns, or decisions.

Use D00 foundations for relevant existing calculations after contract lookup. Some functions require family-wide fields; a conceptually simple input is not automatically the accepted API shape.

## Known documentation drift at this baseline

The installed 0.13.1 docs payload contains 697 topics. The lookup script's no-match text still says 324, and some skill verification totals still describe an earlier release. Do not treat these static sentences as inventory. Read installed docs.json and the domain counts. No upstream package files are patched by this project.

The public guide's generic Bar illustration is not a substitute for a particular topic's installed input shape. The OHLC validator accepts row provenance including bar_id/source/symbol, and returns one verdict per row. See the Yahoo adapter contract.

## Upgrade gate

Pin the dependency and lockfile. Recheck imports, outputs, warm-up, invalid-input behavior, and a representative existing fixture before adopting a release. Record evidence and commit dependency changes separately from new chapter logic. Website docs alone are insufficient when they describe an unreleased surface.
