const ID = /^[\w-]+$/;

export function toEmbedUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const yt = (id?: string) =>
    id && ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;

  if (host === "youtu.be") return yt(parts[0]);
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") return yt(url.searchParams.get("v") ?? undefined);
    if (["embed", "shorts", "live"].includes(parts[0])) return yt(parts[1]);
  }
  if (host === "vimeo.com" && /^\d+$/.test(parts[0] ?? "")) {
    const h = parts[1] && ID.test(parts[1]) ? `?h=${parts[1]}` : "";
    return `https://player.vimeo.com/video/${parts[0]}${h}`;
  }
  if (host === "player.vimeo.com" && parts[0] === "video" && /^\d+$/.test(parts[1] ?? "")) {
    return `https://player.vimeo.com/video/${parts[1]}${url.search}`;
  }
  return null;
}
