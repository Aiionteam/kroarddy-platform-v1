export function extractTourstarPostIdFromMessage(message: string): string | null {
  if (!message) return null;

  const directMatch = message.match(/https?:\/\/[^\s]+\/tourstar\/post\/(\d+)/i);
  if (directMatch?.[1]) return directMatch[1];

  const queryMatch = message.match(/https?:\/\/[^\s]+\/tourstar\?([^\s#]+)/i);
  if (queryMatch?.[1]) {
    const params = new URLSearchParams(queryMatch[1]);
    const postId = params.get("postId");
    if (postId && /^\d+$/.test(postId)) return postId;
  }

  return null;
}
