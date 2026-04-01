import { relative } from "node:path";
import type { ProjectFile } from "./types.js";

const CLIENT_PATH_MARKERS = [
  "/client/",
  "/src/client/"
];

const SERVER_ROUTE_MARKERS = [
  "/app/api/",
  "/pages/api/",
  "/src/app/api/",
  "/src/pages/api/"
];

const SENSITIVE_PATH_SEGMENTS = [
  "account",
  "admin",
  "billing",
  "delete",
  "invite",
  "member",
  "members",
  "org",
  "organization",
  "private",
  "settings",
  "team",
  "update"
];

export function normalizeForMatch(filePath: string): string {
  return `/${filePath.replaceAll("\\", "/")}`;
}

function isClientCodeFile(filePath: string): boolean {
  return /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/.test(filePath);
}

export function isClientReachableFile(file: ProjectFile): boolean {
  const path = normalizeForMatch(file.path);
  const hasUseClientDirective = /^\s*['"]use client['"]/m.test(file.content);
  const hasClientFileName = /\.client\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file.path);

  if (!isClientCodeFile(file.path)) {
    return false;
  }

  if (path.includes("/pages/api/") || path.includes("/app/api/") || path.includes("/src/pages/api/") || path.includes("/src/app/api/")) {
    return false;
  }

  return CLIENT_PATH_MARKERS.some((marker) => path.includes(marker)) || hasUseClientDirective || hasClientFileName;
}

export function isServerRouteFile(file: ProjectFile): boolean {
  const path = normalizeForMatch(file.path);
  return SERVER_ROUTE_MARKERS.some((marker) => path.includes(marker));
}

export function isServerActionFile(file: ProjectFile): boolean {
  return /^\s*['"]use server['"]/m.test(file.content);
}

export function isEnvFile(filePath: string): boolean {
  return /(^|\/)\.env(\.|$)/.test(filePath);
}

export function hasAuthSignal(content: string): boolean {
  const authSignals = [
    "auth.getUser(",
    "auth.getSession(",
    "auth.getClaims(",
    "getUser(",
    "getSession(",
    "requireAuth(",
    "requireUser(",
    "assertAuthenticated(",
    "verifyAuth(",
    "validateSession(",
    "getServerSession("
  ];

  return authSignals.some((signal) => content.includes(signal));
}

export function hasSensitiveAction(content: string): boolean {
  const sensitivePatterns = [
    /\.from\([\s\S]{0,120}?\)\s*\.\s*delete\(/,
    /\.from\([\s\S]{0,120}?\)\s*\.\s*update\(/,
    /\.from\([\s\S]{0,120}?\)\s*\.\s*upsert\(/,
    /\.from\([\s\S]{0,120}?\)\s*\.\s*insert\(/,
    /createUser\(/,
    /deleteUser\(/,
    /admin\./,
    /service_role/i,
    /storage\.from\(/
  ];

  return sensitivePatterns.some((pattern) => pattern.test(content));
}

export function hasSensitivePathSignal(filePath: string): boolean {
  const normalized = normalizeForMatch(filePath).toLowerCase();
  return SENSITIVE_PATH_SEGMENTS.some((segment) => normalized.includes(`/${segment}`) || normalized.includes(`-${segment}`));
}

export function relativeTo(rootPath: string, absolutePath: string): string {
  return relative(rootPath, absolutePath).replaceAll("\\", "/");
}

export function countMatches(content: string, regex: RegExp): number {
  return Array.from(content.matchAll(regex)).length;
}
