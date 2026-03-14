'use client';

/**
 * 离线缓存服务
 * 使用 IndexedDB 存储数据，支持离线访问
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // 生存时间（毫秒）
}

class OfflineCache {
  private dbName = 'code-review-platform';
  private storeName = 'cache';
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      const request = store.put(entry, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          this.remove(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  }

  /**
   * 删除缓存
   */
  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 获取所有缓存键
   */
  async keys(): Promise<string[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as string[]) || []);
    });
  }
}

export const offlineCache = new OfflineCache();

/**
 * 缓存 API 响应
 */
export async function cacheApiResponse<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 默认 5 分钟
): Promise<T> {
  // 先尝试从缓存获取
  const cached = await offlineCache.get<T>(key);
  if (cached) {
    return cached;
  }

  // 从网络获取
  const data = await fetcher();

  // 保存到缓存
  await offlineCache.set(key, data, ttl);

  return data;
}

/**
 * 检查网络连接
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * 监听网络状态变化
 */
export function onNetworkStatusChange(callback: (online: boolean) => void) {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));

  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
}
