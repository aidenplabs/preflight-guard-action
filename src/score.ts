import type { Finding, RecommendationBasis, ScanResult, StackDetectionResult } from "./types.js";

function hasReliableTargetStack(stack: StackDetectionResult): boolean {
  return stack.supportedCombination && stack.profileFit === "strong-match" && stack.overallConfidence === "high";
}

export interface RecommendationDecision {
  recommendation: ScanResult["shipRecommendation"];
  basis: RecommendationBasis;
  summary: string;
}

export function decideShipRecommendation(findings: Finding[], stack: StackDetectionResult): RecommendationDecision {
  const confirmedBlockerCount = findings.filter((finding) => finding.severity === "Blocker" && finding.confidence === "confirmed").length;
  const blockerCount = findings.filter((finding) => finding.severity === "Blocker").length;
  const highCount = findings.filter((finding) => finding.severity === "High").length;
  const mediumCount = findings.filter((finding) => finding.severity === "Medium").length;

  if (confirmedBlockerCount > 0) {
    return {
      recommendation: "no",
      basis: "confirmed-blocker-findings",
      summary: "The scanner found at least one confirmed blocker-level issue. Treat this as a strong no-ship signal until the finding is fixed or disproved."
    };
  }

  if (blockerCount > 0) {
    return {
      recommendation: "no",
      basis: "blocker-findings",
      summary: "The scanner found at least one blocker-level issue. Treat this as a no-ship signal until the finding is fixed or disproved."
    };
  }

  if (highCount >= 2) {
    return {
      recommendation: "no",
      basis: "multiple-high-findings",
      summary: "The scanner found multiple high-severity issues. Treat this as a no-ship signal until those findings are reviewed and resolved."
    };
  }

  if (highCount >= 1 || mediumCount >= 1) {
    if (highCount >= 1 || mediumCount >= 2) {
      return {
        recommendation: "caution",
        basis: "elevated-review-findings",
        summary: "Multiple or stronger review-needed findings triggered. This caution is more than a weak review note and should be treated as a meaningful pre-deploy stop-and-review signal."
      };
    }

    return {
      recommendation: "caution",
      basis: "review-findings",
      summary: "A specific review-needed finding triggered. This caution means the scan found a concrete issue to inspect before deployment, not just weak stack confidence."
    };
  }

  if (!hasReliableTargetStack(stack)) {
    return {
      recommendation: "caution",
      basis: "insufficient-supported-confidence",
      summary: "No findings triggered, but the detected combination is not a strong enough supported match for ship: yes. Treat this as a review-only clean scan, not a clean bill of health."
    };
  }

  return {
    recommendation: "yes",
    basis: "clean-supported-scan",
    summary: "No current heuristic findings were triggered on a strong-match supported combination. This is a useful clean-scan signal, but it is still not proof of security."
  };
}

export function getExitCode(recommendation: ScanResult["shipRecommendation"]): number {
  switch (recommendation) {
    case "yes":
      return 0;
    case "caution":
      return 1;
    case "no":
      return 2;
  }
}
