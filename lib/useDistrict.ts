'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DistrictCode, DEFAULT_DISTRICT_CODE, MULTI_DISTRICT_MODE,
  getDistrictInfo, getStoredDistrictCode, isDistrictCode,
  setStoredDistrictCode, withDistrictParam,
} from './district';

export function useDistrict() {
  const searchParams = useSearchParams();
  const [storedCode, setStoredCode] = useState<DistrictCode | null>(null);

  useEffect(() => {
    if (!MULTI_DISTRICT_MODE) return;
    const q = searchParams.get('d');
    if (isDistrictCode(q)) {
      setStoredDistrictCode(q);
      setStoredCode(q);
      return;
    }
    setStoredCode(getStoredDistrictCode());
  }, [searchParams]);

  const districtCode = useMemo(() => {
    if (!MULTI_DISTRICT_MODE) return DEFAULT_DISTRICT_CODE;
    const q = searchParams.get('d');
    if (isDistrictCode(q)) return q;
    return storedCode;
  }, [searchParams, storedCode]);

  const district = useMemo(() => getDistrictInfo(districtCode), [districtCode]);

  return {
    districtCode,
    district,
    hasDistrict: !!districtCode,
    withDistrict: (path: string) => withDistrictParam(path, districtCode),
  };
}
