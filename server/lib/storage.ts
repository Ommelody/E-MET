import { db } from "../supabase";

/** อัปโหลดไฟล์ (upsert) แล้วคืน path */
export async function uploadFile(bucket: string, path: string, body: Buffer | Uint8Array | Blob, contentType: string) {
  const { error } = await db.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** signed URL (สำหรับ bucket private เช่น pdfs) */
export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return getPublicUrl(bucket, path);
  return data.signedUrl;
}

/** public URL (สำหรับ bucket public เช่น catalog-images) */
export function getPublicUrl(bucket: string, path: string): string {
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function deleteFile(bucket: string, path: string) {
  try {
    await db.storage.from(bucket).remove([path]);
  } catch {
    /* ignore */
  }
}
