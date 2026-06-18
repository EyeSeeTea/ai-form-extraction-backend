import { describe, expect, it, vi } from "vitest";

import { ExtractFormUseCase } from "../ExtractFormUseCase.js";

describe("ExtractFormUseCase", () => {
  it("delays execution before returning the extracted form payload", async () => {
    vi.useFakeTimers();

    try {
      const useCase = new ExtractFormUseCase();

      const promise = useCase
        .execute({
          formId: "form-1",
          sourceUrl: "https://example.org/forms/1",
        })
        .toPromise();

      let settled = false;
      void promise.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({
        formId: "form-1",
        sourceUrl: "https://example.org/forms/1",
        placeholder: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
