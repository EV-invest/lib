/**
 * Runs once when the server starts. A missing prod setting, a lead store that
 * cannot open, or SMTP with no sender fails startup — every request, `/health`
 * included, answers 500 and the pod never turns ready — instead of the first
 * customer's submission.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { serverEnv, notifier } = await import("@/shared/config/env");
  const { checkLeadStore } = await import("@evinvest/kitstart/server");
  notifier();
  await checkLeadStore(serverEnv());
}
