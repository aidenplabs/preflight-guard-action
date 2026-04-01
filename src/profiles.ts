import type { CombinationId, PackId, ProfileId, ProfileSupportStatus } from "./types.js";

export interface CoreProfileInfo {
  id: ProfileId;
  label: string;
}

export interface PackInfo {
  id: PackId;
  label: string;
}

export interface SupportedCombinationInfo {
  id: CombinationId;
  label: string;
  supportStatus: ProfileSupportStatus;
  activePacks: PackId[];
}

export const CORE_PROFILE: CoreProfileInfo = {
  id: "nextjs-core",
  label: "Next.js Core"
};

export const SUPPORTED_PACKS: PackInfo[] = [
  {
    id: "supabase-pack",
    label: "Supabase Pack"
  },
  {
    id: "vercel-pack",
    label: "Vercel Pack"
  }
];

export const TARGET_COMBINATIONS: SupportedCombinationInfo[] = [
  {
    id: "nextjs-core",
    label: "Next.js",
    supportStatus: "review-only",
    activePacks: []
  },
  {
    id: "nextjs-core+supabase-pack",
    label: "Next.js + Supabase",
    supportStatus: "supported",
    activePacks: ["supabase-pack"]
  },
  {
    id: "nextjs-core+vercel-pack",
    label: "Next.js + Vercel",
    supportStatus: "supported",
    activePacks: ["vercel-pack"]
  },
  {
    id: "nextjs-core+supabase-pack+vercel-pack",
    label: "Next.js + Supabase + Vercel",
    supportStatus: "supported",
    activePacks: ["supabase-pack", "vercel-pack"]
  }
];

export function getCombinationInfo(combinationId: CombinationId): SupportedCombinationInfo {
  const combination = TARGET_COMBINATIONS.find((candidate) => candidate.id === combinationId);

  if (!combination) {
    throw new Error(`Unknown combination: ${combinationId}`);
  }

  return combination;
}

export function getPackInfo(packId: PackId): PackInfo {
  if (packId === "nextjs-core") {
    return { id: "nextjs-core", label: CORE_PROFILE.label };
  }

  const pack = SUPPORTED_PACKS.find((candidate) => candidate.id === packId);

  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }

  return pack;
}
