'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, getErrorMessage } from '../../lib/api';
export default function CustomizationPage() {
  const query = useQuery({ queryKey: ['customization'], queryFn: async () => (await adminApi.get<{ categories?: string[]; subCategories?: string[]; logo?: string | null; banner?: string | null }>('/admin/api/get-all')).data });
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (values: { logo: string; banner: string }) => adminApi.put('/admin/api/customizations', values), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customization'] }) });
  if (query.isLoading) return <p>Loading customization...</p>;
  if (query.isError) return <p className="admin-error">{getErrorMessage(query.error)}</p>;
  const data = query.data ?? {};
  return <><h1>Customization</h1><p>Update the public logo and hero banner. Changes reach the storefront after its one-hour layout cache expires or a query invalidation.</p><section className="admin-grid"><div className="admin-card"><h2>Categories</h2>{(data.categories ?? []).map((category) => <p key={category}>{category}</p>)}<h2>Subcategories</h2>{(data.subCategories ?? []).map((subcategory) => <p key={subcategory}>{subcategory}</p>)}</div><CustomizationForm logo={data.logo ?? ''} banner={data.banner ?? ''} saving={mutation.isPending} onSave={(values) => mutation.mutate(values)} /><div className="admin-card"><h2>Brand assets</h2>{data.logo ? <Image src={data.logo} alt="Logo" width={160} height={80} /> : <p>No logo configured.</p>}{data.banner ? <Image src={data.banner} alt="Banner" width={320} height={120} /> : <p>No banner configured.</p>}</div></section></>;
}

function CustomizationForm({ logo, banner, saving, onSave }: { logo: string; banner: string; saving: boolean; onSave: (values: { logo: string; banner: string }) => void }) {
  const [nextLogo, setNextLogo] = useState(logo);
  const [nextBanner, setNextBanner] = useState(banner);
  return <form className="admin-card" onSubmit={(event) => { event.preventDefault(); onSave({ logo: nextLogo, banner: nextBanner }); }}><h2>Brand assets</h2><label>Logo URL<input value={nextLogo} onChange={(event) => setNextLogo(event.target.value)} placeholder="https://.../logo.svg" /></label><label>Banner URL<input value={nextBanner} onChange={(event) => setNextBanner(event.target.value)} placeholder="https://.../banner.jpg" /></label><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></form>;
}
