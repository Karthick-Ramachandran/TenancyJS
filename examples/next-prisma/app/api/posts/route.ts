import { errorResponse } from "@/lib/error-response";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const runtime = getRuntime();
    const listPosts = runtime.tenancy.withRouteHandler(async () => {
      const posts = await runtime.prisma.post.findMany({
        orderBy: { id: "asc" },
      });
      return Response.json(posts, {
        headers: { "Cache-Control": "no-store" },
      });
    });
    return await listPosts(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const runtime = getRuntime();
    const createPost = runtime.tenancy.withRouteHandler(
      async (tenantRequest) => {
        const body: unknown = await tenantRequest.json();
        const title = titleFromBody(body);
        const post = await runtime.prisma.post.create({
          data: { tenantId: runtime.manager.getTenantOrFail().id, title },
        });
        return Response.json(post, { status: 201 });
      },
    );
    return await createPost(request);
  } catch (error) {
    return errorResponse(error);
  }
}

function titleFromBody(body: unknown): string {
  if (
    body === null ||
    typeof body !== "object" ||
    !("title" in body) ||
    typeof body.title !== "string" ||
    body.title.trim() === "" ||
    body.title.length > 200
  ) {
    throw new TypeError("A title between 1 and 200 characters is required.");
  }
  return body.title;
}
