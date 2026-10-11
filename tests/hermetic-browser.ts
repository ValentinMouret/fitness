/**
 * Browsers under test reach only this machine. An external request (fonts,
 * analytics) fails at once instead of stalling the page's load event.
 */
export const hermeticLaunchOptions = {
  args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
};
