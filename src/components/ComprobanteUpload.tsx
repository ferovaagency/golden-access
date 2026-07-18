import React, { useRef, useState } from 'react';
import { Paperclip, Loader2, ExternalLink } from 'lucide-react';
import { getAccessToken } from '../lib/supabase';
import { findOrCreateComprobantesFolder, uploadFileToDrive } from '../lib/sheetsService';

// Sube una imagen/PDF (factura pagada o comprobante de pago) al Drive del
// propio usuario y devuelve el link -- nunca se guarda el archivo en
// Supabase, solo la URL. Reutilizable en Gastos y Pagos.
interface Props {
  currentUrl?: string | null;
  currentNombre?: string | null;
  onUploaded: (url: string, nombre: string) => void;
  label?: string;
}

export default function ComprobanteUpload({ currentUrl, currentNombre, onUploaded, label = 'Adjuntar comprobante' }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = getAccessToken();
    if (!token) {
      alert('Primero conecta tu cuenta de Google desde Ajustes > Respaldo en Google Sheets para poder subir comprobantes a tu Drive.');
      return;
    }
    setUploading(true);
    try {
      const folderId = await findOrCreateComprobantesFolder(token);
      const { webViewLink } = await uploadFileToDrive(file, token, folderId);
      onUploaded(webViewLink, file.name);
    } catch (err: any) {
      const message = err?.message === 'UNAUTHORIZED'
        ? 'Tu conexión con Google expiró. Reconéctala desde Ajustes > Respaldo en Google Sheets.'
        : (err?.message || String(err));
      alert(`No se pudo subir el archivo: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
      {/* Fondo propio (no depende del tema de la página que lo envuelve --
          este control se usa tanto en formularios claros como oscuros) */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
        {uploading ? 'Subiendo...' : (currentUrl ? 'Reemplazar comprobante' : label)}
      </button>
      {currentUrl && (
        <a href={currentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100">
          <ExternalLink className="w-3 h-3" /> Ver{currentNombre ? `: ${currentNombre}` : ' comprobante'}
        </a>
      )}
    </div>
  );
}
