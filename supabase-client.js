import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://vqxnazmaokbobtnxatjk.supabase.co';
const supabaseAnonKey = 'sb_publishable_ZA1mqUfr-BctVKYsbziueg_oZ2W6SA7';

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
