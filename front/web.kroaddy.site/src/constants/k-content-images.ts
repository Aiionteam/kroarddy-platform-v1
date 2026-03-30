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

/** KF_CAFE: 폴더 스캔/API 실패 시 리스트·카드용 기본 썸네일 */
export const K_CONTENT_KF_CAFE_FALLBACK_IMAGE =
  "/k_content/k-food/KF_CAFE/rawkkim-1P7C9MaRzgU-unsplash.jpg";
export const K_CONTENT_KF_CONVENIENCE_FALLBACK_IMAGE =
  "/k_content/k-food/KF_CONVENIENCE/business_gs25_img02.jpg";

export function getPackageFolder(packageId: string): string | null {
  const key = packageId.toUpperCase();
  return K_CONTENT_PACKAGE_FOLDER_MAP[key] ?? null;
}

export function isKpopPackage(packageId: string): boolean {
  return packageId.toUpperCase().startsWith("KPOP_");
}

export function isKdPackage(packageId: string): boolean {
  return packageId.toUpperCase().startsWith("KD_");
}

/** K-FOOD 등: public/k_content/k-food/{folder}/ */
export function isKFoodPackage(packageId: string): boolean {
  return packageId.toUpperCase().startsWith("KF_");
}

export function getKFoodFolder(packageId: string): string | null {
  if (!isKFoodPackage(packageId)) return null;
  const key = packageId.toUpperCase();
  return key;
}

export function getKDramaImagePath(packageId: string): string {
  const m = packageId.match(/^KD_(\d{1,2})$/i);
  if (!m) return K_CONTENT_PLACEHOLDER_IMAGE;
  const idx = Number(m[1]);
  const folder = `d${String(idx).padStart(2, "0")}`;
  return `${K_CONTENT_KDRAMA_IMAGE_BASE}/${folder}/1.jpg`;
}

export function getKDramaFolder(packageId: string): string | null {
  const m = packageId.toUpperCase().match(/^KD_(\d{1,2})$/i);
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
  if (isKpopPackage(packageId) || isKdPackage(packageId) || isKFoodPackage(packageId)) {
    const images = await fetchPackageImages(packageId);
    const picked = pickRandomImage(images);
    if (picked) return picked;
    if (packageId.toUpperCase() === "KF_CAFE") return K_CONTENT_KF_CAFE_FALLBACK_IMAGE;
    if (packageId.toUpperCase() === "KF_CONVENIENCE") return K_CONTENT_KF_CONVENIENCE_FALLBACK_IMAGE;
    return K_CONTENT_PLACEHOLDER_IMAGE;
  }
  return K_CONTENT_PLACEHOLDER_IMAGE;
}

export function pickRandomImage(images: string[]): string | null {
  if (images.length === 0) return null;
  const idx = Math.floor(Math.random() * images.length);
  return images[idx] ?? null;
}

