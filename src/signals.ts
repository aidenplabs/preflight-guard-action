import type { ProjectFile, ProjectSignals } from "./types.js";
import { isClientReachableFile, isServerActionFile, isServerRouteFile } from "./utils.js";

function isLockfile(path: string): boolean {
  return /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/.test(path);
}

export function collectProjectSignals(files: ProjectFile[]): ProjectSignals {
  return {
    envFiles: files.filter((file) => file.path.startsWith(".env")).map((file) => file.path),
    middlewareFiles: files.filter((file) => /(^|\/)middleware\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)).map((file) => file.path),
    nextRouteFiles: files.filter((file) => /^(app|pages|src\/app|src\/pages)\//.test(file.path)).map((file) => file.path),
    apiRouteFiles: files.filter((file) => isServerRouteFile(file)).map((file) => file.path),
    serverActionFiles: files.filter((file) => isServerActionFile(file)).map((file) => file.path),
    clientFiles: files.filter((file) => isClientReachableFile(file)).map((file) => file.path),
    supabaseFiles: files
      .filter((file) => (file.path.startsWith("supabase/")
        || /@supabase\/supabase-js|SUPABASE_URL|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE_KEY/.test(file.content))
        && !isLockfile(file.path))
      .map((file) => file.path),
    firebaseFiles: files
      .filter((file) => file.path === "firebase.json"
        || file.path === ".firebaserc"
        || (/firebase-admin|firebase\/app|firebase\/auth|firebase\/firestore|FIREBASE_|NEXT_PUBLIC_FIREBASE_|GOOGLE_APPLICATION_CREDENTIALS/.test(file.content)
          && !isLockfile(file.path)))
      .map((file) => file.path),
    clerkFiles: [],
    vercelFiles: files
      .filter((file) => file.path === "vercel.json"
        || (/process\.env\.VERCEL|VERCEL_URL|@vercel\//.test(file.content) && !isLockfile(file.path)))
      .map((file) => file.path)
  };
}
