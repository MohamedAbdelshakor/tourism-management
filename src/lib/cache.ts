const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache on top of Firestore IndexedDB cache

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private versions = new Map<string, number>();
  private store = new Map<string, CacheEntry<unknown>>();

  private key(collectionName: string, suffix: string): string {
    const ver = this.versions.get(collectionName) ?? 1;
    return `${collectionName}:v${ver}:${suffix}`;
  }

  async remember<T>(collectionName: string, suffix: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
    const fullKey = this.key(collectionName, suffix);
    const hit = this.store.get(fullKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }

    const fresh = await loader();
    this.store.set(fullKey, { value: fresh, expiresAt: Date.now() + ttlMs });
    return fresh;
  }

  invalidate(collectionName: string): void {
    const current = this.versions.get(collectionName) ?? 1;
    this.versions.set(collectionName, current + 1);
  }

  clearAll(): void {
    this.store.clear();
    this.versions.clear();
  }
}

export const readCache = new MemoryCache();
