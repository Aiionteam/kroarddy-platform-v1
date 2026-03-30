import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getKDramaFolder, getKFoodFolder, getPackageFolder } from "@/constants/k-content-images";

export const runtime = "nodejs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

async function collectImageFilesRecursive(dir: string, relativeBase = ""): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const images: string[] = [];

  for (const entry of dirents) {
    const fullPath = path.join(dir, entry.name);
    const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectImageFilesRecursive(fullPath, relPath);
      images.push(...nested);
      continue;
    }
    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      images.push(relPath);
    }
  }

  return images;
}

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
    const files = await collectImageFilesRecursive(targetDir);

    const images = files.sort().map((file) => `${webBasePath}/${file}`);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}

