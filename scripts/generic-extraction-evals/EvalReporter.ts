import type {
  EvaluationCaseReport,
  EvaluationCaseStatus,
  EvaluationProgressEvent,
  EvaluationSuiteReport,
} from "./EvalRunner.js";

const MAX_VALUE_LENGTH = 120;

type ReporterOptions = Readonly<{
  isTTY?: boolean;
  noColor?: boolean;
  write?: (text: string) => void;
}>;

type Reporter = Readonly<{
  onProgress: (event: EvaluationProgressEvent) => void;
  report: (report: EvaluationSuiteReport) => void;
}>;

const ansi = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
};

export function createDefaultReporter(options: ReporterOptions = {}): Reporter {
  const isTTY = options.isTTY ?? process.stdout.isTTY;
  const useColor = isTTY && options.noColor !== true && !Object.hasOwn(process.env, "NO_COLOR");
  const write = options.write ?? ((text: string) => process.stdout.write(text));
  let completed = 0;
  let total = 0;
  const counts = emptyCounts();
  let progressShown = false;

  return {
    onProgress(event) {
      if (event.type === "caseStarted") {
        total = event.total;
        if (isTTY) {
          write(
            `\r\u001b[2K${style("Running", ansi.cyan, useColor)} ${String(event.index + 1)}/${String(total)} · ${formatCounts(counts)}`,
          );
          progressShown = true;
        } else {
          write(`START ${String(event.index + 1)}/${String(event.total)} ${event.description}\n`);
        }
        return;
      }

      completed += 1;
      counts[event.report.status] += 1;
      if (isTTY) {
        write(
          `\r\u001b[2K${style("Running", ansi.cyan, useColor)} ${String(completed)}/${String(total)} · ${formatCounts(counts)}`,
        );
        progressShown = true;
      } else {
        write(
          `${statusLabel(event.report.status)} ${event.report.description} (${formatDuration(event.report.elapsedMs)})\n`,
        );
      }
    },
    report(report) {
      write(`${progressShown ? "\r\u001b[2K" : ""}${renderReport(report, useColor)}`);
    },
  };
}

export function renderReport(report: EvaluationSuiteReport, useColor = false): string {
  const lines = [`Suite: ${report.suiteName} (${String(report.cases.length)} cases)`, ""];
  for (const evaluationCase of report.cases) {
    lines.push(renderCase(evaluationCase, useColor));
  }

  const counts = countCases(report.cases);
  lines.push(
    `Summary\n` +
      `  passed: ${style(String(counts.pass), ansi.green, useColor)}  ` +
      `scaffolded: ${style(String(counts.scaffolded), ansi.yellow, useColor)}  ` +
      `failed: ${style(String(counts.fail), ansi.red, useColor)}  ` +
      `errors: ${style(String(counts.error), ansi.red, useColor)}\n` +
      `  matched: ${String(report.comparison.matched)}  ` +
      `mismatched: ${String(report.comparison.mismatched)}  ` +
      `mismatch: ${formatPercentage(report.comparison.mismatchPercentage)}\n` +
      `  elapsed: ${formatDuration(report.elapsedMs)}  known cost: $${report.knownCostUsd.toFixed(6)}` +
      (report.missingCostCount > 0 ? `  missing cost: ${String(report.missingCostCount)}` : ""),
  );
  return `${lines.join("\n")}\n`;
}

export function renderCase(evaluationCase: EvaluationCaseReport, useColor = false): string {
  const cost =
    evaluationCase.costUsd === undefined ? "n/a" : `$${evaluationCase.costUsd.toFixed(6)}`;
  const lines = [
    `${style(statusLabel(evaluationCase.status), statusColor(evaluationCase.status), useColor)}  ${evaluationCase.description}`,
    `  elapsed: ${formatDuration(evaluationCase.elapsedMs)}  cost: ${cost}`,
  ];
  if (evaluationCase.comparison) {
    lines.push(
      `  matched: ${String(evaluationCase.comparison.matched)}  ` +
        `mismatched: ${String(evaluationCase.comparison.mismatched)}  ` +
        `mismatch: ${formatPercentage(evaluationCase.comparison.mismatchPercentage)}`,
    );
  }

  if (evaluationCase.status === "fail" && evaluationCase.mismatches) {
    lines.push(`  mismatches: ${String(evaluationCase.mismatches.length)}`);
    for (const mismatch of evaluationCase.mismatches) {
      lines.push(`    ${mismatch.path || "<root>"}`);
      lines.push(
        `      expected: ${mismatch.expectedPresent ? formatValue(mismatch.expected) : "n/a"}`,
      );
      lines.push(
        `      actual:   ${mismatch.actualPresent ? formatValue(mismatch.actual) : "n/a"}`,
      );
      lines.push(
        `      confidence: ${mismatch.confidence === undefined ? "n/a" : mismatch.confidence.toFixed(2)}`,
      );
    }
  }
  if (evaluationCase.status === "error" && evaluationCase.errorMessage) {
    lines.push(`  error: ${evaluationCase.errorMessage}`);
  }
  if (evaluationCase.status !== "pass" && evaluationCase.status !== "scaffolded") {
    lines.push(`  artifacts: ${evaluationCase.outputDirectory}`);
  }
  return lines.join("\n");
}

export function formatValue(value: unknown): string {
  const rendered = JSON.stringify(value) || String(value);
  return rendered.length > MAX_VALUE_LENGTH
    ? `${rendered.slice(0, MAX_VALUE_LENGTH - 1)}…`
    : rendered;
}

export function formatDuration(elapsedMs: number): string {
  if (elapsedMs < 1000) return `${String(elapsedMs)}ms`;
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function formatPercentage(percentage: number | null): string {
  return percentage === null ? "n/a" : `${percentage.toFixed(1)}%`;
}

function statusLabel(status: EvaluationCaseStatus): string {
  return status.toUpperCase().padEnd(10);
}

function statusColor(status: EvaluationCaseStatus): string {
  return status === "pass" ? ansi.green : status === "scaffolded" ? ansi.yellow : ansi.red;
}

function style(value: string, color: string, useColor: boolean): string {
  return useColor ? `${color}${value}${ansi.reset}` : value;
}

function emptyCounts(): Record<EvaluationCaseStatus, number> {
  return { pass: 0, fail: 0, scaffolded: 0, error: 0 };
}

function countCases(cases: readonly EvaluationCaseReport[]): Record<EvaluationCaseStatus, number> {
  const counts = emptyCounts();
  for (const evaluationCase of cases) counts[evaluationCase.status] += 1;
  return counts;
}

function formatCounts(counts: Record<EvaluationCaseStatus, number>): string {
  return `${String(counts.pass)} passed · ${String(counts.fail)} failed · ${String(counts.error)} errors`;
}
