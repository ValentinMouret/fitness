import { AsyncLocalStorage } from "node:async_hooks";

export interface DiagnosticContext {
  readonly requestId: string;
  readonly startedAt: number;
  readonly routeId?: string;
  readonly method?: string;
}
export const diagnosticContext = new AsyncLocalStorage<DiagnosticContext>();
