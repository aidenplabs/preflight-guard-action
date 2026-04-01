import type { Finding, Rule } from "../types.js";
import type { RuleContext } from "../types.js";
import {
  hasAuthSignal,
  hasSensitiveAction,
  hasSensitivePathSignal,
  isClientReachableFile,
  isEnvFile,
  isServerActionFile,
  isServerRouteFile
} from "../utils.js";

function serviceRoleExposureRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];

  for (const file of context.files) {
    if (!isClientReachableFile(file)) {
      continue;
    }

    const hasDirectServiceRoleEnv = /process\.env\.SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(file.content);
    const hasSuspiciousServiceRoleClientSetup = /service_role/i.test(file.content) && /createClient\(|createBrowserClient\(|createPagesBrowserClient\(/.test(file.content);

    if (!hasDirectServiceRoleEnv && !hasSuspiciousServiceRoleClientSetup) {
      continue;
    }

    findings.push({
      ruleId: "SB001",
      title: "Possible Supabase service role exposure in client-reachable code",
      severity: "Blocker",
      confidence: hasDirectServiceRoleEnv ? "confirmed" : "likely",
      category: "supabase-auth",
      filePath: file.path,
      explanation: hasDirectServiceRoleEnv
        ? "This file looks browser-reachable and directly references `SUPABASE_SERVICE_ROLE_KEY`."
        : "This file looks browser-reachable and appears to combine `service_role` usage with browser-side Supabase client setup.",
      whyItMatters: "A leaked service role key can bypass normal client restrictions and expose privileged database or admin access.",
      minimumFix: "Move service role usage to trusted server-only code and keep the key in a non-public server environment variable.",
      evidence: hasDirectServiceRoleEnv
        ? ["Client-reachable file references `SUPABASE_SERVICE_ROLE_KEY` directly."]
        : ["Client-reachable file combines `service_role` text with browser-side Supabase client setup."]
    });
  }

  return findings;
}

function suspiciousSupabaseClientKeyRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];

  for (const file of context.files) {
    if (!isClientReachableFile(file)) {
      continue;
    }

    const usesSupabaseClient = /createClient\(|createBrowserClient\(|createPagesBrowserClient\(/.test(file.content);
    const usesNonPublicEnv = /process\.env\.(SUPABASE_SECRET|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN)/.test(file.content);

    if (!usesSupabaseClient || !usesNonPublicEnv) {
      continue;
    }

    findings.push({
      ruleId: "SB002",
      title: "Privileged non-public Supabase credential used in browser-reachable client setup",
      severity: "Blocker",
      confidence: "likely",
      category: "supabase-auth",
      filePath: file.path,
      explanation: "A browser-reachable file appears to initialize a Supabase client with a non-public Supabase credential.",
      whyItMatters: "Browser-side Supabase code should normally use public URL and anon key values only. Non-public Supabase credentials in that client path can expose privileged access.",
      minimumFix: "Use only public anon credentials in browser code and move privileged Supabase operations behind server-only code paths.",
      evidence: [
        "Browser-reachable file creates a Supabase client.",
        "The same file references a non-public Supabase credential env value."
      ]
    });
  }

  return findings;
}

function sensitiveRouteWithoutAuthRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];

  for (const file of context.files) {
    const serverSide = isServerRouteFile(file) || isServerActionFile(file);
    if (!serverSide) {
      continue;
    }

    const hasSensitiveContentSignal = hasSensitiveAction(file.content);
    const hasSensitivePath = hasSensitivePathSignal(file.path);
    const hasAuth = hasAuthSignal(file.content);

    if ((!hasSensitiveContentSignal && !hasSensitivePath) || hasAuth) {
      continue;
    }

    const evidence = [];
    if (hasSensitiveContentSignal) {
      evidence.push("Server-side file contains mutation or privileged-action keywords.");
    }
    if (hasSensitivePath) {
      evidence.push("Route or action path looks sensitive.");
    }
    if (context.signals.middlewareFiles.length > 0) {
      evidence.push(`Project has middleware files (${context.signals.middlewareFiles.join(", ")}), but middleware was not treated as proof that this route is protected.`);
    } else {
      evidence.push("No explicit auth signal was found in this file.");
    }

    findings.push({
      ruleId: "SB003",
      title: "Sensitive route or server action may be missing an auth check",
      severity: hasSensitiveContentSignal && hasSensitivePath ? "High" : "Medium",
      confidence: hasSensitiveContentSignal && hasSensitivePath ? "likely" : "review-needed",
      category: "supabase-auth",
      filePath: file.path,
      explanation: "This server-side file looks sensitive, but the tool did not find a clear local auth guard or user validation inside it.",
      whyItMatters: "Delete, update, admin, storage, invite, and billing flows often need explicit access control. Missing checks can expose data or privileged actions.",
      minimumFix: "Review the handler or action and add a clear auth guard before sensitive work if one is actually missing.",
      evidence
    });
  }

  return findings;
}

function weakRlsSignalsRule(context: RuleContext): Finding[] {
  const supabaseComponent = context.stack.components.find((component) => component.name === "Supabase");
  const hasSupabaseFolder = context.signals.supabaseFiles.some((filePath) => filePath.startsWith("supabase/"));

  if (!supabaseComponent?.detected) {
    return [];
  }

  if (supabaseComponent.confidence === "low") {
    return [];
  }

  if (!hasSupabaseFolder && supabaseComponent.confidence !== "high") {
    return [];
  }

  const sqlFiles = context.files.filter((file) => file.path.startsWith("supabase/") && file.path.endsWith(".sql"));
  const hasRlsSignal = sqlFiles.some((file) => /enable row level security|create policy|alter table .* enable row level security/i.test(file.content));

  if (hasRlsSignal) {
    return [];
  }

  const relatedFile = hasSupabaseFolder
    ? "supabase/"
    : context.files.some((file) => file.path === "package.json")
      ? "package.json"
      : context.signals.supabaseFiles.find((filePath) => !isEnvFile(filePath)) ?? context.signals.supabaseFiles[0] ?? "package.json";

  return [
    {
      ruleId: "SB004",
      title: "Supabase detected without clear RLS policy signals",
      severity: "Medium",
      confidence: "review-needed",
      category: "supabase-auth",
      filePath: relatedFile,
      explanation: "Supabase usage was detected, but the repo does not show obvious migration or SQL policy signals for row level security.",
      whyItMatters: "Many fast-built Supabase apps rely on RLS for data isolation. Missing policies can leave tables more open than intended.",
      minimumFix: "Review your Supabase tables and policies. Add migrations or SQL policy files so RLS expectations are explicit and versioned.",
      evidence: [
        `Supabase confidence: ${supabaseComponent.confidence}.`,
        sqlFiles.length === 0 ? "No Supabase SQL migration files were found." : "Supabase SQL files were found, but none showed clear RLS or policy statements."
      ]
    }
  ];
}

function hardcodedSecretsRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];
  const secretRegex = /\b(?:api[_-]?key|secret|token|password|service[_-]?role[_-]?key)\b\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i;

  for (const file of context.files) {
    if (/(^|\/)\.env\.example$|(^|\/)\.env\.sample$|example|sample/i.test(file.path)) {
      continue;
    }

    if (!secretRegex.test(file.content)) {
      continue;
    }

    findings.push({
      ruleId: "ENV001",
      title: "Possible hardcoded secret or token in source",
      severity: "High",
      confidence: "likely",
      category: "env-secrets-config",
      filePath: file.path,
      explanation: "This file contains a secret-like identifier assigned directly to a long string literal.",
      whyItMatters: "Hardcoded credentials are easy to leak through commits, logs, screenshots, or client bundles.",
      minimumFix: "Move the value to a server-only environment variable or secret manager and rotate it if it was real.",
      evidence: ["A secret-like variable name is assigned directly to a long string literal."]
    });
  }

  return findings;
}

function suspiciousNextPublicRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];
  const sensitiveNameRegex = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|SERVICE_ROLE|ACCESS_KEY|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_URL)[A-Z0-9_]*/g;
  const envDefinedNames = new Set<string>();

  for (const file of context.files) {
    if (!isEnvFile(file.path)) {
      continue;
    }

    const matches = file.content.match(sensitiveNameRegex);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      envDefinedNames.add(match);
    }
  }

  for (const file of context.files) {
    if (!isEnvFile(file.path) && !/process\.env\.NEXT_PUBLIC_/.test(file.content)) {
      continue;
    }

    const matches = file.content.match(sensitiveNameRegex);
    if (!matches) {
      continue;
    }

    const uniqueMatches = Array.from(new Set(matches));
    const directEnvDefinition = isEnvFile(file.path);
    const hasServiceRoleName = uniqueMatches.some((match) => match.includes("SERVICE_ROLE"));

    if (!directEnvDefinition && uniqueMatches.every((match) => envDefinedNames.has(match))) {
      continue;
    }

    findings.push({
      ruleId: "ENV002",
      title: "Sensitive-looking value exposed through NEXT_PUBLIC_ naming",
      severity: directEnvDefinition && hasServiceRoleName ? "Blocker" : "High",
      confidence: directEnvDefinition && hasServiceRoleName ? "confirmed" : "likely",
      category: "env-secrets-config",
      filePath: file.path,
      explanation: directEnvDefinition && hasServiceRoleName
        ? `An env file directly defines public sensitive-looking names: ${uniqueMatches.join(", ")}.`
        : `Found public environment variable names that look sensitive: ${uniqueMatches.join(", ")}.`,
      whyItMatters: "Variables prefixed with NEXT_PUBLIC_ are exposed to the browser bundle. Sensitive values should not use that prefix.",
      minimumFix: "Rename the variable to a server-only name, update code paths that consume it, and rotate the secret if it was already exposed.",
      evidence: directEnvDefinition && hasServiceRoleName
        ? ["A `NEXT_PUBLIC_*SERVICE_ROLE*` variable is defined directly in an env file, which is a strong signal of accidental public exposure."]
        : ["This is a naming-based heuristic, not proof that the value is real or active."]
    });
  }

  return findings;
}

function accidentalPrivilegedEnvExposureRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];
  const privilegedEnvRegex = /process\.env\.(SUPABASE_SERVICE_ROLE_KEY|[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY))/g;

  for (const file of context.files) {
    if (!isClientReachableFile(file)) {
      continue;
    }

    const matches = file.content.match(privilegedEnvRegex);
    if (!matches) {
      continue;
    }

    findings.push({
      ruleId: "ENV003",
      title: "Privileged environment value referenced in client-reachable code",
      severity: "High",
      confidence: "likely",
      category: "env-secrets-config",
      filePath: file.path,
      explanation: `This browser-reachable file references non-public environment values: ${Array.from(new Set(matches)).join(", ")}.`,
      whyItMatters: "Client code should not depend on privileged secrets. Even if bundling removes some values, the pattern is risky and easy to misuse later.",
      minimumFix: "Move privileged env access into server-only code and expose only minimal safe data to the client.",
      evidence: ["Client-reachable code reads env names that look non-public or privileged."]
    });
  }

  return findings;
}

function wildcardCorsRule(context: RuleContext): Finding[] {
  const findings: Finding[] = [];

  for (const file of context.files) {
    const isServerSide = isServerRouteFile(file) || isServerActionFile(file);
    if (!isServerSide) {
      continue;
    }

    if (!/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*["']|access-control-allow-origin["']\s*,\s*["']\*["']/i.test(file.content)) {
      continue;
    }

    const hasSensitiveSignal = hasSensitiveAction(file.content) || hasSensitivePathSignal(file.path);

    findings.push({
      ruleId: "ENV004",
      title: "Wildcard CORS found in server-side handler",
      severity: hasSensitiveSignal ? "High" : "Medium",
      confidence: "review-needed",
      category: "env-secrets-config",
      filePath: file.path,
      explanation: "This server-side file appears to allow `*` for `Access-Control-Allow-Origin`.",
      whyItMatters: "Wildcard CORS can widen who can call your endpoints. Some routes are fine with it, but sensitive routes usually are not.",
      minimumFix: "Review whether the route really needs wildcard access. Restrict origins when the endpoint handles authenticated or sensitive behavior.",
      evidence: hasSensitiveSignal
        ? ["Wildcard CORS appears on a route that also looks sensitive."]
        : ["Wildcard CORS was found, but the tool cannot confirm whether the route is intentionally public."]
    });
  }

  return findings;
}

export const nextJsSupabaseVercelRules: Rule[] = [
  { id: "SB001", title: "Possible Supabase service role exposure in client-reachable code", category: "supabase-auth", run: serviceRoleExposureRule },
  { id: "SB002", title: "Suspicious privileged Supabase key usage in browser-reachable client setup", category: "supabase-auth", run: suspiciousSupabaseClientKeyRule },
  { id: "SB003", title: "Sensitive route or server action may be missing an auth check", category: "supabase-auth", run: sensitiveRouteWithoutAuthRule },
  { id: "SB004", title: "Supabase detected without clear RLS policy signals", category: "supabase-auth", run: weakRlsSignalsRule },
  { id: "ENV001", title: "Possible hardcoded secret or token in source", category: "env-secrets-config", run: hardcodedSecretsRule },
  { id: "ENV002", title: "Sensitive-looking value exposed through NEXT_PUBLIC_ naming", category: "env-secrets-config", run: suspiciousNextPublicRule },
  { id: "ENV003", title: "Privileged environment value referenced in client-reachable code", category: "env-secrets-config", run: accidentalPrivilegedEnvExposureRule },
  { id: "ENV004", title: "Wildcard CORS found in server-side handler", category: "env-secrets-config", run: wildcardCorsRule }
];
