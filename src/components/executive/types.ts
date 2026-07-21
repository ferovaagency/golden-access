export type Tone = 'positive' | 'warning' | 'critical' | 'neutral';

export interface Signal {
  title: string;
  detail: string;
  tone: Tone;
  action?: { label: string; tab: string };
}
