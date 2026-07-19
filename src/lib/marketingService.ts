import { db } from './db';

export interface Campaign {
  id: string;
  nombre: string;
  canal?: string | null;
  cliente_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  account_id?: string | null;
  payment_method_id?: string | null;
  moneda: string;
  estado: 'planificada' | 'activa' | 'pausada' | 'finalizada';
  notas?: string | null;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  periodo: string;
  inversion: number;
  impresiones: number;
  clics: number;
  leads: number;
  leads_calificados: number;
  citas: number;
  citas_efectivas: number;
  ventas: number;
  ticket_promedio: number;
  costo_entrega: number;
  comision: number;
  costo_profesional: number;
  ltv: number;
  notas?: string | null;
}

type CampaignMetricsRow = Omit<CampaignMetrics, 'inversion' | 'impresiones' | 'clics' | 'ticket_promedio' | 'costo_entrega' | 'comision' | 'costo_profesional' | 'ltv'> & {
  inversion: number | string;
  impresiones: number | string;
  clics: number | string;
  ticket_promedio: number | string;
  costo_entrega: number | string;
  comision: number | string;
  costo_profesional: number | string | null;
  ltv: number | string;
};

const toNum = (r: CampaignMetricsRow): CampaignMetrics => ({
  ...r,
  inversion: Number(r.inversion),
  impresiones: Number(r.impresiones),
  clics: Number(r.clics),
  ticket_promedio: Number(r.ticket_promedio),
  costo_entrega: Number(r.costo_entrega),
  comision: Number(r.comision),
  costo_profesional: Number(r.costo_profesional || 0),
  ltv: Number(r.ltv),
});

export async function listCampaigns(userId: string): Promise<Campaign[]> {
  const { data, error } = await db<Campaign>('marketing_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMetrics(userId: string): Promise<CampaignMetrics[]> {
  const { data, error } = await db<CampaignMetricsRow>('marketing_campaign_metrics').select('*').eq('user_id', userId).order('periodo', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNum);
}

export async function createCampaign(userId: string, input: Omit<Campaign, 'id'>): Promise<Campaign> {
  const { data, error } = await db<Campaign & { user_id: string }>('marketing_campaigns').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la campaña.');
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await db('marketing_campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertMetrics(userId: string, m: Omit<CampaignMetrics, 'id'> & { id?: string }): Promise<CampaignMetrics> {
  const payload = { user_id: userId, ...m };
  if (m.id) {
    const { data, error } = await db<CampaignMetricsRow & { user_id: string }>('marketing_campaign_metrics').update(payload).eq('id', m.id).select('*').single();
    if (error) throw error;
    if (!data) throw new Error('No se pudo actualizar la métrica.');
    return toNum(data);
  }
  const { data, error } = await db<CampaignMetricsRow & { user_id: string }>('marketing_campaign_metrics').insert(payload).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la métrica.');
  return toNum(data);
}
