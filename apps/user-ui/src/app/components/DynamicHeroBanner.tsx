'use client';

import { useLayout } from '../../hooks/useLayout';

const DEFAULT_BANNER = '/brand/eshop-banner.svg';

export function DynamicHeroBanner() {
  const { data: layout } = useLayout();
  return <img className="catalog-hero-banner" src={layout?.banner || DEFAULT_BANNER} alt="" />;
}
