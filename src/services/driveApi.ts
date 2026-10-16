import type { GoogleDriveFile } from '../types/gqueues';

export async function fetchDriveFiles(
  accessToken: string,
  searchQuery?: string
): Promise<GoogleDriveFile[]> {
  const queryParts = ["trashed = false"];

  if (searchQuery && searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const q = queryParts.join(' and ');
  const params = new URLSearchParams({
    q,
    pageSize: '25',
    fields: 'files(id,name,mimeType,webViewLink,iconLink,modifiedTime)',
    orderBy: 'modifiedTime desc',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch Drive files (${res.status}): ${error}`);
  }

  const data = await res.json();
  const files = data.files || [];

  return files.map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink || `https://drive.google.com/open?id=${f.id}`,
    iconLink: f.iconLink,
    modifiedTime: f.modifiedTime,
  }));
}
