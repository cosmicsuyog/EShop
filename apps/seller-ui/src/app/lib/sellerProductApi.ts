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
  images?: { fileId: string }[];
};

export type UploadedSellerProductImage = {
  fileId: string;
  file_url: string;
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

const isUploadedSellerProductImage = (
  value: unknown
): value is UploadedSellerProductImage =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'fileId' in value &&
      typeof value.fileId === 'string' &&
      'file_url' in value &&
      typeof value.file_url === 'string'
  );

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The selected image could not be read.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const uploadSellerProductImage = async (file: File) => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Images must be smaller than 5 MB.');
  }

  const dataUrl = await fileToDataUrl(file);
  const { data } = await sellerApi.post('/product/api/upload-product-image', {
    fileName: dataUrl,
  });
  const image: unknown = {
    fileId: data?.fileId,
    file_url: data?.file_url,
  };
  if (!isUploadedSellerProductImage(image)) {
    throw new Error('The product service returned an invalid uploaded image.');
  }
  return image;
};

export const deleteSellerProductImage = async (fileId: string) => {
  const { data } = await sellerApi.delete('/product/api/delete-product-image', {
    data: { fileId },
  });
  return data;
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
