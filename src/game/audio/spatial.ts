/**
 * Spatialization: pan by horizontal offset, attenuate AND muffle by distance.
 * Per the design doc, distance closes a lowpass filter instead of only
 * dropping volume — far sounds get duller, not just quieter.
 *
 * The math is pure (testable in node); constants are in logical game pixels.
 * This module deliberately avoids importing display/textures — those touch
 * window/Phaser at import time.
 */

import { masterGain } from "./context";
import type { AmbienceHandle } from "./ambience";
import type { SfxOpts } from "./sfx";

export interface Vec2 {
  x: number;
  y: number;
}

/** Half the logical 960px view: a source one half-screen away pans fully. */
const PAN_HALF_PX = 480;
/** Within this range a sound is at full presence (3 tiles at TILE=32). */
const FULL_PX = 96;
/** Beyond this it stays at the floor (20 tiles). */
const MAX_PX = 640;
const GAIN_FLOOR = 0.15;
const CUTOFF_NEAR = 18000;
const CUTOFF_FAR = 800;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 0 at full presence, 1 at (and beyond) max range. */
export function distanceTaper(distPx: number): number {
  return clamp((distPx - FULL_PX) / (MAX_PX - FULL_PX), 0, 1);
}

export function panFor(dx: number): number {
  return clamp(dx / PAN_HALF_PX, -1, 1) * 0.8;
}

export function gainFor(taper: number): number {
  return 1 - taper * (1 - GAIN_FLOOR);
}

/** Exponential sweep from bright to muffled — perceptually even. */
export function cutoffFor(taper: number): number {
  return CUTOFF_NEAR * Math.pow(CUTOFF_FAR / CUTOFF_NEAR, taper);
}

/** SfxOpts for a one-shot at `source` heard from `listener` (sampled at fire time). */
export function spatialOpts(source: Vec2, listener: Vec2): SfxOpts {
  const dx = source.x - listener.x;
  const taper = distanceTaper(Math.hypot(dx, source.y - listener.y));
  return {
    gain: gainFor(taper),
    pan: panFor(dx),
    cutoff: taper === 0 ? undefined : cutoffFor(taper),
  };
}

/**
 * A persistent positional sound: re-routes an ambience bed through a
 * lowpass → distance-gain → panner chain and tracks a moving listener.
 * Owns the bed — destroy() tears down both.
 */
export class SpatialEmitter {
  private readonly filter: BiquadFilterNode;
  private readonly distGain: GainNode;
  private readonly panner: StereoPannerNode;

  constructor(
    private readonly bed: AmbienceHandle,
    private readonly pos: Vec2,
  ) {
    const c = bed.gain.context as AudioContext;
    this.filter = c.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = CUTOFF_NEAR;
    this.distGain = c.createGain();
    this.panner = c.createStereoPanner();
    bed.gain.disconnect();
    bed.gain.connect(this.filter);
    this.filter.connect(this.distGain).connect(this.panner).connect(masterGain());
  }

  /** Called per frame (or per listener move); smooths over ~80 ms. */
  setListener(listener: Vec2): void {
    const c = this.bed.gain.context;
    const t = c.currentTime;
    const dx = this.pos.x - listener.x;
    const taper = distanceTaper(Math.hypot(dx, this.pos.y - listener.y));
    this.filter.frequency.setTargetAtTime(cutoffFor(taper), t, 0.08);
    this.distGain.gain.setTargetAtTime(gainFor(taper), t, 0.08);
    this.panner.pan.setTargetAtTime(panFor(dx), t, 0.08);
  }

  destroy(): void {
    this.bed.destroy();
    // The bed ramps out over its fade; free the chain after it lands.
    window.setTimeout(() => {
      this.filter.disconnect();
      this.distGain.disconnect();
      this.panner.disconnect();
    }, 800);
  }
}
