import { sellerApi } from './sellerApi';

export type SellerDiscountCode = {
  id: string;
  public_name: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountCode: string;
  createdAt: string;
};

export type CreateDiscountCodeInput = {
  public_name: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountCode: string;
};

const isDiscountCode = (value: unknown): value is SellerDiscountCode =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'public_name' in value &&
      typeof value.public_name === 'string' &&
      'discountType' in value &&
      (value.discountType === 'percentage' || value.discountType === 'flat') &&
      'discountValue' in value &&
      typeof value.discountValue === 'number' &&
      'discountCode' in value &&
      typeof value.discountCode === 'string'
  );

export const getSellerDiscountCodes = async (): Promise<SellerDiscountCode[]> => {
  const { data } = await sellerApi.get('/product/api/get-discount-codes');
  const list = data?.discount_codes;
  if (!Array.isArray(list) || !list.every(isDiscountCode)) {
    throw new Error('The product service returned an invalid discount code list.');
  }
  return list;
};

export const createSellerDiscountCode = async (
  input: CreateDiscountCodeInput
): Promise<SellerDiscountCode> => {
  const { data } = await sellerApi.post('/product/api/create-discount-code', input);
  const code = data?.discount_code;
  if (!isDiscountCode(code)) {
    throw new Error('The product service returned an invalid discount code.');
  }
  return code;
};

export const deleteSellerDiscountCode = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await sellerApi.delete(
    `/product/api/delete-discount-code/${encodeURIComponent(id)}`
  );
  return data;
};
