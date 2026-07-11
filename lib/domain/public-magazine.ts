export const PUBLIC_MAGAZINE_COLUMNS =
  "id, title, tag, content, thumbnail_url, instagram_urls, view_count, published_at, created_at";

export type PublicMagazineDTO = {
  id: string;
  title: string;
  tag: string;
  content: string;
  thumbnail_url: string;
  instagram_urls: string[];
  view_count: number;
  published_at: string;
  created_at: string;
};
