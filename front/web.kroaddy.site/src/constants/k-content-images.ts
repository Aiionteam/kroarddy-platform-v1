export const K_CONTENT_PACKAGE_FOLDER_MAP: Record<string, string> = {
  KPOP_01: "p01",
  KPOP_02: "p02",
  KPOP_03: "p03",
  KPOP_04: "p04",
  KPOP_05: "p05",
  KPOP_06: "p06",
  KPOP_07: "p07",
  KPOP_08: "p08",
};

export const K_CONTENT_PLACEHOLDER_IMAGE = "/k_content/placeholder.jpg";

export function getPackageFolder(packageId: string): string | null {
  return K_CONTENT_PACKAGE_FOLDER_MAP[packageId] ?? null;
}

export async function fetchPackageImages(packageId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/k-content/images/${encodeURIComponent(packageId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: string[] };
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return [];
  }
}

export function pickRandomImage(images: string[]): string | null {
  if (images.length === 0) return null;
  const idx = Math.floor(Math.random() * images.length);
  return images[idx] ?? null;
}

