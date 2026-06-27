/**
 * [tech props] The contract every procedural tech-prop component implements. A prop is
 * a small low-poly STRUCTURE that appears on a settled world once its tech is unlocked
 * (see content's TechNode.prop / PROP_KINDS). The placement layer (TechPropsLayer) owns
 * WHERE a prop sits and HOW BIG it is — it wraps each component in a positioned, scaled
 * <group> — so a component only authors its own geometry in its LOCAL frame.
 *
 * Local-frame conventions (so the layer can place any prop uniformly):
 *  - GROUND props stand on the XZ plane with their BASE at y=0, growing up +Y. Keep the
 *    footprint within roughly a unit circle (radius ~1) and the height within ~1.4. The
 *    layer plants them on the planet surface and orients +Y along the surface normal.
 *  - ORBIT props are CENTERED on the origin and read from any angle (they ride an orbital
 *    ring and slowly turn). Keep them within roughly a unit sphere (radius ~1).
 *
 * Cosmetic only: a prop reads NO sim state and mutates nothing. Any motion is local
 * useFrame work over its own refs and MUST hold static when `reducedMotion` is set
 * (mirrors Ship/MiningProbe), so the structure still reads without animation.
 */
export interface PropProps {
  /**
   * A biome-derived accent colour. Use it for ONE emissive/glow accent (a light strip,
   * a core glow, a panel tint) — NOT the whole structure — so each prop keeps its own
   * distinct metal silhouette while picking up the host world's colour identity.
   */
  tint: string;
  /** Hold all animation static (accessibility). Authored fully-deployed when set. */
  reducedMotion: boolean;
}
