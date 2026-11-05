import prisma from '@packages/libs/prisma/index.js';
import {
  deleteSellerProductImage,
  getSellerImageIds,
  uploadSellerProductImage,
  validateProductImageIds,
} from './product-image.service.js';

const pngDataUrl = () =>
  `data:image/png;base64,${Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3,
  ]).toString('base64')}`;

describe('seller product image service', () => {
  const count = jest.mocked(prisma.images.count);
  const create = jest.mocked(prisma.images.create);
  const findFirst = jest.mocked(prisma.images.findFirst);
  const findMany = jest.mocked(prisma.images.findMany);
  const updateMany = jest.mocked(prisma.images.updateMany);
  const remove = jest.mocked(prisma.images.delete);
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    count.mockReset().mockResolvedValue(0 as never);
    create.mockReset();
    findFirst.mockReset();
    findMany.mockReset();
    updateMany.mockReset();
    remove.mockReset();
    process.env.IMAGEKIT_PRIVATE_KEY = 'test-only-imagekit-key';
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          fileId: 'imagekit-file_123',
          url: 'https://ik.imagekit.io/eshop/products/test.png',
        }),
        { status: 201 }
      )
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    delete process.env.IMAGEKIT_PRIVATE_KEY;
  });

  it('uploads a validated image and records ownership from verified seller identity', async () => {
    create.mockResolvedValue({} as never);

    await expect(
      uploadSellerProductImage('seller-one', pngDataUrl())
    ).resolves.toEqual({
      fileId: 'imagekit-file_123',
      file_url: 'https://ik.imagekit.io/eshop/products/test.png',
    });

    expect(count).toHaveBeenCalledWith({
      where: { sellerId: 'seller-one', productId: null, isDeleting: false },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        file_id: 'imagekit-file_123',
        url: 'https://ik.imagekit.io/eshop/products/test.png',
        sellerId: 'seller-one',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://upload.imagekit.io/api/v1/files/upload');
    expect(options.method).toBe('POST');
    expect((options.body as FormData).get('folder')).toBe('/products');
    expect(options.headers).toEqual({
      Authorization: `Basic ${Buffer.from('test-only-imagekit-key:').toString('base64')}`,
    });
  });

  it('rejects unsupported image data before calling the provider', async () => {
    await expect(
      uploadSellerProductImage('seller-one', 'data:image/svg+xml;base64,PHN2Zz4=')
    ).rejects.toThrow('Upload a valid PNG, JPEG, or WebP image.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects image content whose bytes do not match its declared MIME type', async () => {
    const badDataUrl = `data:image/png;base64,${Buffer.from('not an image').toString('base64')}`;
    await expect(
      uploadSellerProductImage('seller-one', badDataUrl)
    ).rejects.toThrow('The image content does not match its file type.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enforces the maximum number of pending uploads per seller', async () => {
    count.mockResolvedValue(8 as never);
    await expect(
      uploadSellerProductImage('seller-one', pngDataUrl())
    ).rejects.toThrow('A seller can have at most 8 uploaded product images at a time.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides provider failures behind a safe service error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'private provider details' }), {
        status: 503,
      })
    );
    await expect(
      uploadSellerProductImage('seller-one', pngDataUrl())
    ).rejects.toThrow('The image provider could not complete the request.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not delete an image owned by another seller', async () => {
    findFirst.mockResolvedValue(null as never);
    await expect(
      deleteSellerProductImage('seller-two', 'imagekit-file_123')
    ).rejects.toThrow('Image not found.');
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        file_id: 'imagekit-file_123',
        sellerId: 'seller-two',
        productId: null,
        isDeleting: false,
      },
      select: { id: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes only a seller-owned image that is not attached to a product', async () => {
    findFirst.mockResolvedValue({ id: 'image-record-1' } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    remove.mockResolvedValue({} as never);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      deleteSellerProductImage('seller-one', 'imagekit-file_123')
    ).resolves.toEqual({
      success: true,
      message: 'Product image deleted successfully.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.imagekit.io/v1/files/imagekit-file_123',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(remove).toHaveBeenCalledWith({ where: { id: 'image-record-1' } });
  });

  it('restores the pending image record if provider deletion fails', async () => {
    findFirst.mockResolvedValue({ id: 'image-record-1' } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));

    await expect(
      deleteSellerProductImage('seller-one', 'imagekit-file_123')
    ).rejects.toThrow('The image provider could not complete the request.');
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'image-record-1', sellerId: 'seller-one', isDeleting: true },
      data: { isDeleting: false },
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('accepts only unique uploaded IDs belonging to the authenticated seller', async () => {
    expect(validateProductImageIds([{ fileId: 'imagekit-file_123' }])).toEqual([
      'imagekit-file_123',
    ]);
    expect(() =>
      validateProductImageIds([
        { fileId: 'imagekit-file_123' },
        { fileId: 'imagekit-file_123' },
      ])
    ).toThrow('Duplicate image IDs are not allowed.');

    findMany.mockResolvedValue([{ id: 'image-record-1', file_id: 'imagekit-file_123' }] as never);
    await expect(
      getSellerImageIds('seller-one', ['imagekit-file_123'])
    ).resolves.toEqual([
      { id: 'image-record-1', file_id: 'imagekit-file_123' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        file_id: { in: ['imagekit-file_123'] },
        sellerId: 'seller-one',
        productId: null,
        isDeleting: false,
      },
      select: { id: true, file_id: true },
    });

    findMany.mockResolvedValue([] as never);
    await expect(
      getSellerImageIds('seller-two', ['imagekit-file_123'])
    ).rejects.toThrow('One or more uploaded images are not available to this seller.');
  });
});
