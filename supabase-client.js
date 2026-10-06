import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://sxyyrtuweixwdthgrvcd.supabase.co';
const supabaseAnonKey = 'sb_publishable_2sCyRj8ZZk0fxo1vHB5rEQ_Jb6uOIYG';

export const isSupabaseConfigured =
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
  element.hidden = !message;
}
