export type NearbyStore = {
  storeCode?: string;
  storeName?: string;
  address?: string;
  distance?: number | null;
  businessStatus?: boolean;
};

export type CourtStore = {
  storeCode: string;
  storeName: string;
  address: string;
  distance: number | null;
};

const REGION_SUFFIX = /(特别行政区|自治区|自治州|地区|街道|苏木|镇|乡|盟|区|县|市|省)$/u;

export function stripRegion(name: string) {
  return name.trim().replace(REGION_SUFFIX, '');
}

export function pickNearestOpenStore(stores: NearbyStore[]): CourtStore | null {
  const open = stores.filter(store => store.storeCode && store.businessStatus !== false);
  if (!open.length) return null;
  const measured = open.filter(store => typeof store.distance === 'number' && Number.isFinite(store.distance));
  const pool = measured.length ? measured : open;
  const nearest = pool.reduce((best, store) => {
    if (typeof store.distance !== 'number') return best;
    if (typeof best.distance !== 'number') return store;
    return store.distance < best.distance ? store : best;
  });
  return {
    storeCode: String(nearest.storeCode),
    storeName: nearest.storeName ?? '',
    address: nearest.address ?? '',
    distance: typeof nearest.distance === 'number' ? nearest.distance : null,
  };
}

export function placeFromGeocode(body: unknown): { city: string; keyword: string } | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as { city?: string; locality?: string; principalSubdivision?: string; localityInfo?: { administrative?: Array<{ name?: string }> } };
  const admins = (data.localityInfo?.administrative ?? []).map(item => item?.name?.trim() ?? '').filter(Boolean);
  const city = stripRegion(data.city || data.locality || data.principalSubdivision || '');
  if (!city) return null;
  const keywordSource = [...admins].reverse().find(name => {
    const bare = stripRegion(name);
    return Boolean(bare) && bare !== city && name !== '中国';
  });
  const keyword = stripRegion(keywordSource ?? city) || city;
  return { city, keyword };
}

export function formatDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `约 ${Math.round(meters)} 米`;
  const kilometers = meters / 1000;
  return `约 ${kilometers.toFixed(kilometers < 10 ? 1 : 0)} 公里`;
}
