const R2 = (import.meta.env.VITE_MEDIA_URL || '').replace(/\/$/, '');

export const mediaUrl = (video, key) => {
  if (!key) return null;
  return video?.storageProvider === 'r2' && R2 ? `${R2}/${key}` : `/media/${key}`;
};
