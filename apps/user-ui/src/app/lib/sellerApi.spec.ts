import { sellerApi } from './sellerApi';
import {
  createSellerShop,
  getCurrentSeller,
  getSellerApiErrorMessage,
  getSafeSellerProfile,
  isSafeSeller,
  loginSeller,
  registerSeller,
  verifySeller,
} from './sellerApi';
import {
  validateSellerRegistration,
  validateSellerShop,
} from './sellerFormValidation';

const seller = {
  id: 'seller-id',
  name: 'Seller One',
  email: 'seller@example.com',
  phone_number: '+1 555 0100',
  country: 'United States',
};

const shop = {
  id: 'shop-id',
  name: 'My Shop',
  bio: 'A helpful shop',
  category: 'clothing',
  website: null,
  address: '1 Market Street',
  opening_hours: 'Mon-Fri 9-5',
};

describe('seller API client and onboarding validation', () => {
  const post = jest.spyOn(sellerApi, 'post');
  const get = jest.spyOn(sellerApi, 'get');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends seller registration with the reference identity fields', async () => {
    post.mockResolvedValue({ data: { success: true } } as never);
    const values = {
      ...seller,
      password: 'seller-password',
    };

    await registerSeller(values);

    expect(post).toHaveBeenCalledWith('/api/seller-registration', values);
  });

  it('verifies registration and accepts only a safe seller profile', async () => {
    post.mockResolvedValue({
      data: { seller: { ...seller, password: 'must-not-be-exposed' } },
    } as never);

    await expect(
      verifySeller({ ...seller, password: 'seller-password' }, '123456')
    ).resolves.toEqual(seller);
    expect(post).toHaveBeenCalledWith('/api/verify-seller', {
      ...seller,
      password: 'seller-password',
      otp: '123456',
    });
  });

  it('logs in and restores the authenticated seller profile', async () => {
    post.mockResolvedValue({ data: { seller } } as never);
    get.mockResolvedValue({ data: { seller: { ...seller, shop } } } as never);

    await expect(loginSeller(seller.email, 'seller-password')).resolves.toEqual(
      seller
    );
    await expect(getCurrentSeller()).resolves.toEqual({ ...seller, shop });
    expect(get).toHaveBeenCalledWith('/api/logged-in-seller');
  });

  it('creates a shop without sending seller ownership from the browser', async () => {
    post.mockResolvedValue({ data: { shop } } as never);
    const values = {
      name: shop.name,
      bio: shop.bio,
      address: shop.address,
      opening_hours: shop.opening_hours,
      category: shop.category,
    };

    await expect(createSellerShop(values)).resolves.toEqual(shop);
    expect(post).toHaveBeenCalledWith('/api/create-shop', values);
    expect(post.mock.calls[0][1]).not.toHaveProperty('sellerId');
  });

  it('rejects malformed or sensitive seller profile responses', async () => {
    expect(isSafeSeller({ ...seller, password: 'hash' })).toBe(true);
    expect(
      getSafeSellerProfile({ ...seller, password: 'hash' })
    ).not.toHaveProperty('password');
    expect(getSafeSellerProfile({ id: 'seller-id', password: 'hash' })).toBe(
      null
    );

    post.mockResolvedValue({
      data: { seller: { ...seller, name: 7 } },
    } as never);
    await expect(loginSeller(seller.email, 'seller-password')).rejects.toThrow(
      'The authentication service returned an invalid seller.'
    );

    get.mockResolvedValue({
      data: {
        seller: {
          ...seller,
          password: 'hash',
          shop: { ...shop, sellerId: 'private-owner-id' },
        },
      },
    } as never);
    await expect(getCurrentSeller()).resolves.toEqual({
      ...seller,
      shop,
    });
  });

  it('validates reference registration and shop requirements', () => {
    expect(
      validateSellerRegistration({
        name: 'Seller',
        email: seller.email,
        password: 'pass',
        phone_number: seller.phone_number,
        country: seller.country,
      })
    ).toBeNull();
    expect(
      validateSellerRegistration({
        name: '',
        email: '',
        password: '',
        phone_number: '',
        country: '',
      })
    ).toContain('Name');

    expect(
      validateSellerShop({
        name: shop.name,
        bio: shop.bio,
        address: shop.address,
        opening_hours: shop.opening_hours,
        website: '',
        category: shop.category,
      })
    ).toBeNull();
    expect(
      validateSellerShop({
        name: shop.name,
        bio: Array.from({ length: 101 }, () => 'word').join(' '),
        address: shop.address,
        opening_hours: shop.opening_hours,
        website: '',
        category: shop.category,
      })
    ).toContain('100 words');
  });

  it('shows API validation messages and a generic error fallback', () => {
    expect(
      getSellerApiErrorMessage({
        response: { data: { message: 'Invalid seller details.' } },
        isAxiosError: true,
      })
    ).toBe('Invalid seller details.');
    expect(getSellerApiErrorMessage(new Error('request failed'))).toBe(
      'We could not complete your request. Please try again.'
    );
  });
});
