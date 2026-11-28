import type { NewsArticle, PhotoEntry } from '../../types/tournament';
import { tursoRequest } from '../tursoApiClient';

export async function fetchPublicNewsBounded(maxDocs: number = 25): Promise<NewsArticle[]> {
  const res = await tursoRequest<{ news: NewsArticle[] }>(`/news?limit=${maxDocs}`);
  return res.news ?? [];
}

export async function listAllFirestoreNews(): Promise<NewsArticle[]> {
  const res = await tursoRequest<{ news: NewsArticle[] }>('/news/all', {
    requiresAuth: true,
  });
  return res.news ?? [];
}

export async function saveFirestoreNewsArticle(
  article: NewsArticle,
  isNew: boolean
): Promise<void> {
  await tursoRequest(`/news/${encodeURIComponent(article.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { article, isNew },
  });
}

export async function deleteFirestoreNewsArticle(newsId: string): Promise<void> {
  await tursoRequest(`/news/${encodeURIComponent(newsId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function fetchPublicPhotosBounded(maxDocs: number = 60): Promise<PhotoEntry[]> {
  const res = await tursoRequest<{ photos: PhotoEntry[] }>(`/photos?limit=${maxDocs}`);
  return res.photos ?? [];
}

export async function saveFirestorePhoto(photo: PhotoEntry): Promise<void> {
  await tursoRequest(`/photos/${encodeURIComponent(photo.id)}`, {
    method: 'PUT',
    requiresAuth: true,
    body: { photo },
  });
}

export async function deleteFirestorePhoto(photoId: string): Promise<void> {
  await tursoRequest(`/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}
