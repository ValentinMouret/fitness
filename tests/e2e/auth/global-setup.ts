import type { FullConfig } from "@playwright/test";

export default async function requireExistingServer(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("Auth tests require a baseURL");
  try {
    const response = await fetch(new URL("/login", baseURL), {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 200)
      throw new Error(`Login returned HTTP ${response.status}`);
  } catch (cause) {
    throw new Error(
      `Auth E2E requires an existing Fitness test server at ${baseURL}. Set TEST_PORT or E2E_BASE_URL to match it. This runner never starts a server.`,
      { cause },
    );
  }
}
