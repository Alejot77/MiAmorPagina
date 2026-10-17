// Guarda la version de este despliegue en lib/version.json antes de compilar.
// La app y /api/version la importan, asi las dos quedan con el mismo valor
// fijo y la app instalada sabe cuando hay una version nueva.
import { writeFileSync } from "node:fs";

const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `local-${Date.now()}`;
writeFileSync(new URL("../lib/version.json", import.meta.url), JSON.stringify({ version }) + "\n");
console.log(`version: ${version}`);
