/**
 * 가이드 assistant 답변 문자열 정제 — JSON 래핑(`{ type, text }` 등) 시 본문만 추출.
 * signature / extras 등 UI 비노출 필드는 파싱 시 무시합니다.
 */

function extractFromRecord(rec: Record<string, unknown>): string | null {
  const t = rec.text;
  if (typeof t === "string" && t.trim()) return t.trim();
  const c = rec.content;
  if (typeof c === "string" && c.trim()) return c.trim();
  const m = rec.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  const a = rec.answer;
  if (typeof a === "string" && a.trim()) return a.trim();
  const b = rec.body;
  if (typeof b === "string" && b.trim()) return b.trim();

  const parts = rec.parts;
  if (Array.isArray(parts)) {
    const chunks: string[] = [];
    for (const p of parts) {
      if (p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string") {
        const s = (p as { text: string }).text.trim();
        if (s) chunks.push(s);
      }
    }
    if (chunks.length) return chunks.join("\n");
  }
  return null;
}

function tryParseJsonObject(s: string): unknown | null {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/**
 * API `answer` 필드가 순수 문자열이거나 JSON 문자열인 경우 모두 사용자 표시용 텍스트로 통일.
 */
export function sanitizeGuideAnswerForDisplay(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence?.[1]) s = fence[1].trim();

  if ((s.startsWith("{") && s.includes("}")) || (s.startsWith("[") && s.includes("]"))) {
    const parsed = tryParseJsonObject(s);
    if (parsed != null) {
      if (typeof parsed === "string") return parsed.trim();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const inner = extractFromRecord(parsed as Record<string, unknown>);
        if (inner) return inner;
      }
    }
  }

  return s;
}

function asTrimmedString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function normalizePlacePoints(raw: unknown): Array<{ icon: string; text: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ icon: string; text: string }> = [];
  for (const x of raw.slice(0, 3)) {
    if (x != null && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const icon = asTrimmedString(o.icon).trim().slice(0, 16);
      const text = asTrimmedString(o.text).trim().slice(0, 200);
      if (text) out.push({ icon, text });
    }
  }
  return out;
}

/** PLACES_JSON keywords — # 제거, 최대 3 */
function normalizePlaceKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    let s = asTrimmedString(x).trim();
    if (!s) continue;
    s = s.replace(/^#+/, "").trim();
    if (!s) continue;
    if (s.length > 32) s = s.slice(0, 32);
    out.push(s);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Ask 응답 전체에서 UI에 쓸 필드만 유지 (`answer` 정제, `places[].description` 문자열 보장).
 */
export function sanitizeGuideAskResponse<
  T extends { answer: string; places?: unknown },
>(res: T): T {
  const rawPlaces = res.places;
  const placesNorm = Array.isArray(rawPlaces)
    ? rawPlaces.map((p) => {
        if (!p || typeof p !== "object") return p;
        const o = p as Record<string, unknown>;
        const ps = o.photo_spot;
        const photoSpot =
          ps == null || ps === false
            ? null
            : (() => {
                const s = asTrimmedString(ps).trim();
                if (!s || s.toLowerCase() === "null") return null;
                return s;
              })();
        return {
          ...o,
          summary: asTrimmedString(o.summary).trim().slice(0, 40),
          points: normalizePlacePoints(o.points),
          tip: asTrimmedString(o.tip).trim().slice(0, 240),
          description: asTrimmedString(o.description).trim(),
          photo_spot: photoSpot,
          estimated_cost: asTrimmedString(o.estimated_cost).trim(),
          duration: asTrimmedString(o.duration).trim(),
          keywords: normalizePlaceKeywords(o.keywords),
        };
      })
    : rawPlaces;

  return {
    ...res,
    answer: sanitizeGuideAnswerForDisplay(res.answer),
    ...(Array.isArray(rawPlaces) ? { places: placesNorm } : {}),
  } as T;
}
