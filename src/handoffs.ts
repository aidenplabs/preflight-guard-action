import type {
  AiHandoffPrompt,
  BlockerResponsePack,
  ExecutionPack,
  Finding,
  ProjectFile,
  ProjectSignals,
  ScanResult
} from "./types.js";

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function existingEnvExamples(signals: ProjectSignals): string[] {
  return signals.envFiles.filter((path) => /(^|\/)\.env\.(example|sample)$/i.test(path));
}

function likelySupabaseHelpers(signals: ProjectSignals): string[] {
  return signals.supabaseFiles.filter((path) =>
    !path.startsWith("supabase/")
    && !path.startsWith(".env")
    && /(supabase|server|client|middleware)/i.test(path)
  );
}

function likelyRouteGuards(signals: ProjectSignals): string[] {
  return [
    ...signals.middlewareFiles,
    ...signals.apiRouteFiles,
    ...signals.serverActionFiles
  ];
}

function likelyBrowserSupabaseFiles(signals: ProjectSignals): string[] {
  return uniquePaths([
    ...signals.clientFiles.filter((path) => /supabase|client/i.test(path)),
    ...signals.supabaseFiles.filter((path) =>
      !path.startsWith("supabase/")
      && !path.startsWith(".env")
      && /supabase|client/i.test(path)
    )
  ]);
}

function extractSensitivePublicEnvNames(finding: Finding): string[] {
  const sourceText = [
    finding.explanation,
    ...(finding.evidence ?? [])
  ].join(" ");

  return uniquePaths(sourceText.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []);
}

function likelyEnvConsumerFiles(files: ProjectFile[], envNames: string[]): string[] {
  if (envNames.length === 0) {
    return [];
  }

  return files
    .filter((file) =>
      !/(^|\/)\.env($|\.)/i.test(file.path)
      && envNames.some((envName) => file.content.includes(envName))
    )
    .map((file) => file.path);
}

function buildPromptHeader(result: ScanResult, finding: Finding): string[] {
  return [
    "You are helping with a narrow pre-deploy repair inside an existing Next.js repo.",
    "Do not do a broad rewrite.",
    `Detected combination: ${result.stack.combinationLabel} (${result.stack.combination})`,
    `Support status: ${result.stack.supportStatus}`,
    `Finding: ${finding.ruleId} ${finding.title}`,
    `Severity: ${finding.severity}`,
    `Confidence: ${finding.confidence}`,
    "",
    "Current diagnosis:",
    finding.explanation,
    "",
    "Why it matters:",
    finding.whyItMatters
  ];
}

function buildSb004InspectFiles(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string[] {
  const packageAnchor = finding.filePath === "package.json" ? ["package.json"] : [];
  const specificInspectFiles = uniquePaths([
    ...(signals.supabaseFiles.some((path) => path.startsWith("supabase/")) ? ["supabase/"] : []),
    ...likelySupabaseHelpers(signals).slice(0, 3),
    ...existingEnvExamples(signals).slice(0, 2),
    ...(finding.filePath === "package.json" ? [] : [finding.filePath])
  ]);

  return uniquePaths([
    ...specificInspectFiles,
    ...result.findings
      .filter((candidate) => candidate.ruleId === "SB004")
      .map((candidate) => candidate.filePath)
      .filter((path) => path !== "package.json"),
    "supabase/",
    ".env.example",
    ...packageAnchor
  ]);
}

function buildSb003InspectFiles(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string[] {
  return uniquePaths([
    finding.filePath,
    ...result.findings.filter((candidate) => candidate.ruleId === "SB003").map((candidate) => candidate.filePath),
    ...likelyRouteGuards(signals).slice(0, 4)
  ]);
}

function buildSb003VerificationChecklist(): string[] {
  return [
    "Confirm the sensitive route or action now contains a clear local auth or authorization step.",
    "Confirm unauthenticated or unauthorized callers can no longer reach the sensitive server-side path by default.",
    "Confirm the change does not silently broaden access or break the existing request flow.",
    "Re-run the project's preflight scan and report whether SB003 cleared or still appears."
  ];
}

function buildSb004VerificationChecklist(): string[] {
  return [
    "Confirm policy or migration files are present in a repo-visible location if that is the intended fix.",
    "Confirm Supabase-related env examples and helper files still make sense after the change.",
    "Re-run the project's preflight scan and report whether SB004 cleared or still appears.",
    "If the repo intentionally manages policies outside version control, say that explicitly instead of pretending the finding is resolved."
  ];
}

function buildSb001InspectFiles(
  finding: Finding,
  signals: ProjectSignals
): string[] {
  return uniquePaths([
    finding.filePath,
    ...likelyBrowserSupabaseFiles(signals).slice(0, 3),
    ...existingEnvExamples(signals).slice(0, 2)
  ]);
}

function buildEnv002InspectFiles(
  finding: Finding,
  signals: ProjectSignals,
  files: ProjectFile[]
): string[] {
  const sensitivePublicEnvNames = extractSensitivePublicEnvNames(finding);

  return uniquePaths([
    finding.filePath,
    ...likelyEnvConsumerFiles(files, sensitivePublicEnvNames).slice(0, 3),
    ...existingEnvExamples(signals).slice(0, 2),
    ...signals.clientFiles.slice(0, 3)
  ]);
}

function buildSb002InspectFiles(
  finding: Finding,
  signals: ProjectSignals
): string[] {
  return uniquePaths([
    finding.filePath,
    ...likelyBrowserSupabaseFiles(signals).slice(0, 4),
    ...likelySupabaseHelpers(signals).slice(0, 3),
    ...existingEnvExamples(signals).slice(0, 2)
  ]);
}

function buildSb001VerificationChecklist(): string[] {
  return [
    "Confirm no browser-reachable file still references `SUPABASE_SERVICE_ROLE_KEY` or preserves service-role style client setup.",
    "Confirm any privileged Supabase operation now runs only through a server-only path or has been removed from browser code.",
    "If rotation is required outside the repo, record that as unresolved follow-up instead of implying the blocker is fully closed.",
    "Re-run the project's preflight scan and report whether SB001 cleared or still appears."
  ];
}

function buildEnv002VerificationChecklist(): string[] {
  return [
    "Confirm no sensitive-looking `NEXT_PUBLIC_` variable name remains in repo-visible env files or client code for this case.",
    "Confirm browser code no longer depends on the removed public-sensitive variable name.",
    "If the value may already be exposed outside the repo, record rotation or external follow-up explicitly instead of claiming closure from code changes alone.",
    "Re-run the project's preflight scan and report whether ENV002 cleared or still appears."
  ];
}

function buildSb002VerificationChecklist(): string[] {
  return [
    "Confirm no browser-reachable Supabase client setup still references `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SECRET`, or `SUPABASE_DB_PASSWORD` for this case.",
    "Confirm any remaining browser Supabase client path now uses only public anon-style credentials.",
    "If privileged Supabase behavior is still required, confirm it now runs behind a server-only path instead of the browser client path.",
    "Re-run the project's preflight scan and report whether SB002 cleared or still appears."
  ];
}

function buildVerificationPrompt(
  result: ScanResult,
  finding: Finding,
  inspectFiles: string[],
  verificationChecklist: string[],
  focusLine: string
): string {
  return [
    "You are reviewing a narrow post-edit verification pass inside an existing Next.js repo.",
    "Do not introduce new rewrites.",
    `Detected combination: ${result.stack.combinationLabel} (${result.stack.combination})`,
    `Support status: ${result.stack.supportStatus}`,
    `Finding: ${finding.ruleId} ${finding.title}`,
    "",
    "Files to verify first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Verification focus:",
    focusLine,
    "",
    "Checklist:",
    ...verificationChecklist.map((item) => `- ${item}`),
    "",
    "Expected output:",
    "- Exact files re-checked.",
    "- Whether the narrow fix really addressed the finding.",
    "- Any remaining uncertainty or missing evidence.",
    "",
    "Do not turn this into a broad audit. Stay focused on the original finding."
  ].join("\n");
}

function buildSb004Prompt(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string {
  const inspectFiles = buildSb004InspectFiles(result, finding, signals);
  const verificationChecklist = buildSb004VerificationChecklist();

  return [
    ...buildPromptHeader(result, finding),
    "",
    "Likely files to inspect first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Minimum safe repair goal:",
    "Decide whether this repo has any repo-visible versioned Supabase policy/RLS signals. If they exist but the scanner could not see them clearly, make them easier to find. If they are not repo-visible today, either add the minimum policy/migration structure needed or explain clearly that policy management happens outside this repo instead of pretending the finding is resolved.",
    "",
    "Constraints:",
    "- Do not rewrite the app architecture.",
    "- Do not change unrelated routes, UI, or deployment config.",
    "- Do not invent broad security hardening beyond what is needed to clarify Supabase policy/RLS intent.",
    "- Do not add placeholder SQL or fake policy files just to make this finding disappear.",
    "- Do not claim that RLS is correct unless you can point to the actual policy or migration files.",
    "- If repo-visible evidence is still too weak to justify a safe edit, stop after diagnosis and explain what is missing instead of inventing a fix.",
    "- If repo context is insufficient, inspect the files above before editing and say what is still unclear.",
    "",
    "Expected output from the coding assistant:",
    "- Brief diagnosis of whether versioned policy/RLS signals exist today.",
    "- Exact files inspected.",
    "- Minimal file edits proposed or applied.",
    "- If no safe minimal edit is justified yet, say that explicitly instead of manufacturing one.",
    "- Short explanation of why those edits are enough for this finding.",
    "- Any uncertainty that remains.",
    "",
    "Validation checklist after edits:",
    ...verificationChecklist.map((item) => `- ${item}`),
    "",
    "Do not generate a generic security audit. Stay focused on this finding only."
  ].join("\n");
}

function buildSb003Prompt(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string {
  const inspectFiles = buildSb003InspectFiles(result, finding, signals);
  const verificationChecklist = buildSb003VerificationChecklist();

  return [
    ...buildPromptHeader(result, finding),
    "",
    "Likely files to inspect first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Minimum safe repair goal:",
    "Decide whether this sensitive route or server action already has a real local auth or authorization guard. If it does, make that guard explicit in the file. If it does not, add the smallest clear guard before the sensitive work happens.",
    "",
    "Constraints:",
    "- Do not replace the app's auth system.",
    "- Do not add a broad middleware or framework rewrite just to satisfy this finding.",
    "- Do not assume middleware alone proves route protection unless the file itself makes the authorization path clear.",
    "- Do not treat a client-side guard as proof that a server-side mutation path is protected.",
    "- Keep the change local to the flagged handler or action unless one shared helper is clearly the smallest safe fix.",
    "- If repo-visible evidence is still too weak to justify a safe edit, stop after diagnosis and explain what is missing instead of inventing a fix.",
    "- If repo context is insufficient, inspect the flagged files first and explain what auth path is actually in use before editing.",
    "",
    "Expected output from the coding assistant:",
    "- Brief diagnosis of the current auth path for the flagged route or action.",
    "- Exact files inspected.",
    "- Minimal change proposed or applied.",
    "- If no safe minimal edit is justified yet, say that explicitly instead of manufacturing one.",
    "- Why the new or clarified guard is the narrowest safe fix.",
    "- Any remaining uncertainty.",
    "",
    "Validation checklist after edits:",
    ...verificationChecklist.map((item) => `- ${item}`),
    "",
    "Do not perform unrelated refactors. Stay tightly scoped to the flagged auth check path."
  ].join("\n");
}

function buildSb001Prompt(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string {
  const inspectFiles = buildSb001InspectFiles(finding, signals);

  return [
    ...buildPromptHeader(result, finding),
    "",
    "Likely files to inspect first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Minimum safe repair goal:",
    "Remove service-role behavior from browser-reachable code. If the browser only needs normal Supabase access, switch it to public anon credentials. If the feature truly needs privileged database access, move that operation behind a server-only path instead of keeping the service role in client code.",
    "",
    "Constraints:",
    "- Do not keep any service-role key or service-role-style client setup in browser-reachable code.",
    "- Do not just rename the variable or helper if the same privileged behavior still reaches the browser.",
    "- Do not move the same leak into a different client helper file.",
    "- Do not rewrite the full auth or data layer unless a tiny server-only bridge is clearly the smallest safe fix.",
    "- If repo-visible evidence is still too weak to justify a safe edit, stop after diagnosis and explain what is missing instead of inventing a fix.",
    "",
    "Expected output from the coding assistant:",
    "- Brief diagnosis of how service-role behavior currently reaches browser code.",
    "- Exact files inspected.",
    "- Minimal change proposed or applied.",
    "- If no safe minimal edit is justified yet, say that explicitly instead of manufacturing one.",
    "- Why the chosen repair keeps privileged Supabase access server-only.",
    "- Any remaining uncertainty.",
    "",
    "Validation checklist after edits:",
    "- Confirm no browser-reachable file references `SUPABASE_SERVICE_ROLE_KEY` or keeps suspicious `service_role` client setup.",
    "- Confirm any remaining browser Supabase client uses only public anon-style credentials.",
    "- Re-run the project's preflight scan and report whether SB001 cleared or still appears.",
    "",
    "Do not treat this as a generic security cleanup. Stay focused on removing privileged Supabase access from the browser path."
  ].join("\n");
}

function buildEnv002Prompt(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals,
  files: ProjectFile[]
): string {
  const inspectFiles = buildEnv002InspectFiles(finding, signals, files);

  return [
    ...buildPromptHeader(result, finding),
    "",
    "Likely files to inspect first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Minimum safe repair goal:",
    "Remove the sensitive value from `NEXT_PUBLIC_` naming. If the value is truly privileged, keep it server-only and update any consuming code so the browser no longer depends on it. If it was never meant to be public, rotate it if exposure is plausible.",
    "",
    "Constraints:",
    "- Do not keep the same sensitive value exposed through any `NEXT_PUBLIC_` alias.",
    "- Do not only rename the env file entry if browser code still expects the old public variable.",
    "- Do not replace broad app configuration unless a tiny server-only substitution is clearly enough.",
    "- If repo-visible evidence is still too weak to justify a safe edit, stop after diagnosis and explain what is missing instead of inventing a fix.",
    "",
    "Expected output from the coding assistant:",
    "- Brief diagnosis of which `NEXT_PUBLIC_` name looks sensitive and whether browser code consumes it.",
    "- Exact files inspected.",
    "- Minimal change proposed or applied.",
    "- If no safe minimal edit is justified yet, say that explicitly instead of manufacturing one.",
    "- Why the change removes public exposure without broad unrelated rewrites.",
    "- Any remaining uncertainty.",
    "",
    "Validation checklist after edits:",
    "- Confirm no sensitive-looking `NEXT_PUBLIC_` variable name remains in repo-visible env files or client code for this case.",
    "- Confirm browser code no longer depends on the removed public-sensitive name.",
    "- Re-run the project's preflight scan and report whether ENV002 cleared or still appears.",
    "",
    "Do not treat this as a generic env cleanup. Stay focused on the flagged public-sensitive variable naming."
  ].join("\n");
}

function buildSb002Prompt(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): string {
  const inspectFiles = buildSb002InspectFiles(finding, signals);

  return [
    ...buildPromptHeader(result, finding),
    "",
    "Likely files to inspect first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Minimum safe repair goal:",
    "Remove the non-public Supabase credential from the browser-reachable client setup path. If the browser only needs standard Supabase access, switch that path to public anon credentials. If the feature truly needs privileged Supabase behavior, move that behavior behind a server-only path instead of keeping the privileged credential in browser-side client setup.",
    "",
    "Constraints:",
    "- Do not broaden this into generic env cleanup or claim that every privileged env issue in the repo is fixed.",
    "- Do not treat `ENV003` as automatically resolved unless the broader browser-side privileged env reference is actually gone too.",
    "- Do not just rename the helper or variable if the same non-public Supabase credential still reaches browser-side client initialization.",
    "- Do not imply helper-indirect usage is browser-reachable unless the flagged path is already repo-visibly client-reachable.",
    "- Do not rewrite the app's full data layer unless a tiny server-only bridge is clearly the narrowest safe fix.",
    "- If repo-visible evidence is still too weak to justify a safe edit, stop after diagnosis and explain what is missing instead of inventing a fix.",
    "",
    "Expected output from the coding assistant:",
    "- Brief diagnosis of which browser-reachable Supabase client path carries the non-public credential.",
    "- Exact files inspected.",
    "- Minimal containment change proposed or applied.",
    "- If no safe minimal edit is justified yet, say that explicitly instead of manufacturing one.",
    "- Why the chosen change keeps privileged Supabase credentials out of browser-side client setup.",
    "- Any remaining uncertainty, overlap with `ENV003`, or external follow-up still needed.",
    "",
    "Validation checklist after edits:",
    "- Confirm the flagged browser-reachable client setup no longer initializes a Supabase client with a non-public credential.",
    "- Confirm any remaining browser Supabase client path uses only public anon-style credentials.",
    "- Re-run the project's preflight scan and report whether SB002 cleared or still appears.",
    "",
    "Do not treat this as a generic secret cleanup. Stay focused on the flagged browser-reachable Supabase client setup path."
  ].join("\n");
}

export function buildAiHandoffs(
  result: Pick<ScanResult, "summary" | "stack" | "findings">,
  signals: ProjectSignals,
  files: ProjectFile[]
): AiHandoffPrompt[] {
  return result.findings.flatMap((finding) => {
    let prompt: string | null = null;

    if (finding.ruleId === "SB004") {
      prompt = buildSb004Prompt(result as ScanResult, finding, signals);
    } else if (finding.ruleId === "SB003") {
      prompt = buildSb003Prompt(result as ScanResult, finding, signals);
    } else if (finding.ruleId === "SB001") {
      prompt = buildSb001Prompt(result as ScanResult, finding, signals);
    } else if (finding.ruleId === "SB002") {
      prompt = buildSb002Prompt(result as ScanResult, finding, signals);
    } else if (finding.ruleId === "ENV002") {
      prompt = buildEnv002Prompt(result as ScanResult, finding, signals, files);
    }

    if (!prompt) {
      return [];
    }

    return [{
      promptVersion: "1",
      findingKey: `${finding.ruleId}:${finding.filePath}`,
      ruleId: finding.ruleId,
      title: finding.title,
      combination: result.stack.combination,
      supportStatus: result.stack.supportStatus,
      prompt
    }];
  });
}

function buildSb003ExecutionPack(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): ExecutionPack {
  const inspectFiles = buildSb003InspectFiles(result, finding, signals);
  const verificationChecklist = buildSb003VerificationChecklist();

  return {
    findingKey: `${finding.ruleId}:${finding.filePath}`,
    ruleId: "SB003",
    title: finding.title,
    filePath: finding.filePath,
    combination: result.stack.combination,
    supportStatus: result.stack.supportStatus,
    repairBrief: "Review the flagged server-side path and make the auth or authorization decision explicit where the sensitive work happens. Prefer a local guard in the handler or action, or one shared helper only if that helper is already the real auth path in this repo.",
    orderedFixSteps: [
      "Inspect the flagged file and the nearest auth helper or middleware files to identify the current server-side auth path.",
      "If a real local guard already exists indirectly, make that guard explicit near the sensitive mutation or route logic.",
      "If no guard exists, add the smallest clear server-side auth or authorization check before the sensitive work happens.",
      "Re-run preflight and confirm the guarded path is clearer and the finding is reduced or explained."
    ],
    promptPack: [
      {
        label: "diagnose-and-fix",
        intent: "Use this first to inspect the current auth path and make the narrowest safe edit.",
        prompt: buildSb003Prompt(result, finding, signals)
      },
      {
        label: "verify-after-edit",
        intent: "Use this after an edit to confirm the route is actually guarded without broadening the change.",
        prompt: buildVerificationPrompt(
          result,
          finding,
          inspectFiles,
          verificationChecklist,
          "Confirm that a real server-side auth or authorization check is visible in or immediately before the flagged sensitive path."
        )
      }
    ],
    verificationChecklist,
    safeFixGuidance: [
      "Prefer a local server-side guard in the flagged file or a clearly reused shared helper that already exists in the repo.",
      "Keep the change close to the sensitive mutation, delete, admin, billing, or storage path.",
      "If the file already has a real auth step, clarifying it is safer than rewriting the auth system."
    ],
    riskyFixGuidance: [
      "Do not treat middleware alone as proof that the flagged route or action is protected.",
      "Do not rely on a client-side check to protect a server-side mutation path.",
      "Do not replace the app's auth system or add a broad framework rewrite just to clear this finding."
    ]
  };
}

function buildSb004ExecutionPack(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): ExecutionPack {
  const inspectFiles = buildSb004InspectFiles(result, finding, signals);
  const verificationChecklist = buildSb004VerificationChecklist();

  return {
    findingKey: `${finding.ruleId}:${finding.filePath}`,
    ruleId: "SB004",
    title: finding.title,
    filePath: finding.filePath,
    combination: result.stack.combination,
    supportStatus: result.stack.supportStatus,
    repairBrief: "Review whether this repo shows any versioned, repo-visible Supabase policy or RLS intent today. If it does, make that evidence easier to find. If it does not, add the minimum repo-visible policy or migration structure needed, or explicitly document that policy management happens outside version control instead of implying the finding is resolved.",
    orderedFixSteps: [
      "Inspect the Supabase helper files, migration or SQL folders, and env examples to see whether policy or RLS intent is already present but hard to find.",
      "If repo-visible policy evidence exists, make that path clearer and closer to the detected Supabase setup.",
      "If no repo-visible policy evidence exists, add only the minimum versioned policy or migration structure needed for the intended tables or document that policy management is external.",
      "Re-run preflight and confirm the repo now gives a reviewer a clearer RLS or policy signal."
    ],
    promptPack: [
      {
        label: "diagnose-and-fix",
        intent: "Use this first to inspect current RLS or policy signals and make the narrowest safe repo-visible improvement.",
        prompt: buildSb004Prompt(result, finding, signals)
      },
      {
        label: "verify-after-edit",
        intent: "Use this after an edit to confirm the repo now gives a clearer policy or RLS signal without faking coverage.",
        prompt: buildVerificationPrompt(
          result,
          finding,
          inspectFiles,
          verificationChecklist,
          "Confirm that the repo now shows real, versioned Supabase policy or migration intent, or explicitly says that policy management happens elsewhere."
        )
      }
    ],
    verificationChecklist,
    safeFixGuidance: [
      "Prefer making real existing policy or migration structure easier to find before adding new files.",
      "If a new repo-visible policy or migration file is needed, keep it minimal and specific to the actual tables or policy intent.",
      "It is safer to state that policy management happens outside the repo than to fabricate placeholder SQL."
    ],
    riskyFixGuidance: [
      "Do not add fake SQL, placeholder policy files, or generic hardening text just to silence the finding.",
      "Do not claim that RLS is correct unless you can point to actual versioned policy or migration files.",
      "Do not rewrite unrelated Supabase helpers, app routes, or deployment config while addressing this finding."
    ]
  };
}

export function buildExecutionPacks(
  result: Pick<ScanResult, "summary" | "stack" | "findings">,
  signals: ProjectSignals
): ExecutionPack[] {
  if (result.stack.supportStatus !== "supported") {
    return [];
  }

  return result.findings.flatMap((finding) => {
    if (finding.ruleId === "SB003") {
      return [buildSb003ExecutionPack(result as ScanResult, finding, signals)];
    }

    if (finding.ruleId === "SB004") {
      return [buildSb004ExecutionPack(result as ScanResult, finding, signals)];
    }

    return [];
  });
}

function buildBlockerVerificationPrompt(
  result: ScanResult,
  finding: Finding,
  inspectFiles: string[],
  verificationChecklist: string[],
  focusLine: string
): string {
  return [
    "You are reviewing a narrow blocker follow-up inside an existing Next.js repo.",
    "Do not introduce broad rewrites or declare the blocker solved unless the repo-visible evidence is actually stronger.",
    `Detected combination: ${result.stack.combinationLabel} (${result.stack.combination})`,
    `Support status: ${result.stack.supportStatus}`,
    `Finding: ${finding.ruleId} ${finding.title}`,
    "",
    "Files to re-check first:",
    ...inspectFiles.map((path) => `- ${path}`),
    "",
    "Verification focus:",
    focusLine,
    "",
    "Checklist:",
    ...verificationChecklist.map((item) => `- ${item}`),
    "",
    "Expected output:",
    "- Exact files re-checked.",
    "- Whether the immediate blocker path is now contained or still exposed.",
    "- Any external follow-up, rotation, or escalation that still remains.",
    "",
    "Do not turn this into a broad audit or promise full remediation if the evidence is still partial."
  ].join("\n");
}

function buildSb001BlockerResponsePack(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): BlockerResponsePack {
  const inspectFiles = buildSb001InspectFiles(finding, signals);
  const verificationChecklist = buildSb001VerificationChecklist();

  return {
    findingKey: `${finding.ruleId}:${finding.filePath}`,
    ruleId: "SB001",
    title: finding.title,
    filePath: finding.filePath,
    combination: result.stack.combination,
    supportStatus: result.stack.supportStatus,
    blockerBrief: "This finding suggests privileged Supabase behavior is still reachable from browser code. The immediate goal is to contain that exposure and verify that service-role access is no longer browser-reachable, not to present a full architectural repair flow.",
    immediateContainmentPriorities: [
      "Identify the first browser-reachable file that still creates or forwards privileged Supabase access.",
      "Stop service-role credentials or service-role style client setup from remaining in client-reachable code paths.",
      "If privileged behavior is still required, move it behind a server-only boundary and record any external follow-up such as key rotation separately."
    ],
    exactFileInspectionTargets: inspectFiles,
    promptPack: [
      {
        label: "diagnose-and-contain",
        intent: "Use this first to trace how privileged Supabase behavior reaches browser code and contain that path without pretending the whole remediation is complete.",
        prompt: buildSb001Prompt(result, finding, signals)
      },
      {
        label: "verify-after-containment",
        intent: "Use this after a narrow change to confirm the browser path no longer keeps service-role behavior and to record any remaining external follow-up.",
        prompt: buildBlockerVerificationPrompt(
          result,
          finding,
          inspectFiles,
          verificationChecklist,
          "Confirm the browser-reachable path no longer carries service-role behavior, and call out any remaining rotation or server-side follow-up instead of implying full closure."
        )
      }
    ],
    verificationChecklist,
    uncertaintyEscalationNote: "Do not claim this blocker is fully resolved if the repo only shows partial containment. If secret rotation, external cleanup, or off-repo configuration changes may still be required, say that explicitly and stop there."
  };
}

function buildEnv002BlockerResponsePack(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals,
  files: ProjectFile[]
): BlockerResponsePack {
  const inspectFiles = buildEnv002InspectFiles(finding, signals, files);
  const verificationChecklist = buildEnv002VerificationChecklist();

  return {
    findingKey: `${finding.ruleId}:${finding.filePath}`,
    ruleId: "ENV002",
    title: finding.title,
    filePath: finding.filePath,
    combination: result.stack.combination,
    supportStatus: result.stack.supportStatus,
    blockerBrief: "This finding suggests a sensitive value is named or routed as public-facing configuration. The immediate goal is to contain public exposure and verify that client code no longer depends on the sensitive public variable, not to promise that every downstream consequence is fixed.",
    immediateContainmentPriorities: [
      "Identify the exact `NEXT_PUBLIC_` variable name and the first browser-visible consumer paths that still rely on it.",
      "Remove the sensitive public naming path from repo-visible env files and client code without silently re-exporting the same value under another public alias.",
      "If the value may already be exposed beyond the repo, record rotation or external follow-up explicitly instead of implying code edits alone close the blocker."
    ],
    exactFileInspectionTargets: inspectFiles,
    promptPack: [
      {
        label: "diagnose-and-contain",
        intent: "Use this first to trace the sensitive public env path and contain the browser dependency without expanding the change into a broad config rewrite.",
        prompt: buildEnv002Prompt(result, finding, signals, files)
      },
      {
        label: "verify-after-containment",
        intent: "Use this after a narrow change to confirm the public-sensitive variable path is gone and to record any remaining rotation or external follow-up.",
        prompt: buildBlockerVerificationPrompt(
          result,
          finding,
          inspectFiles,
          verificationChecklist,
          "Confirm the sensitive `NEXT_PUBLIC_` path is gone from repo-visible env files and client code, and call out any remaining rotation or off-repo cleanup instead of implying total closure."
        )
      }
    ],
    verificationChecklist,
    uncertaintyEscalationNote: "Do not present env renaming alone as full remediation if browser consumers, deployed values, or already-exposed secrets may still need follow-up. If repo-visible evidence is incomplete, stop after containment and say what remains uncertain."
  };
}

function buildSb002BlockerResponsePack(
  result: ScanResult,
  finding: Finding,
  signals: ProjectSignals
): BlockerResponsePack {
  const inspectFiles = buildSb002InspectFiles(finding, signals);
  const verificationChecklist = buildSb002VerificationChecklist();

  return {
    findingKey: `${finding.ruleId}:${finding.filePath}`,
    ruleId: "SB002",
    title: finding.title,
    filePath: finding.filePath,
    combination: result.stack.combination,
    supportStatus: result.stack.supportStatus,
    blockerBrief: "This finding suggests a browser-reachable Supabase client path is still using a non-public Supabase credential. The immediate goal is to contain that client path and verify that privileged credentials no longer reach browser-side client initialization, not to present a full architectural repair flow.",
    immediateContainmentPriorities: [
      "Identify the first browser-reachable file that still initializes a Supabase client with a non-public credential.",
      "Remove `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SECRET`, or `SUPABASE_DB_PASSWORD` from browser-side Supabase client setup instead of shifting the same credential into another client helper.",
      "If privileged Supabase behavior is still required, move that behavior behind a server-only boundary and record any remaining external follow-up explicitly."
    ],
    exactFileInspectionTargets: inspectFiles,
    promptPack: [
      {
        label: "diagnose-and-contain",
        intent: "Use this first to trace the flagged browser-side Supabase client path and contain the privileged credential without pretending there is one guaranteed repair flow.",
        prompt: buildSb002Prompt(result, finding, signals)
      },
      {
        label: "verify-after-containment",
        intent: "Use this after a narrow change to confirm the browser-side client path no longer carries the non-public Supabase credential and to record any remaining overlap or external follow-up.",
        prompt: buildBlockerVerificationPrompt(
          result,
          finding,
          inspectFiles,
          verificationChecklist,
          "Confirm the browser-reachable Supabase client path no longer initializes with a non-public credential, and call out any remaining `ENV003` overlap, server-side follow-up, or external cleanup instead of implying full closure."
        )
      }
    ],
    verificationChecklist,
    uncertaintyEscalationNote: "Do not claim this blocker is fully resolved if the repo only shows containment of the flagged client setup path. If broader privileged env references, server-only follow-up, or external credential rotation may still be required, say that explicitly and stop there."
  };
}

export function buildBlockerResponsePacks(
  result: Pick<ScanResult, "summary" | "stack" | "findings">,
  signals: ProjectSignals,
  files: ProjectFile[]
): BlockerResponsePack[] {
  if (result.stack.supportStatus !== "supported") {
    return [];
  }

  return result.findings.flatMap((finding) => {
    if (finding.ruleId === "SB001") {
      return [buildSb001BlockerResponsePack(result as ScanResult, finding, signals)];
    }

    if (finding.ruleId === "SB002") {
      return [buildSb002BlockerResponsePack(result as ScanResult, finding, signals)];
    }

    if (finding.ruleId === "ENV002") {
      return [buildEnv002BlockerResponsePack(result as ScanResult, finding, signals, files)];
    }

    return [];
  });
}
