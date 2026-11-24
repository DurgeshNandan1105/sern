/**
 * SERN Telematics AI Decision Representation
 *
 * Provides accurate, uninflated ML probability representation for emergency dispatchers.
 * Raw model probabilities are displayed faithfully without artificial boosting.
 */
export function formatAiConfidence(prob, threshold = 0.3356) {
  const p = typeof prob === "number" ? prob : parseFloat(prob) || 0;
  const t = typeof threshold === "number" ? threshold : parseFloat(threshold) || 0.3356;

  const rawPercent = +(p * 100).toFixed(1);
  const thresholdPercent = +(t * 100).toFixed(1);
  const isDetected = p >= t;

  if (isDetected) {
    return {
      percentage: rawPercent,
      label: p >= 0.70 ? "Critical Collision" : "Collision Detected (Above Threshold)",
      isDetected: true,
      color: p >= 0.70 ? "#ef4444" : "#f59e0b",
      rawProb: rawPercent.toFixed(1),
      rawThreshold: thresholdPercent.toFixed(1),
      summaryText: `${rawPercent}% ML Probability (Above ${thresholdPercent}% Threshold)`
    };
  } else {
    return {
      percentage: rawPercent,
      label: "Sub-Threshold (Non-Accident)",
      isDetected: false,
      color: "#10b981",
      rawProb: rawPercent.toFixed(1),
      rawThreshold: thresholdPercent.toFixed(1),
      summaryText: `${rawPercent}% ML Probability (Below ${thresholdPercent}% Threshold)`
    };
  }
}
