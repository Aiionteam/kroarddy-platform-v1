import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getKDramaFolder, getKFoodFolder, getPackageFolder } from "@/constants/k-content-images";

export const runtime = "nodejs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  const { packageId } = await params;
  const kpopFolder = getPackageFolder(packageId);
  const kdramaFolder = getKDramaFolder(packageId);
  const kfoodFolder = getKFoodFolder(packageId);

  let targetDir = "";
  let webBasePath = "";
  if (kpopFolder) {
    targetDir = path.join(process.cwd(), "public", "k_content", "k-pop", kpopFolder);
    webBasePath = `/k_content/k-pop/${kpopFolder}`;
  } else if (kdramaFolder) {
    targetDir = path.join(process.cwd(), "public", "k_content", "k-drama", kdramaFolder);
    webBasePath = `/k_content/k-drama/${kdramaFolder}`;
  } else if (kfoodFolder) {
    targetDir = path.join(process.cwd(), "public", "k_content", "k-food", kfoodFolder);
    webBasePath = `/k_content/k-food/${kfoodFolder}`;
  } else {
    return NextResponse.json({ images: [] });
  }

  try {
    const dirents = await fs.readdir(targetDir, { withFileTypes: true });
    const files = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));

    const images = files.map((file) => `${webBasePath}/${file}`);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

