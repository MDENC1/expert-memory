import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://zqchrfgujqcaimdxfkyg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cc6AFHl6PlRqfH7p6vlJ9g_FIKKM4GE";
export const PILOT_SHUL_ID = "e102b001-e0d4-4cd1-9a9f-2705b315f74a";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
