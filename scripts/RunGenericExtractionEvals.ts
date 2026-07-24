import { resolve } from "node:path";

import { command, flag, option, oneOf, optional, run, string } from "cmd-ts";

import { getEnvironment } from "../src/config/Environment.js";
import { createLogger } from "../src/shared/Logger.js";
import {
  filterEvaluationSuite,
  loadEvaluationSuite,
} from "./generic-extraction-evals/EvalConfig.js";
import { runEvaluationSuite } from "./generic-extraction-evals/EvalRunner.js";
import { createDefaultReporter } from "./generic-extraction-evals/EvalReporter.js";

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
    const defaultReporter = createDefaultReporter();
    const report = await runEvaluationSuite(
      filteredSuite,
      environment,
      logger,
      outputDirectory,
      scaffold,
      defaultReporter.onProgress,
    );
    defaultReporter.report(report);
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
