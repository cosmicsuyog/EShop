import { sellerApi } from './sellerApi';
import {
  createSellerDiscountCode,
  deleteSellerDiscountCode,
  getSellerDiscountCodes,
} from './sellerDiscountApi';

const discount = {
  id: '507f1f77bcf86cd799439004',
  public_name: 'Summer Sale',
  discountType: 'percentage' as const,
  discountValue: 20,
  discountCode: 'SUMMER20',
  createdAt: '2026-11-05T00:00:00.000Z',
};

describe('seller discount API client', () => {
  const get = jest.spyOn(sellerApi, 'get');
  const post = jest.spyOn(sellerApi, 'post');
  const deleteRequest = jest.spyOn(sellerApi, 'delete');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the authenticated seller discount list', async () => {
    get.mockResolvedValue({ data: { discount_codes: [discount] } } as never);

    await expect(getSellerDiscountCodes()).resolves.toEqual([discount]);
    expect(get).toHaveBeenCalledWith('/product/api/get-discount-codes');
  });

  it('creates a code through the seller endpoint without an ownership ID', async () => {
    const input = {
      public_name: 'Summer Sale',
      discountType: 'percentage' as const,
      discountValue: 20,
      discountCode: 'SUMMER20',
    };
    post.mockResolvedValue({ data: { discount_code: discount } } as never);

    await expect(createSellerDiscountCode(input)).resolves.toEqual(discount);
    expect(post).toHaveBeenCalledWith('/product/api/create-discount-code', input);
    expect(post.mock.calls[0][1]).not.toHaveProperty('sellerId');
  });

  it('deletes a code using an encoded identifier', async () => {
    deleteRequest.mockResolvedValue({ data: { success: true } } as never);
    const id = 'seller code/id';

    await expect(deleteSellerDiscountCode(id)).resolves.toEqual({ success: true });
    expect(deleteRequest).toHaveBeenCalledWith(
      '/product/api/delete-discount-code/seller%20code%2Fid'
    );
  });

  it('rejects an invalid discount list response', async () => {
    get.mockResolvedValue({ data: { discount_codes: [{ id: 'bad' }] } } as never);

    await expect(getSellerDiscountCodes()).rejects.toThrow(
      'The product service returned an invalid discount code list.'
    );
  });
});
