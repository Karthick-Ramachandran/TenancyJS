import { NextTenancyResolutionError } from "@tenancyjs/integration-next";

export function errorResponse(error: unknown): Response {
  if (error instanceof NextTenancyResolutionError) {
    return Response.json({ error: error.code }, { status: error.statusCode });
  }
  return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
