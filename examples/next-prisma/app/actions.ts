"use server";

import { getRuntime } from "@/lib/runtime";

export async function listPostsAction() {
  const runtime = getRuntime();
  const protectedListPosts = runtime.tenancy.withServerAction(async () => {
    return runtime.prisma.post.findMany({ orderBy: { id: "asc" } });
  });
  return protectedListPosts();
}
