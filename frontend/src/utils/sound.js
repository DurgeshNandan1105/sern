/**
 * SERN Web Audio System
 * Synthesizes zero-latency acoustic emergency warnings and dispatch confirmation chimes
 * using standard HTML5 AudioContext with resilient audio device safety boundaries.
 */

let sharedAudioCtx = null;
let audioDisabled = false;

function getSafeAudioContext() {
  if (audioDisabled) return null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      audioDisabled = true;
      return null;
    }
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
      if (typeof sharedAudioCtx.addEventListener === "function") {
        sharedAudioCtx.addEventListener("statechange", () => {
          if (sharedAudioCtx && (sharedAudioCtx.state === "interrupted" || sharedAudioCtx.state === "closed")) {
            audioDisabled = true;
          }
        });
      }
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {
        // Safe silence if document gesture hasn't occurred yet
      });
    }
    return sharedAudioCtx;
  } catch {
    audioDisabled = true;
    return null;
  }
}

function handleAudioError() {
  audioDisabled = true;
  try {
    if (sharedAudioCtx && typeof sharedAudioCtx.close === "function") {
      sharedAudioCtx.close().catch(() => {});
    }
  } catch {
    // Silence
  }
  sharedAudioCtx = null;
}

export function playEmergencyAlert() {
  const ctx = getSafeAudioContext();
  if (!ctx || ctx.state === "closed") return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    handleAudioError(e);
  }
}

export function playDispatchChime() {
  const ctx = getSafeAudioContext();
  if (!ctx || ctx.state === "closed") return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    handleAudioError(e);
  }
}

export function playSmsNotificationChime() {
  const ctx = getSafeAudioContext();
  if (!ctx || ctx.state === "closed") return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    handleAudioError(e);
  }
}
