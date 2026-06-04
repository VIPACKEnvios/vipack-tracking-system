import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("URL DE SUPABASE:", supabaseUrl);
console.log("CLAVE SUPABASE:", !!supabaseKey);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);