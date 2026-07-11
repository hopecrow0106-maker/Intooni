export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ArtistStatus = "active" | "hidden" | "archived";

type Row<T extends object> = {
  Row: T & Record<string, unknown>;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      artists: Row<{
        id: string;
        name: string;
        instagram_handle: string;
        main_category_id: string | null;
        bio: string;
        hashtags: string[];
        search_tags: string[];
        mood_tags: string[];
        style_tags: string[];
        topic_tags: string[];
        thumbnail_url: string;
        character_url: string;
        gallery_post_urls: string[];
        show_on_site: boolean;
        show_growth_on_site: boolean;
        is_trending: boolean;
        hide_from_new: boolean;
        status: ArtistStatus;
        sort_order: number;
        internal_memo: string;
        created_at: string;
        updated_at: string;
      }>;
      categories: Row<{
        id: string;
        name: string;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>;
      artist_stats: Row<{
        id: string;
        artist_id: string;
        recorded_date: string;
        followers: number;
        post_count: number;
        created_at: string;
        updated_at: string;
      }>;
      artist_contacts: Row<{
        artist_id: string;
        email: string | null;
        dm_available: boolean | null;
        created_at: string;
        updated_at: string;
      }>;
      brand_categories: Row<{
        id: string;
        name: string;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>;
      artist_recommended_brand_categories: Row<{
        artist_id: string;
        brand_category_id: string;
        created_at: string;
      }>;
      artist_b2b_profiles: Row<{
        artist_id: string;
        strengths: string;
        cautions: string;
        brand_safety_grade: "unknown" | "safe" | "normal" | "caution" | null;
        created_at: string;
        updated_at: string;
      }>;
      artist_collaborations: Row<{
        id: string;
        artist_id: string;
        brand_name: string;
        brand_category_id: string | null;
        collaboration_year: number;
        collaboration_month: number | null;
        post_url: string;
        content_summary: string;
        ad_disclosure_status: "yes" | "no" | "unknown";
        likes: number | null;
        comments: number | null;
        views: number | null;
        created_at: string;
        updated_at: string;
      }>;
      magazines: Row<{
        id: string;
        title: string;
        tag: string;
        content: string;
        thumbnail_url: string;
        instagram_urls: string[];
        view_count: number;
        is_public: boolean;
        published_at: string;
        created_at: string;
      }>;
      magazine_artists: Row<{
        magazine_id: string;
        artist_id: string;
        sort_order: number;
        created_at: string;
      }>;
      artist_event_logs: Row<{
        id: string;
        artist_id: string;
        event_type: "artist_click" | "instagram_outbound";
        created_at: string;
      }>;
      search_query_logs: Row<{
        id: string;
        query: string;
        created_at: string;
      }>;
      toon_tests: Row<{
        id: string;
        slug: string;
        title: string;
        status: "draft" | "published";
        version: number;
        start_node_key: string;
        draft: Json;
        created_at: string;
        updated_at: string;
      }>;
      toon_nodes: Row<{
        test_id: string;
        node_key: string;
        node_type: "question" | "result";
        title: string;
        description: string;
        image_url: string | null;
        sort_order: number;
        config: Json;
        created_at: string;
        updated_at: string;
      }>;
      toon_edges: Row<{
        test_id: string;
        edge_key: string;
        from_node_key: string;
        to_node_key: string;
        option_label: string;
        sort_order: number;
        config: Json;
        created_at: string;
        updated_at: string;
      }>;
      toon_result_artists: Row<{
        test_id: string;
        result_node_key: string;
        artist_id: string;
        sort_order: number;
        created_at: string;
      }>;
      migration_legacy_backup: Row<{
        scope: string;
        row_key: string;
        payload: Json;
        backed_up_at: string;
      }>;
      sheet_sync_jobs: Row<{
        id: string;
        job_type: string;
        status: "preview" | "applied" | "failed" | "cancelled";
        spreadsheet_id: string;
        sheet_name: string | null;
        requested_by: string | null;
        started_at: string;
        finished_at: string | null;
        summary: Json;
        error_message: string | null;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      admin_replace_artist_b2b_profile: {
        Args: {
          p_artist_id: string;
          p_strengths: string;
          p_cautions: string;
          p_brand_safety_grade: "unknown" | "safe" | "normal" | "caution";
          p_brand_category_ids: string[];
        };
        Returns: undefined;
      };
    };
    Enums: {
      artist_status: ArtistStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
