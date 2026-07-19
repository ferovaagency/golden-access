/**
 * Barrel re-export -- sheetsService.ts se partió en submódulos por
 * responsabilidad bajo ./sheets/ (Fase 3 del roadmap: driveFiles,
 * spreadsheetSchema, spreadsheetRead, spreadsheetWrite, financeSync,
 * backup). Este archivo existe solo para no romper los imports existentes
 * (App.tsx, ComprobanteUpload.tsx, FinancialStatement.tsx,
 * FinanceOperativa.tsx); import directo del submódulo es preferible en
 * código nuevo.
 */
export * from './sheets/driveFiles';
export * from './sheets/spreadsheetSchema';
export * from './sheets/spreadsheetRead';
export * from './sheets/spreadsheetWrite';
export * from './sheets/financeSync';
export * from './sheets/backup';
