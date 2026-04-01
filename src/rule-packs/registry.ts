import type { PackId, RulePackDefinition, StackDetectionResult } from "../types.js";
import { nextJsCoreRules } from "./nextjs-core.js";
import { nextJsSupabaseVercelRules } from "./nextjs-supabase-vercel.js";
import { vercelPackRules } from "./vercel-pack.js";

const registeredRulePacks: RulePackDefinition[] = [
  {
    id: "nextjs-core-v1",
    pack: "nextjs-core",
    rules: nextJsCoreRules
  },
  {
    id: "supabase-pack-v1",
    pack: "supabase-pack",
    rules: nextJsSupabaseVercelRules
  },
  {
    id: "vercel-pack-v1",
    pack: "vercel-pack",
    rules: vercelPackRules
  }
];

export function getRulePackForPack(pack: PackId): RulePackDefinition {
  const rulePack = registeredRulePacks.find((candidate) => candidate.pack === pack);

  if (!rulePack) {
    throw new Error(`No rule pack registered for pack: ${pack}`);
  }

  return rulePack;
}

export function getRulePacksForStack(stack: StackDetectionResult): RulePackDefinition[] {
  const activePacks: PackId[] = ["nextjs-core", ...stack.activePacks];
  return activePacks.map(getRulePackForPack);
}

export function listRegisteredRulePacks(): RulePackDefinition[] {
  return [...registeredRulePacks];
}
