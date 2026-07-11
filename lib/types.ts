export type Artist = {
  id: string;
  name: string;
  instagram_handle: string;
  genre: string;
  main_category_id?: string | null;
  followers: number;
  post_count: number;
  weekly_follower_growth: number | null;
  weekly_post_growth: number | null;
  weekly_follower_growth_rate: number | null;
  weekly_post_growth_rate: number | null;
  stats_period_start: string | null;
  stats_period_end: string | null;
  stats_interval_days?: number | null;
  is_weekly_comparable?: boolean;
  hashtags: string[];
  search_tags: string[];
  mood_tags: string[];
  style_tags: string[];
  topic_tags: string[];
  internal_memo: string;
  bio: string;
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  is_trending: boolean;
  show_on_site?: boolean;
  show_growth_on_site?: boolean;
  status?: "active" | "hidden" | "archived";
  updated_at?: string;
  has_contact?: boolean;
  has_collaboration?: boolean;
  has_b2b?: boolean;
  hide_from_new: boolean;
  sort_order: number;
  last_stats_updated_at: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Magazine = {
  id: string;
  title: string;
  tag: string;
  content: string;
  thumbnail_url: string;
  related_artist_ids: string[];
  instagram_urls: string[];
  view_count: number;
  is_public: boolean;
  published_at: string;
  created_at: string;
};

export type MagazineInsert = Omit<Magazine, "id" | "created_at" | "view_count"> & {
  id?: string;
  created_at?: string;
  view_count?: number;
};
