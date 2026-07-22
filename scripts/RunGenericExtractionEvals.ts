import { resolve } from "node:path";

import { command, flag, option, oneOf, optional, run, string } from "cmd-ts";

import { getEnvironment } from "../src/config/Environment.js";
import { createLogger } from "../src/shared/Logger.js";
import {
  filterEvaluationSuite,
  loadEvaluationSuite,
} from "./generic-extraction-evals/EvalConfig.js";
import {
  runEvaluationSuite,
  type EvaluationSuiteReport,
} from "./generic-extraction-evals/EvalRunner.js";

const cli = command({
  name: "evals:generic",
  description: "Run generic extraction evaluation suites",
  args: {
    config: option({
      long: "config",
      type: string,
      description: "Path to the evaluation suite JSON",
    }),
    output: option({ long: "output", type: optional(string), description: "Output directory" }),
    filter: option({
      long: "filter",
      type: optional(string),
      description: "Case-insensitive text filter for evaluation descriptions",
    }),
    scaffold: flag({
      long: "scaffold",
      description: "Populate empty expected JSON files with successful actual results",
    }),
    reporter: option({
      long: "reporter",
      type: oneOf(["default"] as const),
      defaultValue: () => "default" as const,
      description: "Reporter to use",
    }),
  },
  handler: async ({ config, output, filter, scaffold }) => {
    const suite = await loadEvaluationSuite(config, { allowEmptyExpected: scaffold });
    const filteredSuite = filter ? filterEvaluationSuite(suite, filter) : suite;
    if (filteredSuite.cases.length === 0) {
      throw new Error(`No evaluations matched filter: ${filter ?? ""}`);
    }
    const environment = getEnvironment();
    const logger = createLogger(environment);
    const outputDirectory = output
      ? resolve(output)
      : resolve(suite.configDirectory, "eval-results");
    const report = await runEvaluationSuite(
      filteredSuite,
      environment,
      logger,
      outputDirectory,
      scaffold,
    );
    reportDefault(report);
    process.exitCode = report.cases.every(
      (evaluationCase) =>
        evaluationCase.status === "pass" || evaluationCase.status === "scaffolded",
    )
      ? 0
      : 1;
  },
});

try {
  await run(cli, process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function reportDefault(report: EvaluationSuiteReport): void {
  console.log(`Suite: ${report.suiteName} (${String(report.cases.length)} cases)`);
  for (const evaluationCase of report.cases) {
    const cost =
      evaluationCase.costUsd === undefined ? "n/a" : `$${evaluationCase.costUsd.toFixed(6)}`;
    const suffix =
      evaluationCase.status === "error" && evaluationCase.errorMessage
        ? ` — ${evaluationCase.errorMessage}`
        : ` — ${evaluationCase.outputDirectory}`;
    console.log(
      `${evaluationCase.status.toUpperCase().padEnd(5)} ${evaluationCase.description} [cost: ${cost}]${suffix}`,
    );
  }
  const missing =
    report.missingCostCount > 0 ? `; ${String(report.missingCostCount)} without cost data` : "";
  console.log(
    `\nPassed: ${String(report.cases.filter((evaluationCase) => evaluationCase.status === "pass").length)}, ` +
      `scaffolded: ${String(report.cases.filter((evaluationCase) => evaluationCase.status === "scaffolded").length)}, ` +
      `failed: ${String(report.cases.filter((evaluationCase) => evaluationCase.status === "fail").length)}, ` +
      `errors: ${String(report.cases.filter((evaluationCase) => evaluationCase.status === "error").length)}, ` +
      `known cost: $${report.knownCostUsd.toFixed(6)}${missing}, elapsed: ${String(report.elapsedMs)}ms`,
  );
}
