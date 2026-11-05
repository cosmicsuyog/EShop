import { sellerApi } from './sellerApi';

export type SellerProduct = {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory: string;
  short_description: string;
  detailed_description: string;
  video_url: string | null;
  tags: string[];
  brand: string | null;
  colors: string[];
  sizes: string[];
  stock: number;
  sale_price: number;
  regular_price: number;
  rattings: number;
  warranty: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  images: { url: string }[];
  createdAt: string;
};

export type SellerProductInput = {
  title: string;
  slug: string;
  short_description: string;
  detailed_description: string;
  category: string;
  subcategory: string;
  tags: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  sale_price: number;
  regular_price: number;
  brand?: string;
  video_url?: string;
  warranty?: string;
  cash_on_delivery?: string;
};

const isSellerProduct = (value: unknown): value is SellerProduct =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'title' in value &&
      typeof value.title === 'string' &&
      'slug' in value &&
      typeof value.slug === 'string' &&
      'isDeleted' in value &&
      typeof value.isDeleted === 'boolean' &&
      'images' in value &&
      Array.isArray(value.images)
  );

export const getSellerProducts = async () => {
  const { data } = await sellerApi.get('/product/api/get-shop-products');
  const products: unknown = data?.products;
  if (!Array.isArray(products) || !products.every(isSellerProduct)) {
    throw new Error('The product service returned an invalid product list.');
  }
  return products;
};

export const createSellerProduct = async (input: SellerProductInput) => {
  const { data } = await sellerApi.post('/product/api/create-product', input);
  const product: unknown = data?.product;
  if (!isSellerProduct(product)) {
    throw new Error('The product service returned an invalid product.');
  }
  return product;
};

export const deleteSellerProduct = async (productId: string) => {
  const { data } = await sellerApi.delete(
    `/product/api/delete-product/${encodeURIComponent(productId)}`
  );
  return data;
};

export const restoreSellerProduct = async (productId: string) => {
  const { data } = await sellerApi.put(
    `/product/api/restore-product/${encodeURIComponent(productId)}`
  );
  return data;
};
