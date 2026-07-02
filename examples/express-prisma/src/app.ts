import type { TenancyManager } from "@tenancyjs/core";
import type { TenantResolutionChain } from "@tenancyjs/identifiers";
import {
  ExpressTenancyResolutionError,
  createExpressTenancyMiddleware,
} from "@tenancyjs/integration-express";
import express from "express";
import type { ErrorRequestHandler, Express } from "express";

import type { createProtectedPrismaClient, ExampleTenant } from "./runtime.js";

type ProtectedPrismaClient = ReturnType<typeof createProtectedPrismaClient>;

export interface ExpressPrismaAppOptions {
  readonly manager: TenancyManager<ExampleTenant>;
  readonly resolver: TenantResolutionChain<ExampleTenant>;
  readonly prisma: ProtectedPrismaClient;
}

export function createExpressPrismaApp(
  options: ExpressPrismaAppOptions,
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(
    createExpressTenancyMiddleware({
      manager: options.manager,
      resolver: options.resolver,
    }),
  );

  app.get("/posts", async (_request, response) => {
    const posts = await options.prisma.post.findMany({
      orderBy: { id: "asc" },
    });
    response.json(posts);
  });

  app.post("/posts", async (request, response) => {
    const title = titleFromBody(request.body);
    const post = await options.prisma.post.create({
      data: {
        tenantId: options.manager.getTenantOrFail().id,
        title,
      },
    });
    response.status(201).json(post);
  });

  app.patch("/posts/:id", async (request, response) => {
    const title = titleFromBody(request.body);
    const post = await options.prisma.post.update({
      where: { id: request.params.id },
      data: { title },
    });
    response.json(post);
  });

  app.delete("/posts/:id", async (request, response) => {
    await options.prisma.post.delete({ where: { id: request.params.id } });
    response.sendStatus(204);
  });

  app.get("/summary", async (_request, response) => {
    const [count, aggregate] = await Promise.all([
      options.prisma.post.count(),
      options.prisma.post.aggregate({ _count: true }),
    ]);
    response.json({ count, aggregateCount: aggregate._count });
  });

  app.use(exampleErrorHandler);
  return app;
}

class ExampleInputError extends Error {}

function titleFromBody(body: unknown): string {
  if (
    body === null ||
    typeof body !== "object" ||
    !("title" in body) ||
    typeof body.title !== "string" ||
    body.title.trim() === "" ||
    body.title.length > 200
  ) {
    throw new ExampleInputError(
      "A title between 1 and 200 characters is required.",
    );
  }
  return body.title;
}

const exampleErrorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ExpressTenancyResolutionError) {
    response.status(error.statusCode).json({ error: error.code });
    return;
  }
  if (error instanceof ExampleInputError) {
    response.status(400).json({ error: "INVALID_INPUT" });
    return;
  }
  if (hasPrismaCode(error, "P2025")) {
    response.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  response.status(500).json({ error: "INTERNAL_ERROR" });
};

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}
