import { z } from "zod";
import { BIOME_IDS, RESOURCE_IDS, TECH_CATEGORIES, TIER_IDS } from "./ids.js";

/**
 * Content schemas — the SAME schema the product (sim-core) validates with and the
 * preview harness validates with. Authored content lives as JSON and is parsed
 * through these; nothing is reimplemented "for preview".
 */

export const ResourceIdSchema = z.enum(RESOURCE_IDS);
export const BiomeIdSchema = z.enum(BIOME_IDS);
export const TechCategorySchema = z.enum(TECH_CATEGORIES);
export const TierIdSchema = z.enum(TIER_IDS);

/** A biome's payoff: a unique resource it yields + a category spiff (multiplier). */
export const BiomeSchema = z.object({
  id: BiomeIdSchema,
  name: z.string().min(1),
  /** Hex tint used by the low-poly renderer for quick read. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  uniqueResource: ResourceIdSchema,
  spiff: z.object({
    category: TechCategorySchema,
    multiplier: z.number().gt(1),
  }),
});
export type Biome = z.infer<typeof BiomeSchema>;

export const ResourceSchema = z.object({
  id: ResourceIdSchema,
  name: z.string().min(1),
  /** "raw" is mined; "refined" is produced from a raw input; "abstract" = research/energy/fuel. */
  kind: z.enum(["raw", "refined", "abstract"]),
  /** For refined resources: which raw resource is consumed to make it. */
  refinedFrom: ResourceIdSchema.optional(),
});
export type Resource = z.infer<typeof ResourceSchema>;

/** What a researched tech node does to the game state. */
export const TechEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unlockRefining"), resource: ResourceIdSchema }),
  z.object({ kind: z.literal("productionMultiplier"), category: TechCategorySchema, factor: z.number().gt(0) }),
  z.object({ kind: z.literal("unlockTier"), tier: TierIdSchema }),
  z.object({ kind: z.literal("shipRange"), delta: z.number().gt(0) }),
  z.object({ kind: z.literal("sensorRange"), delta: z.number().gt(0) }),
  z.object({ kind: z.literal("orbitalLaunch") }),
]);
export type TechEffect = z.infer<typeof TechEffectSchema>;

export const TechNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: TechCategorySchema,
  /** Research-point cost. */
  cost: z.number().nonnegative(),
  /** Optional extra resource costs paid on completion. */
  resourceCost: z.record(ResourceIdSchema, z.number().positive()).optional(),
  /** Tech ids that must be unlocked first. */
  prereqs: z.array(z.string()).default([]),
  /** A biome-unique resource that must be AVAILABLE to research this (forces exploration). */
  requiredResource: ResourceIdSchema.optional(),
  effects: z.array(TechEffectSchema).default([]),
});
export type TechNode = z.infer<typeof TechNodeSchema>;

export const ContentPackSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  biomes: z.array(BiomeSchema).min(1),
  resources: z.array(ResourceSchema).min(1),
  tech: z.array(TechNodeSchema).min(1),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;

/** Parse + structural cross-checks (referential integrity the zod shape can't express). */
export function parseContentPack(raw: unknown): ContentPack {
  const pack = ContentPackSchema.parse(raw);
  const resourceIds = new Set(pack.resources.map((r) => r.id));
  const techIds = new Set(pack.tech.map((t) => t.id));
  for (const b of pack.biomes) {
    if (!resourceIds.has(b.uniqueResource)) {
      throw new Error(`biome ${b.id} references unknown resource ${b.uniqueResource}`);
    }
  }
  for (const t of pack.tech) {
    for (const p of t.prereqs) {
      if (!techIds.has(p)) throw new Error(`tech ${t.id} references unknown prereq ${p}`);
    }
    if (t.requiredResource && !resourceIds.has(t.requiredResource)) {
      throw new Error(`tech ${t.id} requires unknown resource ${t.requiredResource}`);
    }
  }
  return pack;
}
