import { describe, expect, it } from 'vitest';
import { formatDistance, pickNearestOpenStore, placeFromGeocode } from '../../lib/mcd/stores';

describe('nearest open store', () => {
  it('picks the open store with the smallest distance', () => {
    const store = pickNearestOpenStore([
      { storeCode: 'far', storeName: '远店', address: '远路', distance: 1800, businessStatus: true },
      { storeCode: 'closed', storeName: '休息', address: '近路', distance: 20, businessStatus: false },
      { storeCode: 'near', storeName: '近店', address: '中路 1 号', distance: 320, businessStatus: true },
    ]);
    expect(store).toEqual({ storeCode: 'near', storeName: '近店', address: '中路 1 号', distance: 320 });
  });

  it('ignores stores without a distance when another open store has one', () => {
    expect(pickNearestOpenStore([
      { storeCode: 'unknown', storeName: '未知', address: '甲', businessStatus: true },
      { storeCode: 'known', storeName: '已知', address: '乙', distance: 900, businessStatus: true },
    ])?.storeCode).toBe('known');
  });

  it('keeps the earlier store when distances tie', () => {
    expect(pickNearestOpenStore([
      { storeCode: 'a', storeName: '甲', address: '甲路', distance: 100, businessStatus: true },
      { storeCode: 'b', storeName: '乙', address: '乙路', distance: 100, businessStatus: true },
    ])?.storeCode).toBe('a');
  });

  it('returns null when every store is closed or missing a code', () => {
    expect(pickNearestOpenStore([
      { storeName: '无编码', address: '甲', distance: 10, businessStatus: true },
      { storeCode: 'closed', storeName: '休息', address: '乙', distance: 10, businessStatus: false },
    ])).toBeNull();
  });
});

describe('reverse geocode place', () => {
  it('turns a Shanghai district into a city and location keyword', () => {
    expect(placeFromGeocode({
      city: '上海市',
      localityInfo: { administrative: [{ name: '中国' }, { name: '上海市' }, { name: '黄浦区' }, { name: '外滩街道' }] },
    })).toEqual({ city: '上海', keyword: '外滩' });
  });

  it('turns Beijing Chaoyang into the same city and keyword the menu search expects', () => {
    expect(placeFromGeocode({
      city: '北京市',
      localityInfo: { administrative: [{ name: '中国' }, { name: '北京市' }, { name: '朝阳区' }] },
    })).toEqual({ city: '北京', keyword: '朝阳' });
  });

  it('returns null when the city cannot be read', () => {
    expect(placeFromGeocode({ localityInfo: { administrative: [{ name: '中国' }] } })).toBeNull();
    expect(placeFromGeocode(null)).toBeNull();
  });
});

describe('distance label', () => {
  it('formats meters and kilometers', () => {
    expect(formatDistance(320)).toBe('约 320 米');
    expect(formatDistance(1800)).toBe('约 1.8 公里');
    expect(formatDistance(null)).toBeNull();
  });
});
