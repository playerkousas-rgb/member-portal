'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { STOCK_RULES, TROOP_LIST, VENUE_RULES } from './publicContent';
import type { PublicInfo } from './types';

/**
 * 區系統公開設定（getPublicInfo）—— 借用規則、旅團清單、Teamup 網址等
 * 動態文字嘅唯一來源係區系統 Config；本地常識只作後備（後台未設定／讀取失敗）。
 */
export function usePublicInfo() {
  const [info, setInfo] = useState<PublicInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getPublicInfo().then((result) => {
      if (!cancelled && result.ok && result.data) setInfo(result.data);
    });
    return () => { cancelled = true; };
  }, []);

  return {
    ready: Boolean(info),
    districtName: info?.districtName || '',
    venueRules: info?.venueRules || VENUE_RULES,
    stockRules: info?.stockRules || STOCK_RULES,
    troopList: info?.troopList?.length ? info.troopList : TROOP_LIST,
    teamupBookingUrl: info?.teamupBookingUrl || '',
    cctvUrl: info?.cctvUrl || '',
  };
}
