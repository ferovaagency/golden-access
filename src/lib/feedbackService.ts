import { supabase } from './supabase';

export type FeedbackTipo = 'bug' | 'sugerencia' | 'otro';

export async function submitFeedback(userId: string, email: string | null, tipo: FeedbackTipo, mensaje: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('product_feedback')
    .insert({ user_id: userId, email, tipo, mensaje });
  if (error) throw new Error(`[feedbackService] submitFeedback: ${error.message}`);
}
