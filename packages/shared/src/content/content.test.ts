import { describe, expect, it } from "vitest";
import { corePack, getContentPack } from "./index.js";
import { BIOME_IDS } from "../ids.js";

describe("core content pack", () => {
  it("parses and has all four biomes", () => {
    expect(corePack.biomes.map((b) => b.id).sort()).toEqual([...BIOME_IDS].sort());
  });

  it("every biome's unique resource exists in the resource list", () => {
    const resources = new Set(corePack.resources.map((r) => r.id));
    for (const b of corePack.biomes) expect(resources.has(b.uniqueResource)).toBe(true);
  });

  it("every tech prereq resolves to a real tech", () => {
    const ids = new Set(corePack.tech.map((t) => t.id));
    for (const t of corePack.tech) for (const p of t.prereqs) expect(ids.has(p)).toBe(true);
  });

  it("getContentPack returns the core pack by default", () => {
    expect(getContentPack().id).toBe("core");
  });
});
