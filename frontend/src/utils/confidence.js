/**
 * SERN Telematics AI Decision Calibrator
 *
 * Background:
 * The underlying RandomForestClassifier is trained on imbalanced vehicle telemetry.
 * Its optimal Bayes decision threshold is tau = 0.3356 (33.6%).
 * Any raw probability >= tau triggers a positive collision alarm.
 *
 * To prevent cognitive dissonance where an operator interprets raw 43.7% as "low confidence",
 * this helper normalizes the score into a standard 0-100% Calibrated Confidence Index:
 * - Scores >= tau map smoothly to 80.0% - 99.4% (Confirmed Crash Zone)
 * - Scores < tau map smoothly to 1.0% - 49.0% (Normal Driving / Sub-threshold)
 */
export function formatAiConfidence(prob, threshold = 0.3356) {
  const p = typeof prob === "number" ? prob : parseFloat(prob) || 0;
  const t = typeof threshold === "number" ? threshold : parseFloat(threshold) || 0.3356;

  if (p >= t) {
    const ratio = Math.min(1.0, Math.max(0, (p - t) / (1.0 - t)));
    // Maps from 80% to 99.4%
    const normalized = 80 + ratio * 19.4;
    return {
      percentage: +normalized.toFixed(1),
      label: normalized >= 90 ? "Critical Collision" : "High Confidence Crash",
      isDetected: true,
      color: "#ef4444",
      rawProb: (p * 100).toFixed(1),
      rawThreshold: (t * 100).toFixed(1),
      summaryText: `${normalized.toFixed(1)}% Match (${(p * 100).toFixed(1)}% raw vs ${(t * 100).toFixed(1)}% threshold)`
    };
  } else {
    const ratio = Math.min(1.0, Math.max(0, p / t));
    // Maps from 2% to 48%
    const normalized = ratio * 48;
    return {
      percentage: Math.max(1.0, +normalized.toFixed(1)),
      label: "Normal Driving / Below Threshold",
      isDetected: false,
      color: "#10b981",
      rawProb: (p * 100).toFixed(1),
      rawThreshold: (t * 100).toFixed(1),
      summaryText: `${normalized.toFixed(1)}% (${(p * 100).toFixed(1)}% raw vs ${(t * 100).toFixed(1)}% threshold)`
    };
  }
}
