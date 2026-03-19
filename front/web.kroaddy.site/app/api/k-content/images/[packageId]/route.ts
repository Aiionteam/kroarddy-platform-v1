import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getPackageFolder } from "@/constants/k-content-images";

export const runtime = "nodejs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  const { packageId } = await params;
  const folder = getPackageFolder(packageId);
  if (!folder) {
    return NextResponse.json({ images: [] });
  }

  const baseDir = path.join(process.cwd(), "public", "k_content", "k-pop");
  const targetDir = path.join(baseDir, folder);

  try {
    const dirents = await fs.readdir(targetDir, { withFileTypes: true });
    const files = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));

    const images = files.map((file) => `/k_content/k-pop/${folder}/${file}`);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

