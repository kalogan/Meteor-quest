/**
 * Content lint (gate step). Validates every authored content pack against the
 * product schema, including referential integrity. Exits non-zero on any failure
 * so the gate catches malformed content before it reaches the renderer.
 */
import { parseContentPack } from "../schema.js";
import coreRaw from "./core.json" with { type: "json" };

const packs: Array<readonly [string, unknown]> = [["core.json", coreRaw]];

let failures = 0;
for (const [name, raw] of packs) {
  try {
    const pack = parseContentPack(raw);
    console.log(
      `[content-lint] OK ${name}: ${pack.biomes.length} biomes, ${pack.resources.length} resources, ${pack.tech.length} tech`,
    );
  } catch (err) {
    failures++;
    console.error(`[content-lint] FAIL ${name}:`, err instanceof Error ? err.message : err);
  }
}

if (failures > 0) {
  console.error(`[content-lint] ${failures} pack(s) failed`);
  process.exit(1);
}
console.log("[content-lint] all packs valid");
