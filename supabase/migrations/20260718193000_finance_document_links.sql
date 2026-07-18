-- Drive remains the canonical storage for invoices and payment evidence.
-- The database and Google Sheets only keep the user-visible Drive URL/name.
ALTER TABLE public.finance_receivables
  ADD COLUMN IF NOT EXISTS documento_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_nombre TEXT;

ALTER TABLE public.finance_payables
  ADD COLUMN IF NOT EXISTS documento_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_nombre TEXT;

COMMENT ON COLUMN public.finance_receivables.documento_url IS 'Google Drive webViewLink for the invoice or collection evidence.';
COMMENT ON COLUMN public.finance_payables.documento_url IS 'Google Drive webViewLink for the supplier invoice or payment evidence.';
