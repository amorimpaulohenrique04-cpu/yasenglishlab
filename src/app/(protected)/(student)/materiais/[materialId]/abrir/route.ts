import { z } from "zod";

import { openCurrentStudentMaterial } from "@/server/materials/materials";

interface MaterialOpenRouteContext {
  params: Promise<{ materialId: string }>;
}

export async function GET(_request: Request, { params }: MaterialOpenRouteContext) {
  const { materialId: rawMaterialId } = await params;
  const parsed = z.string().uuid().safeParse(rawMaterialId);

  if (!parsed.success) {
    return new Response("Material não disponível.", { status: 404 });
  }

  try {
    const signedUrl = await openCurrentStudentMaterial(parsed.data);
    return Response.redirect(signedUrl, 307);
  } catch {
    return new Response("Material não disponível.", { status: 404 });
  }
}
