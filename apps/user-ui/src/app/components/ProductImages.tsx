'use client';

import Image from 'next/image';
import { useState } from 'react';

type ProductImage = {
  url: string;
};

type ProductImagesProps = {
  images: ProductImage[];
  title: string;
  fallbackLabel: string;
  variant: 'card' | 'detail';
};

export default function ProductImages({
  images,
  title,
  fallbackLabel,
  variant,
}: ProductImagesProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(
    () => new Set()
  );
  const selectedImage = images[selectedIndex];
  const selectedImageFailed = failedImages.has(selectedIndex);

  const markImageFailed = (index: number) => {
    setFailedImages((current) => new Set(current).add(index));
  };

  return (
    <div className={`product-image-gallery is-${variant}`}>
      <div className="product-image-frame">
        {selectedImage && !selectedImageFailed ? (
          <Image
            alt={title}
            className="product-image"
            fill
            onError={() => markImageFailed(selectedIndex)}
            sizes={
              variant === 'card' ? '(max-width: 560px) 100vw, 33vw' : '50vw'
            }
            src={selectedImage.url}
            unoptimized
          />
        ) : (
          <span className="product-image-fallback" aria-hidden="true">
            {fallbackLabel}
          </span>
        )}
      </div>

      {variant === 'detail' && images.length > 1 && (
        <div className="product-image-thumbnails" aria-label="Product images">
          {images.map((image, index) => (
            <button
              aria-label={`Show product image ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={selectedIndex === index ? 'is-selected' : undefined}
              key={`${image.url}-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {failedImages.has(index) ? (
                <span aria-hidden="true">{fallbackLabel}</span>
              ) : (
                <Image
                  alt=""
                  height={56}
                  onError={() => markImageFailed(index)}
                  src={image.url}
                  unoptimized
                  width={56}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
