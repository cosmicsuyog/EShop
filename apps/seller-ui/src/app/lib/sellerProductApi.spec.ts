import { sellerApi } from './sellerApi';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProducts,
  restoreSellerProduct,
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

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('rejects invalid service responses', async () => {
    get.mockResolvedValue({ data: { products: [{ id: 'bad' }] } } as never);
    await expect(getSellerProducts()).rejects.toThrow(
      'The product service returned an invalid product list.'
    );
  });
});
