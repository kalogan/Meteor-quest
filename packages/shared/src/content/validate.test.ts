import { describe, expect, it } from "vitest";
import { parseContentPack, type ContentPack } from "../schema.js";
import coreRaw from "./core.json" with { type: "json" };

/**
 * Referential-integrity tests for parseContentPack. The core pack must pass; a set
 * of deliberately-broken clones must each throw the specific guard. Recorded:
 *   1 happy-path coherence test + 6 negative guard tests = 7 cases here.
 */

/** Deep clone of the core pack as plain data, so mutations don't bleed across tests. */
function rawClone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(coreRaw));
}

describe("parseContentPack referential integrity", () => {
  it("accepts the live core pack and records its shape", () => {
    const pack: ContentPack = parseContentPack(coreRaw);
    expect(pack.biomes).toHaveLength(4);
    expect(pack.resources).toHaveLength(9);
    expect(pack.tech).toHaveLength(16);
    // Every requiredResource is some biome's uniqueResource.
    const unique = new Set(pack.biomes.map((b) => b.uniqueResource));
    for (const t of pack.tech) {
      if (t.requiredResource) expect(unique.has(t.requiredResource)).toBe(true);
    }
  });

  type RawTech = { id: string; prereqs?: string[]; requiredResource?: string };
  type RawBiome = { id: string; uniqueResource?: string };
  const techOf = (raw: Record<string, unknown>, id: string): RawTech => {
    const found = (raw.tech as RawTech[]).find((t) => t.id === id);
    if (!found) throw new Error(`test setup: tech ${id} missing`);
    return found;
  };

  it("rejects an unknown prereq", () => {
    const raw = rawClone();
    techOf(raw, "refining").prereqs = ["ghost_tech"];
    expect(() => parseContentPack(raw)).toThrow(/unknown prereq/);
  });

  it("rejects a requiredResource that is not any biome's uniqueResource", () => {
    const raw = rawClone();
    // `minerals` is a real resource but not a biome unique → cannot gate settlement.
    techOf(raw, "fusion").requiredResource = "minerals";
    expect(() => parseContentPack(raw)).toThrow(/not any biome's uniqueResource/);
  });

  it("rejects an orphan tech (unreachable from any no-prereq root)", () => {
    const raw = rawClone();
    // Make basic_industry depend on a leaf → its whole subtree becomes a cycle/island.
    techOf(raw, "basic_industry").prereqs = ["warp_basics"];
    expect(() => parseContentPack(raw)).toThrow(/unreachable|no root tech/);
  });

  it("rejects a pack with no root tech", () => {
    const raw = rawClone();
    for (const t of raw.tech as RawTech[]) {
      t.prereqs = t.prereqs && t.prereqs.length ? t.prereqs : ["basic_industry"];
    }
    // basic_industry now points back into the graph → no node has zero prereqs.
    techOf(raw, "basic_industry").prereqs = ["refining"];
    expect(() => parseContentPack(raw)).toThrow(/no root tech|unreachable/);
  });

  it("rejects an unknown biome uniqueResource", () => {
    const raw = rawClone();
    (raw.biomes as RawBiome[])[0]!.uniqueResource = "minerals";
    // ice's unique becomes minerals, so fusion's requiredResource=cryocrystal is no
    // longer any biome's unique → settlement-gate guard fires.
    expect(() => parseContentPack(raw)).toThrow(/not any biome's uniqueResource/);
  });

  it("rejects a cyclic prereq pair", () => {
    const raw = rawClone();
    techOf(raw, "rocketry").prereqs = ["deep_sensors"];
    techOf(raw, "deep_sensors").prereqs = ["rocketry"];
    expect(() => parseContentPack(raw)).toThrow(/unreachable/);
  });
});
