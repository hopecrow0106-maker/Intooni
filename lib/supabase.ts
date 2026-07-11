import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getPublicSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey
  };
}

function getAdminSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey
  };
}

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
  }

  return browserClient;
}

export function getSupabasePublicServerClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase public environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseAdminClient() {
  const config = getAdminSupabaseConfig();
  if (!config) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to your .env.local file before using admin APIs."
    );
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
