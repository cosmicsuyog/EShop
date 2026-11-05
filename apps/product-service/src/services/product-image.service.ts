import { createHash, randomUUID } from 'node:crypto';
import prisma from '@packages/libs/prisma/index.js';
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '@packages/error-handler/index.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SELLER_IMAGES = 8;
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const IMAGEKIT_FILE_API_URL = 'https://api.imagekit.io/v1/files';

const parseDataImage = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new ValidationError('Image data is required.');
  }

  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    throw new ValidationError('Upload a valid PNG, JPEG, or WebP image.');
  }

  const mimeType = `image/${match[1]}`;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('Images must be smaller than 5 MB.');
  }

  const isPng =
    mimeType === 'image/png' &&
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg =
    mimeType === 'image/jpeg' &&
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isWebp =
    mimeType === 'image/webp' &&
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) {
    throw new ValidationError('The image content does not match its file type.');
  }

  return {
    mimeType,
    extension: match[1] === 'jpeg' ? 'jpg' : match[1],
    bytes,
  };
};

const getImageKitAuthorization = () => {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    throw new DatabaseError('Image uploads are not configured.');
  }
  return `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`;
};

const providerJson = async (response: Response) => {
  if (!response.ok) {
    throw new DatabaseError('The image provider could not complete the request.');
  }

  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new DatabaseError('The image provider returned an invalid response.');
  }
};

const uploadToImageKit = async (
  sellerId: string,
  image: ReturnType<typeof parseDataImage>
) => {
  const authorization = getImageKitAuthorization();
  const sellerTag = createHash('sha256').update(sellerId).digest('hex').slice(0, 16);
  const fileName = `seller-${sellerTag}-${randomUUID()}.${image.extension}`;
  const form = new FormData();
  form.append('file', new Blob([image.bytes], { type: image.mimeType }), fileName);
  form.append('fileName', fileName);
  form.append('folder', '/products');

  let result: Record<string, unknown>;
  try {
    result = await providerJson(
      await fetch(IMAGEKIT_UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: authorization },
        body: form,
        signal: AbortSignal.timeout(15_000),
      })
    );
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('The image provider could not complete the upload.');
  }

  const fileId = result.fileId;
  const url = result.url;
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fileId)) {
    throw new DatabaseError('The image provider returned an invalid file ID.');
  }
  if (typeof url !== 'string') {
    throw new DatabaseError('The image provider returned an invalid image URL.');
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(url);
  } catch {
    throw new DatabaseError('The image provider returned an invalid image URL.');
  }
  if (imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password) {
    throw new DatabaseError('The image provider returned an unsafe image URL.');
  }

  return { fileId, url: imageUrl.toString(), fileName };
};

const deleteFromImageKit = async (fileId: string) => {
  const authorization = getImageKitAuthorization();
  try {
    const response = await fetch(
      `${IMAGEKIT_FILE_API_URL}/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) {
      throw new DatabaseError('The image provider could not complete the request.');
    }
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('The image provider could not complete the deletion.');
  }
};

export const uploadSellerProductImage = async (
  sellerId: string,
  dataUrl: unknown
) => {
  const image = parseDataImage(dataUrl);
  const currentCount = await prisma.images.count({
    where: { sellerId, productId: null, isDeleting: false },
  });
  if (currentCount >= MAX_SELLER_IMAGES) {
    throw new ConflictError(`A seller can have at most ${MAX_SELLER_IMAGES} uploaded product images at a time.`);
  }

  const uploaded = await uploadToImageKit(sellerId, image);
  try {
    await prisma.images.create({
      data: {
        file_id: uploaded.fileId,
        url: uploaded.url,
        sellerId,
      },
    });
  } catch (error) {
    try {
      await deleteFromImageKit(uploaded.fileId);
    } catch {
      // Keep the database error as the response; cleanup can be retried manually.
    }
    throw error;
  }

  return { fileId: uploaded.fileId, file_url: uploaded.url };
};

export const deleteSellerProductImage = async (
  sellerId: string,
  fileIdValue: unknown
) => {
  if (typeof fileIdValue !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fileIdValue)) {
    throw new ValidationError('Image file ID is invalid.');
  }

  const image = await prisma.images.findFirst({
    where: {
      file_id: fileIdValue,
      sellerId,
      productId: null,
      isDeleting: false,
    },
    select: { id: true },
  });
  if (!image) {
    throw new NotFoundError('Image not found.');
  }

  const claim = await prisma.images.updateMany({
    where: {
      id: image.id,
      sellerId,
      productId: null,
      isDeleting: false,
    },
    data: { isDeleting: true },
  });
  if (claim.count !== 1) {
    throw new NotFoundError('Image not found.');
  }

  try {
    await deleteFromImageKit(fileIdValue);
    await prisma.images.delete({ where: { id: image.id } });
  } catch (error) {
    await prisma.images.updateMany({
      where: { id: image.id, sellerId, isDeleting: true },
      data: { isDeleting: false },
    });
    throw error;
  }

  return { success: true, message: 'Product image deleted successfully.' };
};

export const getSellerImageIds = async (
  sellerId: string,
  fileIds: string[]
) => {
  if (fileIds.length === 0) return [];
  const images = await prisma.images.findMany({
    where: {
      file_id: { in: fileIds },
      sellerId,
      productId: null,
      isDeleting: false,
    },
    select: { id: true, file_id: true },
  });
  if (images.length !== fileIds.length) {
    throw new ValidationError('One or more uploaded images are not available to this seller.');
  }
  return images;
};

export const validateProductImageIds = (value: unknown) => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > MAX_SELLER_IMAGES ||
    !value.every(
      (image) =>
        image &&
        typeof image === 'object' &&
        !Array.isArray(image) &&
        'fileId' in image &&
        typeof image.fileId === 'string' &&
        /^[A-Za-z0-9_-]{1,200}$/.test(image.fileId)
    )
  ) {
    throw new ValidationError(`Images must contain at most ${MAX_SELLER_IMAGES} uploaded image IDs.`);
  }

  const fileIds = value.map((image) => (image as { fileId: string }).fileId);
  if (new Set(fileIds).size !== fileIds.length) {
    throw new ValidationError('Duplicate image IDs are not allowed.');
  }
  return fileIds;
};
