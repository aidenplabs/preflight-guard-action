#!/usr/bin/env node
import { runScan } from "./scan.js";
import type { FailOnMode } from "./scan.js";

function printUsage(): void {
  console.log("Usage: preflight scan [target-path] [--output <directory>] [--fail-on <caution|no|never>]");
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (command !== "scan") {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(3);
  }

  let targetPath: string | undefined;
  let outputDirectory: string | undefined;
  let failOn: FailOnMode | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];

    if (value === "--output" || value === "-o") {
      outputDirectory = rest[index + 1];
      index += 1;
      continue;
    }

    if (value === "--fail-on") {
      const next = rest[index + 1];
      if (next === "caution" || next === "no" || next === "never") {
        failOn = next;
        index += 1;
        continue;
      }

      console.error("Invalid value for --fail-on. Use caution, no, or never.");
      process.exit(3);
    }

    if (!targetPath) {
      targetPath = value;
      continue;
    }
  }

  try {
    const scan = await runScan({ targetPath, outputDirectory, failOn });
    console.log(scan.terminalSummary);
    console.log("");
    console.log(`Markdown report: ${scan.markdownPath}`);
    console.log(`JSON report: ${scan.jsonPath}`);
    process.exit(scan.exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan failure";
    console.error(`Scan failed: ${message}`);
    process.exit(3);
  }
}

void main();
