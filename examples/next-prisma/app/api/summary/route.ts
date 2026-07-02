import { errorResponse } from "@/lib/error-response";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const runtime = getRuntime();
    const summary = runtime.tenancy.withRouteHandler(async () => {
      const count = await runtime.prisma.post.count();
      return Response.json(
        { count },
        { headers: { "Cache-Control": "no-store" } },
      );
    });
    return await summary(request);
  } catch (error) {
    return errorResponse(error);
  }
}
