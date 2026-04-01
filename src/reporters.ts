import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BlockerResponsePack, ExecutionPack, Finding, ScanResult, Severity } from "./types.js";

const SEVERITY_ORDER: Severity[] = ["Blocker", "High", "Medium"];

function groupBySeverity(findings: Finding[]): Map<Severity, Finding[]> {
  const grouped = new Map<Severity, Finding[]>();

  for (const severity of SEVERITY_ORDER) {
    grouped.set(severity, findings.filter((finding) => finding.severity === severity));
  }

  return grouped;
}

function formatFindingMarkdown(finding: Finding): string {
  const lines = [
    `### ${finding.title}`,
    `- Rule ID: \`${finding.ruleId}\``,
    `- Severity: **${finding.severity}**`,
    `- Confidence: \`${finding.confidence}\``,
    `- Category: \`${finding.category}\``,
    `- File: \`${finding.filePath}\``,
    `- What was found: ${finding.explanation}`,
    `- Why it matters: ${finding.whyItMatters}`,
    `- Minimum fix: ${finding.minimumFix}`
  ];

  if (finding.evidence && finding.evidence.length > 0) {
    lines.push(`- Evidence: ${finding.evidence.join(" | ")}`);
  }

  return lines.join("\n");
}

function formatExecutionPackMarkdown(pack: ExecutionPack): string {
  const sections = [
    `### ${pack.ruleId} ${pack.title}`,
    `- Finding key: \`${pack.findingKey}\``,
    `- File: \`${pack.filePath}\``,
    `- Combination: \`${pack.combination}\``,
    `- Support status: \`${pack.supportStatus}\``,
    "",
    "#### Repair Brief",
    pack.repairBrief,
    "",
    "#### Ordered Fix Steps",
    ...pack.orderedFixSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "#### Copy-Paste Prompt Pack"
  ];

  for (const prompt of pack.promptPack) {
    sections.push("");
    sections.push(`##### ${prompt.label}`);
    sections.push(`- Intent: ${prompt.intent}`);
    sections.push("");
    sections.push("```text");
    sections.push(prompt.prompt);
    sections.push("```");
  }

  sections.push("");
  sections.push("#### Verification Checklist");
  sections.push(...pack.verificationChecklist.map((item) => `- ${item}`));
  sections.push("");
  sections.push("#### Safe Fix Guidance");
  sections.push(...pack.safeFixGuidance.map((item) => `- ${item}`));
  sections.push("");
  sections.push("#### Risky Fix Guidance");
  sections.push(...pack.riskyFixGuidance.map((item) => `- ${item}`));

  return sections.join("\n");
}

function formatBlockerResponsePackMarkdown(pack: BlockerResponsePack): string {
  const sections = [
    `### ${pack.ruleId} ${pack.title}`,
    `- Finding key: \`${pack.findingKey}\``,
    `- File: \`${pack.filePath}\``,
    `- Combination: \`${pack.combination}\``,
    `- Support status: \`${pack.supportStatus}\``,
    "",
    "#### Blocker Brief",
    pack.blockerBrief,
    "",
    "#### Immediate Containment Priorities",
    ...pack.immediateContainmentPriorities.map((item) => `- ${item}`),
    "",
    "#### Exact File Inspection Targets",
    ...pack.exactFileInspectionTargets.map((item) => `- ${item}`),
    "",
    "#### Diagnosis / Containment Prompt Pack"
  ];

  for (const prompt of pack.promptPack) {
    sections.push("");
    sections.push(`##### ${prompt.label}`);
    sections.push(`- Intent: ${prompt.intent}`);
    sections.push("");
    sections.push("```text");
    sections.push(prompt.prompt);
    sections.push("```");
  }

  sections.push("");
  sections.push("#### Verification Checklist");
  sections.push(...pack.verificationChecklist.map((item) => `- ${item}`));
  sections.push("");
  sections.push("#### Explicit Uncertainty / Escalation Note");
  sections.push(pack.uncertaintyEscalationNote);

  return sections.join("\n");
}

export function renderTerminalSummary(result: ScanResult): string {
  const blockerCount = result.findings.filter((finding) => finding.severity === "Blocker").length;
  const highCount = result.findings.filter((finding) => finding.severity === "High").length;
  const mediumCount = result.findings.filter((finding) => finding.severity === "Medium").length;

  const coverageNote = result.stack.supportedCombination && result.stack.overallConfidence === "high"
    ? "Coverage note: supported combination confidence is high for this scan, but the result is still heuristic rather than a proof of safety."
    : "Coverage note: supported-combination confidence is partial or weak, or no supported pack combination was found, so a clean result is not a strong safety signal.";

  const findingLines = result.findings.length === 0
    ? ["No findings triggered."]
    : result.findings.map((finding) => `- [${finding.severity}] ${finding.ruleId} ${finding.title} (${finding.filePath})`);

  return [
    "Preflight Security Check",
    `Scanned path: ${result.summary.scannedPath}`,
    `Base profile: ${result.stack.profile}`,
    `Detected combination: ${result.stack.combination}`,
    `Combination label: ${result.stack.combinationLabel}`,
    `Active packs: ${result.stack.activePacks.length > 0 ? result.stack.activePacks.join(", ") : "none"}`,
    `Combination status: ${result.stack.supportStatus}`,
    `Stack confidence: ${result.stack.overallConfidence}`,
    `Profile fit: ${result.stack.profileFit}`,
    `Detected stack: ${result.stack.components.map((component) => `${component.name}=${component.detected ? component.confidence : "not-detected"}`).join(", ")}`,
    coverageNote,
    `Findings: ${result.findings.length} total (${blockerCount} Blocker, ${highCount} High, ${mediumCount} Medium)`,
    `Ship recommendation: ${result.shipRecommendation}`,
    `Recommendation basis: ${result.recommendationBasis}`,
    `Recommendation note: ${result.recommendationSummary}`,
    `AI handoff prompts: ${result.aiHandoffs.length}`,
    "",
    ...findingLines
  ].join("\n");
}

export function renderMarkdownReport(result: ScanResult): string {
  const grouped = groupBySeverity(result.findings);
  const stackLines = result.stack.components.map((component) => {
    const evidence = component.signals.length > 0
      ? component.signals.map((signal) => signal.evidence).join("; ")
      : "No useful signals found.";

    return `- **${component.name}**: ${component.detected ? `detected (${component.confidence}, score ${component.score}/${component.maxScore})` : `not clearly detected (${component.confidence}, score ${component.score}/${component.maxScore})`} — ${evidence}`;
  });

  const sections: string[] = [
    "# Preflight Report",
    "",
    "## Project Summary",
    `- Scanned path: \`${result.summary.scannedPath}\``,
    `- Scanned at: \`${result.summary.scannedAt}\``,
    `- Files scanned: ${result.summary.fileCount}`,
    "",
    "## Detected Stack",
    `- Base profile: \`${result.stack.profile}\``,
    `- Detected combination: \`${result.stack.combination}\``,
    `- Combination label: \`${result.stack.combinationLabel}\``,
    `- Active packs: ${result.stack.activePacks.length > 0 ? result.stack.activePacks.map((pack) => `\`${pack}\``).join(", ") : "none"}`,
    `- Combination status: \`${result.stack.supportStatus}\``,
    `- Overall confidence: \`${result.stack.overallConfidence}\``,
    `- Profile fit: \`${result.stack.profileFit}\``,
    `- Summary: ${result.stack.summary}`,
    `- Coverage note: ${result.stack.supportedCombination && result.stack.overallConfidence === "high" ? "Supported-combination confidence is high enough for a useful clean scan signal, but the scan remains heuristic rather than a proof of safety." : "Supported-combination confidence is partial or weak, or no supported pack combination was found, so a clean scan should be treated cautiously."}`,
    ...stackLines,
    "",
    "## Findings By Severity"
  ];

  for (const severity of SEVERITY_ORDER) {
    sections.push("");
    sections.push(`## ${severity}`);
    const findings = grouped.get(severity) ?? [];

    if (findings.length === 0) {
      sections.push("No findings in this severity.");
      continue;
    }

    for (const finding of findings) {
      sections.push("");
      sections.push(formatFindingMarkdown(finding));
    }
  }

  sections.push("");
  sections.push("## Final Recommendation");
  sections.push(`- Ship: **${result.shipRecommendation}**`);
  sections.push(`- Recommendation basis: \`${result.recommendationBasis}\``);
  sections.push(`- Recommendation note: ${result.recommendationSummary}`);

  if (result.aiHandoffs.length > 0) {
    sections.push("");
    sections.push("## AI Handoff Prompts");
    sections.push("These prompts are copy-paste helpers for a coding assistant.");
    sections.push("They do not guarantee a safe or correct patch, and they should not be treated as auto-remediation.");

    for (const handoff of result.aiHandoffs) {
      sections.push("");
      sections.push(`### ${handoff.ruleId} ${handoff.title}`);
      sections.push(`- Finding key: \`${handoff.findingKey}\``);
      sections.push(`- Prompt version: \`${handoff.promptVersion}\``);
      sections.push(`- Combination: \`${handoff.combination}\``);
      sections.push(`- Support status: \`${handoff.supportStatus}\``);
      sections.push("");
      sections.push("```text");
      sections.push(handoff.prompt);
      sections.push("```");
    }
  }

  if (result.executionPacks.length > 0) {
    sections.push("");
    sections.push("## Execution Help Packs");
    sections.push("These structured execution-help blocks are currently generated only for supported SB003 and SB004 findings.");
    sections.push("They are more guided than the basic AI handoff prompts, but they are still not auto-remediation and they do not guarantee a safe or correct patch.");

    for (const pack of result.executionPacks) {
      sections.push("");
      sections.push(formatExecutionPackMarkdown(pack));
    }
  }

  if (result.blockerResponsePacks.length > 0) {
    sections.push("");
    sections.push("## Blocker Response Packs");
    sections.push("These reduced blocker-response blocks are currently generated only for supported SB001, SB002, and ENV002 findings.");
    sections.push("They stay diagnosis-first, containment-first, and verify-before-closure.");
    sections.push("They are intentionally narrower than the SB003/SB004 execution-help packs and they do not present a confident repair flow.");

    for (const pack of result.blockerResponsePacks) {
      sections.push("");
      sections.push(formatBlockerResponsePackMarkdown(pack));
    }
  }

  sections.push("");
  sections.push("## Limitations");
  for (const limitation of result.limitations) {
    sections.push(`- ${limitation}`);
  }

  return sections.join("\n");
}

export function renderJsonReport(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export async function writeReports(result: ScanResult, outputDirectory: string): Promise<{ markdownPath: string; jsonPath: string }> {
  const markdownPath = join(outputDirectory, "preflight-report.md");
  const jsonPath = join(outputDirectory, "preflight-report.json");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(markdownPath, renderMarkdownReport(result), "utf8");
  await writeFile(jsonPath, renderJsonReport(result), "utf8");

  return { markdownPath, jsonPath };
}
