/**
 * Golden fixture generator. Serializes the parsed/resolved core pack to a stable
 * JSON snapshot so a silent content change is caught by `core.golden.json` test.
 *
 * Regenerate (run from packages/shared) after an INTENTIONAL content change:
 *   pnpm --filter @meteor/shared exec tsx src/content/fixtures/generate-fixture.ts
 *
 * The test (`fixtures.test.ts`) fails until the fixture is regenerated, which is
 * the point: review the diff, regenerate deliberately, commit it.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseContentPack } from "../../schema.js";
import coreRaw from "../core.json" with { type: "json" };

/** Deterministic, schema-defaulted snapshot of the parsed pack (defaults applied). */
export function buildFixture(): unknown {
  return parseContentPack(coreRaw);
}

/** Write the fixture to disk. Only runs when invoked as a script (not on import). */
function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "core.golden.json");
  writeFileSync(out, JSON.stringify(buildFixture(), null, 2) + "\n", "utf8");
  console.log(`[fixture] wrote ${out}`);
}

// Run the writer only when executed directly (tsx src/.../generate-fixture.ts),
// not when imported by the test for `buildFixture`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
