const prefix = 'angicungduoc-v1-';

export function readBrowserCookie<T>(key: string): T | null {
  try {
    const item = document.cookie.split('; ').find(value => value.startsWith(`${prefix}${key}=`));
    return item ? JSON.parse(decodeURIComponent(item.slice(item.indexOf('=') + 1))) as T : null;
  } catch {
    return null;
  }
}

export function writeBrowserCookie(key: string, value: unknown): void {
  const encoded = encodeURIComponent(JSON.stringify(value));
  document.cookie = `${prefix}${key}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
