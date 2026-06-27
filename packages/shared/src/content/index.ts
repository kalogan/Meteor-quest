import type { ContentPack } from "../schema.js";
import { parseContentPack } from "../schema.js";
import coreRaw from "./core.json" with { type: "json" };

/**
 * THE SEAM (shared half). Both production (sim-core) and the preview harness load
 * content through this single validated entry point — same bytes, same schema,
 * same parse. Nothing reinterprets content differently "for preview".
 *
 * The pack is authored as JSON data; new biomes/resources/tech appear here just by
 * editing the data, with no code change required.
 */
export const corePack: ContentPack = parseContentPack(coreRaw);

export function getContentPack(id = "core"): ContentPack {
  if (id !== "core") throw new Error(`unknown content pack: ${id}`);
  return corePack;
}
