import { Check, Trash2, X } from 'lucide-react';

/**
 * Inline trash-icon -> check/cancel confirmation, used in table rows across
 * ClientesAdmin, ServiciosAdmin, GastosAdmin, HorasAdmin, VentasAdmin (each
 * previously reimplemented the same JSX with its own `confirmDeleteXId`
 * state). Colors match the existing legacy row-action palette as-is; a
 * visual pass to the current light theme belongs to Fase 5, not this
 * extraction.
 *
 * Usage:
 *   const [confirmId, setConfirmId] = useState<string | null>(null);
 *   <InlineDeleteConfirm
 *     confirming={confirmId === row.id}
 *     onRequestConfirm={() => setConfirmId(row.id)}
 *     onConfirm={() => { handleDelete(row.id); setConfirmId(null); }}
 *     onCancel={() => setConfirmId(null)}
 *   />
 */
export interface InlineDeleteConfirmProps {
  confirming: boolean;
  onRequestConfirm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra classes for the wrapper (e.g. `justify-end max-w-[70px] ml-auto` for a right-aligned standalone cell). */
  className?: string;
  requestTitle?: string;
  /** 'md' (default) matches most tables; 'sm' matches the compact variant used in GastosAdmin's "otros gastos" rows. */
  size?: 'md' | 'sm';
}

export function InlineDeleteConfirm({ confirming, onRequestConfirm, onConfirm, onCancel, className = '', requestTitle = 'Eliminar', size = 'md' }: InlineDeleteConfirmProps) {
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const confirmBtnClass = size === 'sm'
    ? 'text-[#a8c98a] hover:text-[#bde89b] font-bold text-xs px-1 cursor-pointer items-center justify-center flex'
    : 'text-[#a8c98a] hover:text-[#bde89b] font-bold text-xs px-1 cursor-pointer';
  const cancelBtnClass = size === 'sm'
    ? 'text-[#c97a61] hover:text-[#e08970] font-bold text-xs px-1 cursor-pointer items-center justify-center flex'
    : 'text-[#c97a61] hover:text-[#e08970] font-bold text-xs px-1 cursor-pointer';
  const requestBtnClass = size === 'sm'
    ? 'text-[#c97a61] hover:text-[#e08970] p-1 rounded cursor-pointer'
    : 'text-[#c97a61] hover:text-[#e08970] p-1.5 transition rounded-lg hover:bg-[#c97a61]/10 bg-[#0f0e0c]/40 cursor-pointer';

  if (confirming) {
    return (
      <div className={`flex items-center gap-1 bg-[#1a1110] border border-[#c97a61]/30 p-1 rounded ${className}`}>
        <button type="button" onClick={onConfirm} title="Confirmar eliminación" className={confirmBtnClass}>
          <Check className={iconClass} />
        </button>
        <button type="button" onClick={onCancel} title="Cancelar" className={cancelBtnClass}>
          <X className={iconClass} />
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onRequestConfirm} title={requestTitle} className={`${requestBtnClass} ${className}`}>
      <Trash2 className={iconClass} />
    </button>
  );
}
