import { Copy } from 'lucide-react';

interface PlaybookCardProps {
  label: string;
  text: string;
  onCopy: (text: string) => void;
  accent: string;
}

export function PlaybookCard({ label, text, onCopy, accent }: PlaybookCardProps) {
  return (
    <div className="bg-slate-50/70 border rounded p-3" style={{ borderColor: `${accent}44` }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-mono uppercase tracking-wider font-bold" style={{ color: accent }}>{label}</span>
        <button
          onClick={() => onCopy(text)}
          className="text-[9px] font-mono uppercase flex items-center gap-1 hover:opacity-80"
          style={{ color: accent }}
        >
          <Copy className="w-2.5 h-2.5" /> Copiar
        </button>
      </div>
      <p className="text-slate-900 text-[11px] whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}
