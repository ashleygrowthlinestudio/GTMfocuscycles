import { supabase } from './supabase';
import type { GTMPlan } from './types';

export async function saveToCloud(clientId: string, plan: GTMPlan): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .upsert(
      {
        client_id: clientId,
        plan_data: plan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    );

  if (error) {
    console.error('Failed to save plan to Supabase:', error.message);
    throw error;
  }
}

export async function loadFromCloud(clientId: string): Promise<GTMPlan | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('plan_data')
    .eq('client_id', clientId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows found
    console.error('Failed to load plan from Supabase:', error.message);
    throw error;
  }

  return (data?.plan_data as GTMPlan) ?? null;
}

export function getClientId(): string {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  return params.get('client') || 'default';
}
