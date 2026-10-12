type ReportExtra = {
  tags?: Record<string, string>;
};

type ErrorReporter = {
  captureException: (error: unknown) => void;
  captureMessage: (message: string, extra?: ReportExtra) => void;
};

let reporter: ErrorReporter | null = null;

export function registerErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function reportUnhandled(error: unknown): void {
  reporter?.captureException(error);
}

/** Code only. Callers must not pass journal values or raw database messages. */
export function reportSupabaseFailure(code: string): void {
  reporter?.captureMessage('supabase_failure', {
    tags: { supabase_code: code },
  });
}
