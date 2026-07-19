import { db } from './db';

export type FeedbackTipo = 'bug' | 'sugerencia' | 'otro';

interface ProductFeedbackInsert {
  user_id: string;
  email: string | null;
  tipo: FeedbackTipo;
  mensaje: string;
}

export async function submitFeedback(userId: string, email: string | null, tipo: FeedbackTipo, mensaje: string): Promise<void> {
  const { error } = await db<ProductFeedbackInsert>('product_feedback')
    .insert({ user_id: userId, email, tipo, mensaje });
  if (error) throw new Error(`[feedbackService] submitFeedback: ${error.message}`);
}
