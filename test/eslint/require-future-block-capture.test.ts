import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";

import rule from "../../eslint/rules/require-future-block-capture.js";

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
});

RuleTester.describe = describe;
RuleTester.it = it;

describe("require-future-block-capture", () => {
  tester.run("require-future-block-capture", rule, {
    valid: [
      {
        code: `
          Future.block(async ($) => {
            const value = await $(Future.success(1));
            return value;
          });
        `,
      },
      {
        code: `
          Future.block(async ($) => {
            const helper = async () => {
              return await Promise.resolve(1);
            };

            return await $(Future.success(helper));
          });
        `,
      },
      {
        code: `
          Future.block_<Error>()(async ($) => {
            const value = await $(Future.success(1));
            return value;
          });
        `,
      },
      {
        code: `
          async function run() {
            const value = await Future.success(1);
            return value;
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          Future.block(async ($) => {
            const value = await Future.success(1);
            return value;
          });
        `,
        output: `
          Future.block(async ($) => {
            const value = await $(Future.success(1));
            return value;
          });
        `,
        errors: [{ messageId: "wrapAwait" }],
      },
      {
        code: `
          Future.block_<Error>()(async ($) => {
            const value = await Promise.resolve(1);
            return value;
          });
        `,
        output: `
          Future.block_<Error>()(async ($) => {
            const value = await $(Promise.resolve(1));
            return value;
          });
        `,
        errors: [{ messageId: "wrapAwait" }],
      },
    ],
  });
});
