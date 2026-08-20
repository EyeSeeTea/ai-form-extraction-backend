# Generic extraction evaluations

Run a config-driven suite of generic form extractions directly through `GenericExtractFormUseCase`:

```bash
yarn evals:generic --config ./evals/example-suite/suite.json
```

The utility runs cases sequentially, continues after failures, and exits with code `0` only when every case passes. It does not create jobs or initialize the application database.

## Configuration

The configuration file must contain a non-empty `name` and at least one evaluation case. Extraction properties can be declared at the suite level and overridden per case:

```json
{
  "name": "Example extraction",
  "form": "example-form",
  "profile": "default",
  "prompt": "./prompts/default.txt",
  "outputSchema": "./schemas/output-schema.json",
  "expected": "./expected/sample-a.json",
  "files": ["./documents/sample-a.pdf"],
  "evals": [
    {
      "description": "Sample A"
    },
    {
      "description": "Sample B with custom prompt",
      "prompt": "./prompts/special-case.txt",
      "files": ["./documents/sample-b.pdf"]
    }
  ]
}
```

Supported properties are:

- `name`: suite name.
- `description`: required case description.
- `form`: optional extraction label; defaults to `generic`.
- `profile`: optional valid extraction profile; defaults to `default`.
- `prompt`: path to a UTF-8 prompt text file.
- `outputSchema`: path to a JSON object schema.
- `expected`: path to the expected JSON result.
- `files`: one or more document paths.

All paths inside the suite are resolved relative to the configuration file. The `--config` argument itself is resolved relative to the current working directory. A case must have `prompt`, `outputSchema`, `expected`, and `files` after suite-level defaults are applied.

The configuration is validated before the first case runs. This includes checking referenced files, validating the output schema, and validating each expected result against that schema. Unknown configuration properties, duplicate descriptions, and empty suites are rejected.

Documents may be one PDF or one or more JPEG/JPG pages. Files are staged through the same upload validation used by the backend and removed from temporary storage after each case.

## Output

By default, artifacts are written relative to the configuration file:

```text
<config-directory>/eval-results/<run-iso-timestamp>/<suite-name>/<case-name>-<stable-id>/
```

Each execution gets a new UTC ISO 8601 timestamp directory, so previous runs remain available for comparison. Use `--output` to choose another root. Explicit `--output` paths are resolved relative to the current working directory.

Each case directory contains:

- `actual.json`: the extraction result.
- `expected.json`: the expected result copied from the suite input.
- `diagnostics.json`: provider, model, warnings, quality, usage, and response metadata from the use case.

The run directory also contains `summary.json` with the UTC run timestamp, elapsed time, cost totals, status counts, and a compact status entry for each case.

If extraction fails, `diagnostics.json` contains:

```json
{
  "status": "error",
  "message": "..."
}
```

Actual and expected results are compared structurally. Object key order does not matter; array order and JSON value types do matter. The comparison excludes diagnostics and use-case metadata.

## Reporting and cost

The default reporter prints one `PASS`, `FAIL`, or `ERROR` line per case, including the case cost when the provider reports `usage.costUsd`. Missing costs are shown as `n/a`; the total includes only known costs.

## Scaffolding expected results

For a new suite, use `--scaffold` to populate empty expected files from successful extraction results:

```bash
yarn evals:generic \
  --config ./evals/example-suite/suite.json \
  --scaffold
```

Scaffold mode accepts an expected file only when it contains `{}`. After a successful case, it writes the actual result into that case’s configured expected file and reports the case as `SCAFFOLDED`. Failed cases leave their placeholders unchanged. Non-empty expected files continue to use strict schema validation and are never overwritten.

The reporter option is reserved for future formats and currently accepts only `default`:

```bash
yarn evals:generic \
  --config ./evals/example-suite/suite.json \
  --filter "special case" \
  --output ./tmp/eval-results \
  --reporter default
```

Use `--filter` to run only cases whose descriptions contain the supplied text. Matching is case-insensitive and preserves the order from the configuration file. The suite is still fully validated before filtering; a filter with no matches exits with an error.
