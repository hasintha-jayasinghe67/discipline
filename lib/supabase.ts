import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kjpvfhcbnehcmyxzpurk.supabase.co";
const supabaseAnonKey =
  "sb_publishable_tLKA5vcSiHhwOuALGzFMgg_A1qyLJ3-";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
