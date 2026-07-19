/**
 * Generic Google Drive file/folder operations -- no knowledge of the
 * "Ferova_OS_Financiero" spreadsheet schema. Split out of sheetsService.ts
 * (Fase 3 del roadmap) as the least entangled slice.
 */

/**
 * Busca (o crea si no existe) la carpeta "Ferova_OS_Comprobantes" en el Drive
 * del propio usuario -- ahi se guardan las facturas/comprobantes que suben
 * desde Gastos y Pagos. Mismo patron find-or-create que findSpreadsheet/
 * createSpreadsheet, pero para una carpeta en vez de una hoja.
 */
export async function findOrCreateComprobantesFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent("name = 'Ferova_OS_Comprobantes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error buscando la carpeta de comprobantes: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ferova_OS_Comprobantes', mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!createRes.ok) {
    if (createRes.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error creando la carpeta de comprobantes: ${createRes.statusText}`);
  }
  const created = await createRes.json();
  return created.id as string;
}

/**
 * Sube un archivo (imagen o PDF de una factura/comprobante) al Drive del
 * propio usuario, dentro de la carpeta de comprobantes. Usa el scope
 * drive.file ya pedido en el login -- no hace falta permiso adicional ni
 * cuenta de servicio. Solo el link se guarda en Supabase; el archivo vive
 * en el Drive del usuario.
 */
export async function uploadFileToDrive(file: File, accessToken: string, folderId: string): Promise<{ fileId: string; webViewLink: string }> {
  const boundary = `ferova_${Date.now()}`;
  const metadata = { name: file.name, parents: [folderId] };
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
    fileBytes,
    `\r\n--${boundary}--`,
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(`Error subiendo el archivo a Drive: ${res.statusText}`);
  }
  const data = await res.json();
  return { fileId: data.id, webViewLink: data.webViewLink };
}

/**
 * Searches Google Drive for a spreadsheet named "Ferova_OS_Financiero".
 * Returns spreadsheet details if found, or null otherwise.
 */
export async function findSpreadsheet(accessToken: string): Promise<{ id: string; webViewLink?: string } | null> {
  const q = encodeURIComponent("name = 'Ferova_OS_Financiero' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)`;

  // Only a confirmed empty result means "the spreadsheet doesn't exist yet"
  // (null, safe to create one). A network/API error must propagate instead
  // of resolving to null -- callers treat null as "create a new one", and a
  // transient Google failure here previously caused a duplicate spreadsheet
  // to be created instead of reusing the user's existing one.
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error(`Error buscando archivo en Drive: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return {
      id: data.files[0].id,
      webViewLink: data.files[0].webViewLink,
    };
  }
  return null;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  trashed: boolean;
  modifiedTime?: string;
}

/**
 * Searches the user's entire Google Drive for files whose name contain "Ferova_OS_Financiero".
 * Includes trashed files so the user can easily recover them.
 */
export async function searchAllRelatedSpreadsheets(accessToken: string): Promise<DriveFileInfo[]> {
  const q = encodeURIComponent("name contains 'Ferova_OS_Financiero' and mimeType = 'application/vnd.google-apps.spreadsheet'");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,trashed,modifiedTime)&orderBy=modifiedTime desc`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(`Error Consultando Drive: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error('Error in searchAllRelatedSpreadsheets:', err);
    throw err;
  }
}

/**
 * Restores a file from the Google Drive trash (untrashes it).
 */
export async function untrashSpreadsheet(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: false }),
  });

  if (!res.ok) {
    throw new Error(`Error al recuperar archivo de la papelera: ${res.statusText}`);
  }
}
