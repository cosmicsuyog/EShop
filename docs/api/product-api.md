# Product API

Product Service routes are mounted at /api and proxied by the gateway under /product. The examples below use gateway paths.

## Public catalog

| Method | Route | Notes |
| --- | --- | --- |
| GET | /product/api/categories | List category names |
| GET | /product/api/subcategories?category=... | Requires a non-empty category |
| GET | /product/api/products | Optional category, subcategory, q, page, limit; defaults to page 1 and 20 items, maximum limit 100 |
| GET | /product/api/products/:slug | Fetch a product by lowercase slug |

## Seller product and image routes

These operations require a verified seller session.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /product/api/create-product | Create a product in the seller's shop |
| GET | /product/api/get-shop-products | List products for the authenticated seller |
| DELETE | /product/api/delete-product/:productId | Soft-delete an owned product |
| PUT | /product/api/restore-product/:productId | Restore an owned soft-deleted product |
| POST | /product/api/upload-product-image | Upload an unattached seller image |
| DELETE | /product/api/delete-product-image | Remove an owned unattached image |

The image endpoint expects a data URL under fileName in JSON. The service validates PNG/JPEG/WebP content, enforces a 5 MiB per-image limit, and supports up to eight pending uploads per seller. ImageKit credentials are required.

## Validation

Catalog pagination values must be positive integers; page size is capped at 100. Category/subcategory values are bounded strings, search is capped at 100 characters, and product slugs must use lowercase letters, numbers, and single hyphens.

Product creation validates submitted fields and confirms that referenced image IDs belong to the authenticated seller. There is no general product edit endpoint in the current router.

See [seller API](seller-api.md) for discount routes and [database design](../architecture/database-design.md) for the product model.
