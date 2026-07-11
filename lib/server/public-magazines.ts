import "server-only";

import {
  PUBLIC_MAGAZINE_COLUMNS,
  type PublicMagazineDTO
} from "@/lib/domain/public-magazine";
import { getSupabasePublicServerClient } from "@/lib/supabase";

export async function listPublicMagazines(): Promise<PublicMagazineDTO[]> {
  const supabase = getSupabasePublicServerClient();
  const { data, error } = await supabase
    .from("magazines")
    .select(PUBLIC_MAGAZINE_COLUMNS)
    .eq("is_public", true)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PublicMagazineDTO[];
}
