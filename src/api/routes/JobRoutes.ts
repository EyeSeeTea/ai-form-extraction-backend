import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import type { CreateJobRequestBody } from "../schemas/JobSchemas.js";
import { JobSchemas } from "../schemas/JobSchemas.js";
import { serializeJob } from "../serializers/JobSerializer.js";

export function createJobRoutes(compositionRoot: CompositionRoot): FastifyPluginAsyncZod {
  return async function jobRoutes(server) {
    server.post<{ Body: CreateJobRequestBody }>("/jobs", {
      schema: JobSchemas.create,
      handler: async (request, reply) => {
        const job = await compositionRoot.jobs.createJob.execute(request.body).toPromise();
        try {
          compositionRoot.jobs.nudgeJobWorker();
        } catch {
          // best-effort wake-up
          // if nudge fails, the job will be picked up by the worker eventually when it polls for new jobs
        }

        return reply.code(202).send({
          ...serializeJob(job),
          statusUrl: `/api/jobs/${job.id}`,
        });
      },
    });

    server.get("/jobs/:id", {
      schema: JobSchemas.get,
      handler: async (request, reply) => {
        const job = await compositionRoot.jobs.getJob.execute(request.params.id).toPromise();

        if (!job) {
          return reply.code(404).send({
            error: "Not Found",
            message: "Job not found",
          });
        }

        return reply.send(serializeJob(job));
      },
    });
  };
}
