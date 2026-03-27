/**
 * Convert relative image URLs to full URLs
 * Handles both relative paths (/uploads/...) and already-full URLs
 */
export const getFullImageUrl = (imageUrl: string | undefined | null): string | null => {
  if (!imageUrl) return null;

  // If it's already a full URL (starts with http), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a relative path, convert it to a full URL
  if (imageUrl.startsWith('/uploads')) {
    // Check if VITE_API_URL is configured (production)
    if (import.meta.env.VITE_API_URL) {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const serverBaseUrl = API_BASE_URL.replace('/api', '');
      return `${serverBaseUrl}${imageUrl}`;
    }
    
    // In development, use relative URL if the proxy can handle it
    // Otherwise fall back to localhost:5000
    try {
      // For development, we need to fetch from the actual backend
      return `http://localhost:5000${imageUrl}`;
    } catch {
      // Fallback
      return imageUrl;
    }
  }

  // Return as-is if it doesn't match known patterns
  return imageUrl;
};
