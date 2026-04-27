import type { ArtistEventLog } from "@/lib/artist-events";

export type Artist = {
  id: string;
  name: string;
  instagram_handle: string;
  genre: string;
  followers: number;
  post_count: number;
  hashtags: string[];
  hidden_tags: string[];
  mood_tags: string[];
  episode_formats: string[];
  style_tags: string[];
  topic_tags: string[];
  memo: string;
  bio: string;
  thumbnail_url: string;
  character_url: string;
  gallery_post_urls: string[];
  is_ad: boolean;
  is_hot: boolean;
  hide_from_new: boolean;
  sort_order: number;
  last_stats_updated_at: string;
  created_at: string;
};

export type ArtistInsert = Omit<Artist, "id" | "created_at"> & {
  id?: string;
  last_stats_updated_at?: string;
  created_at?: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type CategoryInsert = Omit<Category, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
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
  published_at: string;
  created_at: string;
};

export type MagazineInsert = Omit<Magazine, "id" | "created_at" | "view_count"> & {
  id?: string;
  created_at?: string;
  view_count?: number;
};

export type SearchQueryLog = {
  id: string;
  query: string;
  created_at: string;
};

export type ToonbtiQuestionGroup = {
  id: string;
  key: string;
  label: string;
  description: string;
  selection_mode: "single" | "multi";
  max_selections: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ToonbtiQuestionGroupInsert = Omit<ToonbtiQuestionGroup, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ToonbtiQuestionOption = {
  id: string;
  group_id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ToonbtiQuestionOptionInsert = Omit<ToonbtiQuestionOption, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ArtistToonbtiOptionLink = {
  artist_id: string;
  option_id: string;
  created_at: string;
};

export type ArtistToonbtiOptionLinkInsert = Omit<ArtistToonbtiOptionLink, "created_at"> & {
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      artists: {
        Row: Artist;
        Insert: ArtistInsert;
        Update: Partial<ArtistInsert>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: CategoryInsert;
        Update: Partial<CategoryInsert>;
        Relationships: [];
      };
      magazines: {
        Row: Magazine;
        Insert: MagazineInsert;
        Update: Partial<MagazineInsert>;
        Relationships: [];
      };
      artist_event_logs: {
        Row: ArtistEventLog;
        Insert: Omit<ArtistEventLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ArtistEventLog>;
        Relationships: [];
      };
      search_query_logs: {
        Row: SearchQueryLog;
        Insert: Omit<SearchQueryLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SearchQueryLog>;
        Relationships: [];
      };
      toonbti_question_groups: {
        Row: ToonbtiQuestionGroup;
        Insert: ToonbtiQuestionGroupInsert;
        Update: Partial<ToonbtiQuestionGroupInsert>;
        Relationships: [];
      };
      toonbti_question_options: {
        Row: ToonbtiQuestionOption;
        Insert: ToonbtiQuestionOptionInsert;
        Update: Partial<ToonbtiQuestionOptionInsert>;
        Relationships: [];
      };
      artist_toonbti_option_links: {
        Row: ArtistToonbtiOptionLink;
        Insert: ArtistToonbtiOptionLinkInsert;
        Update: Partial<ArtistToonbtiOptionLinkInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
