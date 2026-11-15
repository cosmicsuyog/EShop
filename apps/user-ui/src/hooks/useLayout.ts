'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '../app/lib/authApi';

export type StoreLayout = {
  logo?: string | null;
  banner?: string | null;
  categories?: string[];
  subCategories?: string[];
};

export function useLayout() {
  return useQuery<StoreLayout>({
    queryKey: ['layout'],
    queryFn: async () => {
      const response = await authApi.get<{ layout?: StoreLayout }>('/api/get-layouts');
      return response.data.layout ?? {};
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
