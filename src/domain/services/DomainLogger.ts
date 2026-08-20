export interface DomainLogger {
  debug(bindings: Readonly<Record<string, unknown>>, message: string): void;
  error(bindings: Readonly<Record<string, unknown>>, message: string): void;
}
