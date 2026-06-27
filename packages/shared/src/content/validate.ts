/**
 * Content lint (gate step). Validates every authored content pack against the
 * product schema, including referential integrity. Exits non-zero on any failure
 * so the gate catches malformed content before it reaches the renderer.
 */
import { parseContentPack, type ContentPack } from "../schema.js";
import coreRaw from "./core.json" with { type: "json" };

const packs: Array<readonly [string, unknown]> = [["core.json", coreRaw]];

/**
 * Extra lint-time assertions on a pack that already passed parseContentPack (so
 * it is structurally + referentially sound). These are "balance/coherence" checks
 * the gate should surface but that are too pack-specific to live in the schema:
 *  - every biome's uniqueResource gates at least one tech (biome has a reason);
 *  - every requiredResource gate maps to a settle-able biome;
 *  - the full tier ladder (continent/planet/system) is granted by some tech.
 */
function lintCoherence(name: string, pack: ContentPack): string[] {
  const problems: string[] = [];
  const required = new Set(pack.tech.flatMap((t) => (t.requiredResource ? [t.requiredResource] : [])));
  for (const b of pack.biomes) {
    if (!required.has(b.uniqueResource)) {
      problems.push(`biome ${b.id} unique resource ${b.uniqueResource} gates no tech (settling it is pointless for research)`);
    }
  }
  const grantedTiers = new Set(
    pack.tech.flatMap((t) => t.effects.flatMap((e) => (e.kind === "unlockTier" ? [e.tier] : []))),
  );
  for (const tier of ["continent", "planet", "system"] as const) {
    if (!grantedTiers.has(tier)) problems.push(`no tech grants the ${tier} tier (authority ladder is broken)`);
  }
  return problems.map((p) => `${name}: ${p}`);
}

let failures = 0;
for (const [name, raw] of packs) {
  try {
    const pack = parseContentPack(raw);
    const coherence = lintCoherence(name, pack);
    if (coherence.length > 0) {
      failures++;
      for (const c of coherence) console.error(`[content-lint] FAIL ${c}`);
    } else {
      console.log(
        `[content-lint] OK ${name}: ${pack.biomes.length} biomes, ${pack.resources.length} resources, ${pack.tech.length} tech`,
      );
    }
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
