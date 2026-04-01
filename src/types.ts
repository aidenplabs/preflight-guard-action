export type Severity = "Blocker" | "High" | "Medium";

export type Confidence = "confirmed" | "likely" | "review-needed";

export type Category = "stack-detection" | "supabase-auth" | "firebase-auth-config" | "clerk-auth-config" | "env-secrets-config";

export type ProfileId = "nextjs-core";

export type PackId = "nextjs-core" | "supabase-pack" | "vercel-pack";

export type CombinationId =
  | "nextjs-core"
  | "nextjs-core+supabase-pack"
  | "nextjs-core+vercel-pack"
  | "nextjs-core+supabase-pack+vercel-pack";

export type ProfileSupportStatus = "supported" | "review-only";

export type ComponentConfidence = "high" | "medium" | "low";

export type ProfileFit = "strong-match" | "partial-match" | "weak-match";

export type RecommendationBasis =
  | "clean-supported-scan"
  | "blocker-findings"
  | "review-findings"
  | "elevated-review-findings"
  | "insufficient-supported-confidence"
  | "confirmed-blocker-findings"
  | "multiple-high-findings";

export interface ProjectFile {
  path: string;
  absolutePath: string;
  content: string;
}

export interface StackSignal {
  signal: string;
  evidence: string;
}

export interface StackComponent {
  name: "Next.js" | "Supabase" | "Firebase" | "Clerk" | "Vercel";
  detected: boolean;
  confidence: ComponentConfidence;
  score: number;
  maxScore: number;
  signals: StackSignal[];
}

export interface StackDetectionResult {
  profile: ProfileId;
  activePacks: PackId[];
  combination: CombinationId;
  combinationLabel: string;
  supportedCombination: boolean;
  supportStatus: ProfileSupportStatus;
  overallConfidence: ComponentConfidence;
  profileFit: ProfileFit;
  components: StackComponent[];
  summary: string;
}

export interface ProjectSignals {
  envFiles: string[];
  middlewareFiles: string[];
  nextRouteFiles: string[];
  apiRouteFiles: string[];
  serverActionFiles: string[];
  clientFiles: string[];
  supabaseFiles: string[];
  firebaseFiles: string[];
  clerkFiles: string[];
  vercelFiles: string[];
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  category: Category;
  filePath: string;
  explanation: string;
  whyItMatters: string;
  minimumFix: string;
  evidence?: string[];
}

export interface AiHandoffPrompt {
  promptVersion: "1";
  findingKey: string;
  ruleId: string;
  title: string;
  combination: string;
  supportStatus: ProfileSupportStatus;
  prompt: string;
}

export interface ExecutionPackPrompt {
  label: string;
  intent: string;
  prompt: string;
}

export interface ExecutionPack {
  findingKey: string;
  ruleId: "SB003" | "SB004";
  title: string;
  filePath: string;
  combination: string;
  supportStatus: ProfileSupportStatus;
  repairBrief: string;
  orderedFixSteps: string[];
  promptPack: ExecutionPackPrompt[];
  verificationChecklist: string[];
  safeFixGuidance: string[];
  riskyFixGuidance: string[];
}

export interface BlockerResponsePackPrompt {
  label: string;
  intent: string;
  prompt: string;
}

export interface BlockerResponsePack {
  findingKey: string;
  ruleId: "SB001" | "SB002" | "ENV002";
  title: string;
  filePath: string;
  combination: string;
  supportStatus: ProfileSupportStatus;
  blockerBrief: string;
  immediateContainmentPriorities: string[];
  exactFileInspectionTargets: string[];
  promptPack: BlockerResponsePackPrompt[];
  verificationChecklist: string[];
  uncertaintyEscalationNote: string;
}

export interface RuleContext {
  rootPath: string;
  files: ProjectFile[];
  stack: StackDetectionResult;
  signals: ProjectSignals;
}

export interface Rule {
  id: string;
  title: string;
  category: Exclude<Category, "stack-detection">;
  run: (context: RuleContext) => Finding[];
}

export interface RulePackDefinition {
  id: string;
  pack: PackId;
  rules: Rule[];
}

export interface ProjectSummary {
  scannedPath: string;
  scannedAt: string;
  fileCount: number;
}

export interface ScanResult {
  schemaVersion: "1";
  summary: ProjectSummary;
  stack: StackDetectionResult;
  findings: Finding[];
  aiHandoffs: AiHandoffPrompt[];
  executionPacks: ExecutionPack[];
  blockerResponsePacks: BlockerResponsePack[];
  shipRecommendation: "yes" | "caution" | "no";
  recommendationBasis: RecommendationBasis;
  recommendationSummary: string;
  limitations: string[];
  exitCode: number;
}
