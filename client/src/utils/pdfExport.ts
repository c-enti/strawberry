export interface ExportToPDFOptions {
  year: number;
  selectedMonths: string[];
  events: Array<{ date: string; title: string }>;
  backgroundUrl?: string;
}

// TODO: Implement PDF export logic (Phase 2)
// Parameters are defined but implementation is deferred
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function exportToPDF(options: ExportToPDFOptions) {
  // Placeholder: Implementation coming in Phase 2
  return Promise.resolve();
}
