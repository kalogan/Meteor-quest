import { describe, expect, it } from "vitest";
import { buildFixture } from "./generate-fixture.js";
import golden from "./core.golden.json" with { type: "json" };

/**
 * Golden snapshot guard. `core.golden.json` is the committed, resolved (parsed +
 * schema-defaulted) form of the core pack. If the live parse diverges from it, a
 * content change happened — review the diff, then regenerate deliberately:
 *
 *   pnpm --filter @meteor/shared exec tsx src/content/fixtures/generate-fixture.ts
 *
 * This makes otherwise-silent content edits loud.
 */
describe("core content golden fixture", () => {
  it("live parse matches the committed golden snapshot", () => {
    // JSON round-trip normalizes (drops undefined, matches the on-disk shape).
    const live = JSON.parse(JSON.stringify(buildFixture()));
    expect(live).toEqual(golden);
  });

  it("golden snapshot has the recorded shape (4 biomes / 9 resources / 16 tech)", () => {
    expect(golden.biomes).toHaveLength(4);
    expect(golden.resources).toHaveLength(9);
    expect(golden.tech).toHaveLength(16);
  });
});
