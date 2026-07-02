import { listPostsAction } from "@/app/actions";
import { errorResponse } from "@/lib/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  try {
    return Response.json(await listPostsAction(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
