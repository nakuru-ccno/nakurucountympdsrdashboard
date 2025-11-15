// supabase.js
// Replace the placeholders with your project's URL and anon key.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://vypfkihkbldvgoeejtfp.supabase.co"; // <-- replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5cGZraWhrYmxkdmdvZWVqdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNDk1MTksImV4cCI6MjA3ODcyNTUxOX0.aePpieODsvkEQSt6rGM695_xWDMv1MOGD25PzErOE-Q"; // <-- replace

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
