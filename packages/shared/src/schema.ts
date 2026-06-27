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

/** [slice 2] Procedural galaxy generation parameters (content-tunable; sim-core
 * falls back to defaults if absent). */
export const GalaxyConfigSchema = z.object({
  /** How many star systems the galaxy contains (incl. home). */
  systemCount: z.number().int().min(2),
  /** Galaxy-space radius the systems are scattered within. */
  radius: z.number().positive(),
  /** Minimum separation between any two systems (avoids overlap). */
  minSeparation: z.number().positive(),
});
export type GalaxyConfig = z.infer<typeof GalaxyConfigSchema>;

/** [slice 2] Tactical-defense economy (content-tunable; sim-core has defaults). */
export const DefenseConfigSchema = z.object({
  /** Resource cost paid per buildDefense action. */
  buildCost: z.record(ResourceIdSchema, z.number().positive()),
  /** Defensive strength gained per buildDefense action. */
  defensePerBuild: z.number().positive(),
});
export type DefenseConfig = z.infer<typeof DefenseConfigSchema>;

/**
 * [objectives] A completion condition, evaluated against GameState each tick by the
 * sim. Leaf conditions + a one-level `all` (AND) for compound goals like the victory.
 */
const LEAF_CONDITIONS = [
  z.object({ kind: z.literal("orbitalLaunched") }),
  z.object({ kind: z.literal("researchStarted") }),
  z.object({ kind: z.literal("tier"), tier: TierIdSchema }), // authorityTier >= tier
  z.object({ kind: z.literal("tech"), techId: z.string().min(1) }), // tech unlocked
  z.object({ kind: z.literal("settledCount"), count: z.number().int().positive() }),
  z.object({ kind: z.literal("settledInSystems"), count: z.number().int().positive() }),
  z.object({ kind: z.literal("discoveredSystems"), count: z.number().int().positive() }),
  z.object({ kind: z.literal("scannedCount"), count: z.number().int().positive() }),
  z.object({ kind: z.literal("resource"), resource: ResourceIdSchema, amount: z.number().positive() }),
] as const;

export const ObjectiveConditionSchema = z.discriminatedUnion("kind", [
  ...LEAF_CONDITIONS,
  z.object({ kind: z.literal("all"), of: z.array(z.discriminatedUnion("kind", LEAF_CONDITIONS)).min(1) }),
]);
export type ObjectiveCondition = z.infer<typeof ObjectiveConditionSchema>;

/** [objectives] A guided goal — early ones onboard (teach a mechanic), later ones set
 * the meta-goals; exactly the `victory` one wins the game when complete. */
export const ObjectiveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  condition: ObjectiveConditionSchema,
  victory: z.boolean().optional(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

export const ContentPackSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  biomes: z.array(BiomeSchema).min(1),
  resources: z.array(ResourceSchema).min(1),
  tech: z.array(TechNodeSchema).min(1),
  /** [slice 2] optional; sim-core defaults apply when omitted. */
  galaxy: GalaxyConfigSchema.optional(),
  defense: DefenseConfigSchema.optional(),
  /** [objectives] optional guided-goal chain; sim defaults to none when omitted. */
  objectives: z.array(ObjectiveSchema).optional(),
});
export type ContentPack = z.infer<typeof ContentPackSchema>;

/** Parse + structural cross-checks (referential integrity the zod shape can't express). */
export function parseContentPack(raw: unknown): ContentPack {
  const pack = ContentPackSchema.parse(raw);
  const resourceIds = new Set(pack.resources.map((r) => r.id));
  const techIds = new Set(pack.tech.map((t) => t.id));
  const techCategories = new Set<string>(TECH_CATEGORIES);
  const uniqueResources = new Set(pack.biomes.map((b) => b.uniqueResource));

  for (const b of pack.biomes) {
    if (!resourceIds.has(b.uniqueResource)) {
      throw new Error(`biome ${b.id} references unknown resource ${b.uniqueResource}`);
    }
    // Spiff category must be a real TechCategory (zod enforces the enum; this guards
    // against drift if the schema is ever loosened, and keeps the message specific).
    if (!techCategories.has(b.spiff.category)) {
      throw new Error(`biome ${b.id} spiff references unknown tech category ${b.spiff.category}`);
    }
  }
  for (const t of pack.tech) {
    for (const p of t.prereqs) {
      if (!techIds.has(p)) throw new Error(`tech ${t.id} references unknown prereq ${p}`);
    }
    if (t.requiredResource && !resourceIds.has(t.requiredResource)) {
      throw new Error(`tech ${t.id} requires unknown resource ${t.requiredResource}`);
    }
    // A requiredResource is meant to FORCE settling a biome: it must be some biome's
    // unique resource, otherwise the gate could never (or always) be satisfied.
    if (t.requiredResource && !uniqueResources.has(t.requiredResource)) {
      throw new Error(
        `tech ${t.id} requires ${t.requiredResource}, which is not any biome's uniqueResource (cannot gate settlement)`,
      );
    }
  }

  // ── Reachability: no orphan tech ──────────────────────────────────────────
  // Every tech must be reachable, via prereq edges, from a no-prereq root. This
  // catches dependency cycles and islands that the player could never research.
  const roots = pack.tech.filter((t) => t.prereqs.length === 0).map((t) => t.id);
  if (roots.length === 0) {
    throw new Error("content pack has no root tech (every node has a prereq — nothing is researchable first)");
  }
  const reachable = new Set<string>(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of pack.tech) {
      if (reachable.has(t.id)) continue;
      if (t.prereqs.every((p) => reachable.has(p))) {
        reachable.add(t.id);
        grew = true;
      }
    }
  }
  for (const t of pack.tech) {
    if (!reachable.has(t.id)) {
      throw new Error(`tech ${t.id} is unreachable from any no-prereq root (orphan or part of a cycle)`);
    }
  }

  // ── Every unlockTier target tier is reachable ─────────────────────────────
  // A tier is "reachable" if some reachable tech grants it. (All tech are reachable
  // by the check above, so this asserts the tier is actually granted somewhere.)
  for (const t of pack.tech) {
    for (const eff of t.effects) {
      if (eff.kind === "unlockTier" && !reachable.has(t.id)) {
        throw new Error(`unlockTier(${eff.tier}) on ${t.id} is unreachable`);
      }
    }
  }

  // ── Objectives: referential integrity + winnability ───────────────────────
  if (pack.objectives && pack.objectives.length > 0) {
    const objIds = new Set<string>();
    const techRefOk = (c: ObjectiveCondition): void => {
      const checkLeaf = (leaf: ObjectiveCondition) => {
        if (leaf.kind === "tech" && !techIds.has(leaf.techId)) {
          throw new Error(`objective condition references unknown tech ${leaf.techId}`);
        }
      };
      if (c.kind === "all") c.of.forEach(checkLeaf);
      else checkLeaf(c);
    };
    for (const o of pack.objectives) {
      if (objIds.has(o.id)) throw new Error(`duplicate objective id ${o.id}`);
      objIds.add(o.id);
      techRefOk(o.condition);
    }
    if (!pack.objectives.some((o) => o.victory)) {
      throw new Error("objective chain has no `victory` objective (the game is unwinnable)");
    }
  }

  return pack;
}
