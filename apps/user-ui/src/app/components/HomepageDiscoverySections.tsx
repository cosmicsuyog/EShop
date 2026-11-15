'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '../lib/authApi';
import { ProductCard, type CatalogProduct } from './catalog/CatalogProductListing';
import ShopCard, { type ShopCardShop } from '../../shared/components/cards/shop-card';
import { useAuth } from './AuthProvider';

type ProductResponse = { products?: CatalogProduct[]; events?: CatalogProduct[]; recommendations?: CatalogProduct[] };
type ShopsResponse = { shops?: ShopCardShop[] };

const fetchJson = async <T,>(path: string): Promise<T> => {
  const response = await authApi.get<T>(path);
  return response.data;
};

function DiscoverySection({
  eyebrow,
  title,
  children,
  loading,
  error,
  empty,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  loading: boolean;
  error: boolean;
  empty: boolean;
}) {
  return (
    <section className="homepage-discovery-section" aria-labelledby={`${title.toLowerCase().replaceAll(' ', '-')}-title`}>
      <div className="catalog-section-heading">
        <div>
          <p className="catalog-eyebrow">{eyebrow}</p>
          <h2 id={`${title.toLowerCase().replaceAll(' ', '-')}-title`}>{title}</h2>
        </div>
      </div>
      {loading ? <p className="homepage-discovery-state">Loading {title.toLowerCase()}…</p> : null}
      {error ? <p className="homepage-discovery-state is-error">We could not load this section right now.</p> : null}
      {!loading && !error && empty ? <p className="homepage-discovery-state">Nothing is available here yet.</p> : null}
      {!loading && !error && !empty ? children : null}
    </section>
  );
}

export function HomepageDiscoverySections() {
  const { status } = useAuth();
  const latest = useQuery({
    queryKey: ['homepage', 'latest-products'],
    queryFn: () => fetchJson<ProductResponse>('/product/api/get-filtered-products?page=1&limit=10'),
    staleTime: 60_000,
  });
  const shops = useQuery({
    queryKey: ['homepage', 'top-shops'],
    queryFn: () => fetchJson<ShopsResponse>('/product/api/top-shops'),
    staleTime: 60_000,
  });
  const offers = useQuery({
    queryKey: ['homepage', 'top-offers'],
    queryFn: () => fetchJson<ProductResponse>('/product/api/get-all-events?page=1&limit=10'),
    staleTime: 60_000,
  });
  const recommended = useQuery({
    queryKey: ['homepage', 'recommended-products'],
    queryFn: () => fetchJson<ProductResponse>('/recommendation/api/get-recommended-products'),
    enabled: status === 'authenticated',
    staleTime: 60_000,
    retry: false,
  });

  const latestProducts = latest.data?.products ?? [];
  const topShops = shops.data?.shops ?? [];
  const topOffers = offers.data?.events ?? offers.data?.products ?? [];
  const suggestedProducts = recommended.data?.recommendations ?? recommended.data?.products ?? [];

  return (
    <div className="homepage-discovery" aria-label="More from EShop">
      <DiscoverySection eyebrow="FOR YOU" title="Suggested products" loading={recommended.isLoading && status === 'authenticated'} error={false} empty={suggestedProducts.length === 0}>
        <div className="catalog-grid homepage-discovery-grid">{(suggestedProducts.length ? suggestedProducts : latestProducts).map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </DiscoverySection>
      <DiscoverySection eyebrow="JUST IN" title="Latest products" loading={latest.isLoading} error={latest.isError} empty={latestProducts.length === 0}>
        <div className="catalog-grid homepage-discovery-grid">{latestProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </DiscoverySection>
      <DiscoverySection eyebrow="SELLER SPOTLIGHT" title="Top shops" loading={shops.isLoading} error={shops.isError} empty={topShops.length === 0}>
        <div className="shop-grid homepage-discovery-grid">{topShops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div>
      </DiscoverySection>
      <DiscoverySection eyebrow="LIMITED TIME" title="Top offers" loading={offers.isLoading} error={offers.isError} empty={topOffers.length === 0}>
        <div className="catalog-grid homepage-discovery-grid">{topOffers.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </DiscoverySection>
    </div>
  );
}

export default HomepageDiscoverySections;
