export interface EntityPicture {
  src: string;
  fallback?: string;
}

export function getEntityPicture(
  attributes: Record<string, unknown> | undefined | null,
): EntityPicture | null {
  if (!attributes) return null;
  const pic = attributes.entity_picture as string | undefined;
  if (pic) return { src: pic };
  // Some integrations store a media image URL
  const mediaImageUrl = attributes.media_image_url as string | undefined;
  if (mediaImageUrl) return { src: mediaImageUrl };
  return null;
}

export function entityPictureOnError(
  e: React.SyntheticEvent<HTMLImageElement>,
): void {
  const img = e.currentTarget;
  const fallback = img.getAttribute("data-fallback");
  if (fallback && img.src !== fallback) {
    img.src = fallback;
  }
}
