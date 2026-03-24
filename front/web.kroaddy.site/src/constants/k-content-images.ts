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
export const K_CONTENT_KDRAMA_IMAGE_BASE = "/k_content/k-drama";

export function getPackageFolder(packageId: string): string | null {
  return K_CONTENT_PACKAGE_FOLDER_MAP[packageId] ?? null;
}

export function isKpopPackage(packageId: string): boolean {
  return packageId.startsWith("KPOP_");
}

export function isKdPackage(packageId: string): boolean {
  return packageId.startsWith("KD_");
}

export function getKDramaImagePath(packageId: string): string {
  const m = packageId.match(/^KD_(\d{1,2})$/i);
  if (!m) return K_CONTENT_PLACEHOLDER_IMAGE;
  const idx = Number(m[1]);
  const folder = `d${String(idx).padStart(2, "0")}`;
  return `${K_CONTENT_KDRAMA_IMAGE_BASE}/${folder}/1.jpg`;
}

export function getKDramaFolder(packageId: string): string | null {
  const m = packageId.match(/^KD_(\d{1,2})$/i);
  if (!m) return null;
  const idx = Number(m[1]);
  return `d${String(idx).padStart(2, "0")}`;
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

export async function resolveCardImage(packageId: string): Promise<string> {
  if (isKpopPackage(packageId) || isKdPackage(packageId)) {
    const images = await fetchPackageImages(packageId);
    return pickRandomImage(images) ?? K_CONTENT_PLACEHOLDER_IMAGE;
  }
  return K_CONTENT_PLACEHOLDER_IMAGE;
}

export function pickRandomImage(images: string[]): string | null {
  if (images.length === 0) return null;
  const idx = Math.floor(Math.random() * images.length);
  return images[idx] ?? null;
}

