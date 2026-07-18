/**
 * Web Audio plumbing: one context, one master gain, gesture unlock, mute.
 * Browsers create AudioContexts suspended until a user gesture — installUnlock
 * resumes on the first pointer/key input and on returning to a hidden tab.
 */

const MASTER_LEVEL = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function audioCtx(): AudioContext {
  if (!ctx) {
    if (typeof AudioContext === "undefined") {
      throw new Error("Web Audio API unavailable in this browser");
    }
    ctx = new AudioContext();
  }
  return ctx;
}

/** All game sound routes through this single gain before the speakers. */
export function masterGain(): GainNode {
  if (!master) {
    const c = audioCtx();
    master = c.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(c.destination);
  }
  return master;
}

export function setMuted(m: boolean): void {
  muted = m;
  const g = masterGain();
  const t = audioCtx().currentTime;
  // Short ramp instead of a hard cut — avoids the click of a step discontinuity.
  g.gain.cancelScheduledValues(t);
  g.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, t, 0.01);
}

export function isMuted(): boolean {
  return muted;
}

export function installUnlock(): void {
  const resume = () => {
    const c = audioCtx();
    if (c.state === "suspended") void c.resume();
  };
  const once = () => {
    resume();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
}
