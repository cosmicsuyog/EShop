import { sellerApi } from './sellerApi';
import {
  createSellerProduct,
  deleteSellerProductImage,
  deleteSellerProduct,
  getSellerProducts,
  restoreSellerProduct,
  uploadSellerProductImage,
} from './sellerProductApi';

const product = {
  id: '507f1f77bcf86cd799439003',
  title: 'Canvas Backpack',
  slug: 'canvas-backpack',
  isDeleted: false,
  images: [],
};

describe('seller product API client', () => {
  const get = jest.spyOn(sellerApi, 'get');
  const post = jest.spyOn(sellerApi, 'post');
  const deleteRequest = jest.spyOn(sellerApi, 'delete');
  const put = jest.spyOn(sellerApi, 'put');
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: originalFileReader,
    });
  });

  it('fetches the authenticated seller product list', async () => {
    get.mockResolvedValue({ data: { products: [product] } } as never);

    await expect(getSellerProducts()).resolves.toEqual([product]);
    expect(get).toHaveBeenCalledWith('/product/api/get-shop-products');
  });

  it('creates a product without client-supplied ownership identifiers', async () => {
    post.mockResolvedValue({ data: { product } } as never);
    const input = {
      title: 'Canvas Backpack',
      slug: 'canvas-backpack',
      short_description: 'A durable backpack.',
      detailed_description: 'A durable everyday backpack.',
      category: 'Accessories',
      subcategory: 'Bags',
      tags: [],
      colors: [],
      sizes: [],
      stock: 12,
      sale_price: 49.99,
      regular_price: 59.99,
    };

    await expect(createSellerProduct(input)).resolves.toEqual(product);
    expect(post).toHaveBeenCalledWith('/product/api/create-product', input);
    expect(post.mock.calls[0][1]).not.toHaveProperty('sellerId');
    expect(post.mock.calls[0][1]).not.toHaveProperty('shopId');
  });

  it('deletes and restores products through the reference lifecycle endpoints', async () => {
    deleteRequest.mockResolvedValue({ data: { success: true } } as never);
    put.mockResolvedValue({ data: { success: true } } as never);
    const productId = product.id;

    await deleteSellerProduct(productId);
    await restoreSellerProduct(productId);

    expect(deleteRequest).toHaveBeenCalledWith(
      `/product/api/delete-product/${productId}`
    );
    expect(put).toHaveBeenCalledWith(
      `/product/api/restore-product/${productId}`
    );
  });

  it('uploads supported seller images through the authenticated product API', async () => {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: class {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.result = 'data:image/png;base64,iVBORw0KGgo=';
          this.onload?.();
        }
      },
    });
    post.mockResolvedValue({
      data: {
        fileId: 'imagekit-file_123',
        file_url: 'https://ik.imagekit.io/eshop/products/test.png',
      },
    } as never);

    const file = { type: 'image/png', size: 64 } as File;
    await expect(uploadSellerProductImage(file)).resolves.toEqual({
      fileId: 'imagekit-file_123',
      file_url: 'https://ik.imagekit.io/eshop/products/test.png',
    });
    expect(post).toHaveBeenCalledWith('/product/api/upload-product-image', {
      fileName: 'data:image/png;base64,iVBORw0KGgo=',
    });

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: originalFileReader,
    });
  });

  it('removes only an uploaded image through the seller API', async () => {
    deleteRequest.mockResolvedValue({ data: { success: true } } as never);
    await deleteSellerProductImage('imagekit-file_123');
    expect(deleteRequest).toHaveBeenCalledWith(
      '/product/api/delete-product-image',
      { data: { fileId: 'imagekit-file_123' } }
    );
  });

  it('rejects invalid service responses', async () => {
    get.mockResolvedValue({ data: { products: [{ id: 'bad' }] } } as never);
    await expect(getSellerProducts()).rejects.toThrow(
      'The product service returned an invalid product list.'
    );
  });
});
