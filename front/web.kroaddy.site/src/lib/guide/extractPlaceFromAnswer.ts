/** 모델이 붙인 마커 JSON 꼬리 제거 — 본문 발췌용 */
export function stripPlacesJsonBlock(text: string): string {
  const i = text.indexOf("<<<PLACES_JSON>>>");
  return i >= 0 ? text.slice(0, i).trim() : (text ?? "").trim();
}

/**
 * 전체 answer 마크다운에서 특정 장소명과 연결된 단락을 찾습니다.
 * 마커 시트에서 `description`이 비었을 때 폴백으로 사용합니다.
 */
export function extractPlaceSectionFromAnswer(answer: string, placeName: string): string {
  const a = stripPlacesJsonBlock(answer ?? "");
  const name = (placeName ?? "").trim();
  if (!a || !name) return "";

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // **장소명** 직후 ~ 다음 굵은 제목 또는 빈 줄 두 번 전까지
  const afterBold = new RegExp(
    `\\*\\*\\s*${escaped}\\s*\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^*]+\\*\\*|<<<PLACES_JSON>>>|$)`,
    "i",
  );
  const m1 = a.match(afterBold);
  if (m1?.[1]) {
    const chunk = m1[1].trim();
    if (chunk.length >= 8) return chunk;
  }

  const paras = a.split(/\n\n+/);
  for (const p of paras) {
    const t = p.trim();
    if (t.includes("<<<PLACES_JSON>>>")) continue;
    if (t.length < 24) continue;
    if (t.includes(name)) return t;
  }

  return "";
}
