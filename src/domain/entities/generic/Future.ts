import * as rcpromise from "real-cancellable-promise";
import type { Maybe } from "../../../utils/ts-utils.js";
import { fromPairs } from "../../../utils/ts-utils.js";

/**
 * Futures are async values similar to promises, with some differences:
 *   - Futures are only executed when their method `run` is called.
 *   - Futures are cancellable (thus, they can be easily used in a `React.useEffect`, for example).
 *   - Futures have fully typed errors. Subclass Error if you need full stack traces.
 *   - You may still use async/await monad-style blocks (check Future.block).
 *
 * More info: https://github.com/EyeSeeTea/know-how/wiki/Async-futures
 */
export class Future<E, D> {
  private constructor(private _promise: () => rcpromise.CancellablePromise<D>) {}

  static success<E, D>(data: D): Future<E, D> {
    return new Future(() => rcpromise.CancellablePromise.resolve(data));
  }

  static error<E, D>(error: E): Future<E, D> {
    return new Future(() => rcpromise.CancellablePromise.reject(error));
  }

  static fromComputation<E, D>(
    computation: (resolve: (value: D) => void, reject: (error: E) => void) => Cancel,
  ): Future<E, D> {
    return new Future(() => {
      let cancelComputation: Cancel;
      let settled = false;
      let rejectPromise: (reason?: unknown) => void = () => {};

      const promise = new Promise<D>((resolve, reject) => {
        rejectPromise = reject;

        const safeResolve = (value: D) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        const safeReject = (error: E) => {
          if (settled) return;
          settled = true;
          // Futures intentionally support typed non-Error values.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
        };

        cancelComputation = computation(safeResolve, safeReject);
      });

      return new rcpromise.CancellablePromise(promise, () => {
        if (settled) return;
        settled = true;

        try {
          cancelComputation?.();
        } finally {
          rejectPromise(new rcpromise.Cancellation());
        }
      });
    });
  }

  run(onSuccess: (data: D) => void, onError: (error: E) => void): Cancel {
    return this._promise().then(onSuccess, (err: unknown) => {
      if (err instanceof rcpromise.Cancellation) {
        // no-op
      } else {
        onError(err as E);
      }
    }).cancel;
  }

  map<U>(fn: (data: D) => U): Future<E, U> {
    return new Future(() => this._promise().then(fn));
  }

  mapError<E2>(fn: (error: E) => E2): Future<E2, D> {
    return new Future(() =>
      this._promise().catch((error: unknown) => {
        throw fn(error as E) as Error;
      }),
    );
  }

  flatMap<U, E>(fn: (data: D) => Future<U, E>): Future<U, E> {
    return new Future(() => this._promise().then((data) => fn(data)._promise()));
  }

  flatMapError<E2>(fn: (error: E) => Future<E2, D>): Future<E2, D> {
    return new Future(() => {
      return this._promise().catch((error: unknown) => {
        return fn(error as E)._promise();
      });
    });
  }

  chain<U, E>(fn: (data: D) => Future<U, E>): Future<U, E> {
    return this.flatMap(fn);
  }

  toPromise(): Promise<D> {
    return this._promise();
  }

  static join2<E, T, S>(async1: Future<E, T>, async2: Future<E, S>): Future<E, [T, S]> {
    return new Future(() => {
      return rcpromise.CancellablePromise.all<T, S>([async1._promise(), async2._promise()]);
    });
  }

  static joinObj<Obj extends Record<string, Future<unknown, unknown>>>(
    obj: Obj,
    options: ParallelOptions = { concurrency: 1 },
  ): Future<unknown, { [K in keyof Obj]: Obj[K] extends Future<unknown, infer U> ? U : never }> {
    const keys = Object.keys(obj) as Extract<keyof Obj, string>[];
    const asyncs = keys.map((key) => obj[key]) as Future<unknown, unknown>[];

    return Future.parallel(asyncs, options).map((values) => {
      const pairs = keys.map((key, idx) => [key, values[idx]] as const);
      return fromPairs(pairs) as {
        [K in keyof Obj]: Obj[K] extends Future<unknown, infer U> ? U : never;
      };
    });
  }

  static sequential<E, D>(asyncs: Future<E, D>[]): Future<E, D[]> {
    return Future.block(async ($) => {
      const output: D[] = [];
      for (const async of asyncs) {
        const res = await $(async);
        output.push(res);
      }
      return output;
    });
  }

  static parallel<E, D>(asyncs: Future<E, D>[], options: ParallelOptions): Future<E, D[]> {
    return new Future(() =>
      rcpromise.buildCancellablePromise(async ($) => {
        const queue: rcpromise.CancellablePromise<void>[] = [];
        const output = new Array<D>(asyncs.length);

        for (let idx = 0; idx < asyncs.length; idx += 1) {
          const async = asyncs[idx];
          if (async === undefined) continue;
          const queueItem$ = async._promise().then((res) => {
            const queueIndex = queue.indexOf(queueItem$);
            if (queueIndex >= 0) queue.splice(queueIndex, 1);
            output[idx] = res;
          });

          queue.push(queueItem$);

          if (queue.length >= options.concurrency)
            await $(rcpromise.CancellablePromise.race(queue));
        }

        await $(rcpromise.CancellablePromise.all(queue));
        return output;
      }),
    );
  }

  static sleep(ms: number): Future<unknown, number> {
    return new Future(() => rcpromise.CancellablePromise.delay(ms)).map(() => ms);
  }

  static void(): Future<unknown, undefined> {
    return Future.success(undefined);
  }

  static block<E, U>(blockFn: (capture: CaptureAsync<E>) => Promise<U>): Future<E, U> {
    return new Future((): rcpromise.CancellablePromise<U> => {
      return rcpromise.buildCancellablePromise((capturePromise) => {
        const captureAsync: CaptureAsync<E> = (async) => {
          return capturePromise(async._promise());
        };

        captureAsync.throw = function (error: E) {
          throw error as Error;
        };

        return blockFn(captureAsync);
      });
    });
  }

  static cancel() {
    throw new rcpromise.Cancellation();
  }

  static block_<E>() {
    return function <U>(blockFn: (capture: CaptureAsync<E>) => Promise<U>): Future<E, U> {
      return Future.block<E, U>(blockFn);
    };
  }

  static sequentialWithAccumulation<E, D>(
    futures: Future<E, D>[],
    options: { stopOnError?: boolean } = {},
  ): Future<never, SequentialAccumulatedData<E, D>> {
    const { stopOnError = false } = options;
    const processSequentially = (
      futures: Future<E, D>[],
      accumulatedData: D[] = [],
    ): Future<never, SequentialAccumulatedData<E, D>> => {
      const [firstFuture, ...remainingFutures] = futures;

      if (!firstFuture) {
        return Future.success({ type: "success", data: accumulatedData });
      }

      return firstFuture
        .flatMap((resultData) => {
          return processSequentially(remainingFutures, [...accumulatedData, resultData]);
        })
        .flatMapError((error: E) => {
          if (stopOnError) {
            const accumulatedDataWithError: SequentialAccumulatedData<E, D> = {
              type: "error",
              error: error,
              data: accumulatedData,
            };
            return Future.success(accumulatedDataWithError);
          } else {
            return processSequentially(remainingFutures, accumulatedData);
          }
        });
    };

    return processSequentially(futures);
  }
}

export type SequentialAccumulatedData<E, D> =
  | { type: "success"; data: D[] }
  | { type: "error"; error: E; data: D[] };

export type Cancel = Maybe<() => void>;

interface CaptureAsync<E> {
  <D>(async: Future<E, D>): Promise<D>;
  throw: (error: E) => never;
}

type ParallelOptions = { concurrency: number };

/* Example of how use Future.fromComputation */
export function getJSON<U>(url: string): Future<TypeError | SyntaxError, U> {
  const abortController = new AbortController();

  return Future.fromComputation((resolve, reject) => {
    // exceptions: TypeError | DOMException[name=AbortError]
    fetch(url, { method: "get", signal: abortController.signal })
      .then((res) => res.json() as U) // exceptions: SyntaxError
      .then((data) => {
        resolve(data);
      })
      .catch((error: unknown) => {
        if (isNamedError(error) && error.name === "AbortError") {
          reject(new rcpromise.Cancellation());
        } else if (error instanceof TypeError || error instanceof SyntaxError) {
          reject(error);
        } else {
          reject(new TypeError("Unknown error"));
        }
      });

    const cancelRequest = () => {
      abortController.abort();
    };
    return cancelRequest;
  });
}

function isNamedError(error: unknown): error is { name: string } {
  return Boolean(error && typeof error === "object" && "name" in error);
}
