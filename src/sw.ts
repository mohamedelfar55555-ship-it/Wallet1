/* Service Worker for PWA offline caching + Web Share Target receiver */
interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

interface SWExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface SWFetchEvent extends SWExtendableEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

interface SWGlobal {
  __WB_MANIFEST?: Array<PrecacheEntry | string>;
  location: Location;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
  };
  addEventListener(type: 'install' | 'activate', listener: (event: SWExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: SWFetchEvent) => void): void;
}

const sw = self as unknown as SWGlobal;
const APP_CACHE = 'demo-wallet-app-v1';
const SHARE_CACHE = 'demo-wallet-share-inbox-v1';
export const SHARE_META_CACHE_URL = '/__share-target/latest-meta.json';
export const SHARE_FILE_CACHE_PREFIX = '/__share-target/file/';

function getPrecacheUrls(): string[] {
  const manifest = (self as unknown as SWGlobal).__WB_MANIFEST ?? [];
  const urls = new Set<string>(['/', '/index.html']);
  for (const entry of manifest) {
    if (typeof entry === 'string') {
      urls.add(entry);
    } else if (entry && typeof entry.url === 'string') {
      urls.add(entry.url);
    }
  }
  return Array.from(urls);
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(getPrecacheUrls()).catch(() => undefined))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_CACHE && key !== SHARE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => sw.clients.claim())
  );
});

async function handleShareTargetPost(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '');
    const text = String(formData.get('text') ?? '');
    const url = String(formData.get('url') ?? '');

    const rawFiles = formData.getAll('shared_files');
    const savedFiles: Array<{ name: string; type: string; size: number; cacheUrl: string }> = [];
    const shareCache = await caches.open(SHARE_CACHE);

    let index = 0;
    for (const item of rawFiles) {
      if (item instanceof File && item.size > 0 && item.size <= 6 * 1024 * 1024) {
        const cacheUrl = `${SHARE_FILE_CACHE_PREFIX}${Date.now()}-${index}`;
        index += 1;
        await shareCache.put(
          cacheUrl,
          new Response(item, {
            headers: {
              'Content-Type': item.type || 'application/octet-stream',
              'X-File-Name': encodeURIComponent(item.name || 'shared-file'),
            },
          })
        );
        savedFiles.push({
          name: item.name || 'shared-file',
          type: item.type || 'application/octet-stream',
          size: item.size,
          cacheUrl,
        });
      }
    }

    await shareCache.put(
      SHARE_META_CACHE_URL,
      new Response(
        JSON.stringify({
          title,
          text,
          url,
          files: savedFiles,
          receivedAt: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    );

    return Response.redirect('/?shared=1', 303);
  } catch {
    return Response.redirect('/?shared=error', 303);
  }
}

sw.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);

  // Intercept Web Share Target POST submission from Android/PWA ShareSheet
  if (
    reqUrl.origin === sw.location.origin &&
    reqUrl.pathname === '/share-target' &&
    event.request.method === 'POST'
  ) {
    event.respondWith(handleShareTargetPost(event.request));
    return;
  }

  // Never cache API calls or non-GET requests
  if (event.request.method !== 'GET' || reqUrl.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests: network-first with cached app shell fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || (await caches.match('/index.html')) || Response.error();
        })
    );
    return;
  }

  // Static assets: cache-first with background refresh
  if (reqUrl.origin === sw.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(APP_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return res;
          })
          .catch(() => cached || Response.error());
      })
    );
  }
});
