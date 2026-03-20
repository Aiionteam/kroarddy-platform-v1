import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function GET() {
  const bannerDir = path.join(process.cwd(), "public", "k_content", "banner");
  try {
    const dirents = await fs.readdir(bannerDir, { withFileTypes: true });
    const files = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()));

    const images = files.map((file) => `/k_content/banner/${file}`);
    return NextResponse.json({ images });
  } catch {
    // fallback: 폴더가 없거나 비어있으면 기본 배너 사용
    return NextResponse.json({ images: ["/k_content/banner/panorama-downtown-cityscape-seoul-tower-seoul-south-korea.jpg"] });
  }
}

