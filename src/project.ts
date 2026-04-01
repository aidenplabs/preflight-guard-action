import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectFile, ProjectSummary } from "./types.js";
import { relativeTo } from "./utils.js";

const MAX_FILE_BYTES = 1024 * 1024;

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "examples",
  "fixtures",
  "node_modules",
  "out"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".env",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

function shouldReadFile(filePath: string): boolean {
  if (filePath === "preflight-report.md" || filePath === "preflight-report.json") {
    return false;
  }

  if (/(^|\/)\.env(\..+)?$/.test(filePath)) {
    return true;
  }

  if (filePath.endsWith(".min.js")) {
    return false;
  }

  for (const extension of ALLOWED_EXTENSIONS) {
    if (filePath.endsWith(extension)) {
      return true;
    }
  }

  return filePath.endsWith("Dockerfile");
}

async function walk(rootPath: string, currentPath: string, output: ProjectFile[]): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await walk(rootPath, absolutePath, output);
      continue;
    }

    const relativePath = relativeTo(rootPath, absolutePath);
    if (!shouldReadFile(relativePath)) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    if (fileStat.size > MAX_FILE_BYTES) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    output.push({
      path: relativePath,
      absolutePath,
      content
    });
  }
}

export async function loadProjectFiles(rootPath: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  await walk(rootPath, rootPath, files);
  return files;
}

export function buildProjectSummary(rootPath: string, fileCount: number): ProjectSummary {
  return {
    scannedPath: rootPath,
    scannedAt: new Date().toISOString(),
    fileCount
  };
}
