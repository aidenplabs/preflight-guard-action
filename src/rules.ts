import type { Finding, Severity } from "./types.js";
import type { RuleContext } from "./types.js";
import { getRulePacksForStack } from "./rule-packs/registry.js";

const severityRank: Record<Severity, number> = {
  Blocker: 0,
  High: 1,
  Medium: 2
};

export function runRules(context: RuleContext): Finding[] {
  return getRulePacksForStack(context.stack)
    .flatMap((rulePack) => rulePack.rules)
    .flatMap((rule) => rule.run(context))
    .filter((finding, index, findings) => findings.findIndex((candidate) => candidate.ruleId === finding.ruleId && candidate.filePath === finding.filePath) === index)
    .sort((left, right) => {
      if (severityRank[left.severity] !== severityRank[right.severity]) {
        return severityRank[left.severity] - severityRank[right.severity];
      }

      return left.ruleId.localeCompare(right.ruleId);
    });
}
