# Database design

Prisma ORM 6 uses the MongoDB provider and reads DATABASE_URL. The schema is prisma/schema.prisma; Prisma Client output is configured at generated/prisma/.

## Main models

- users: customer profile, unique email, session version, optional avatar, and cart relationship.
- sellers: seller identity, unique email, optional Stripe account ID, shop, uploaded images, and discount codes.
- shops: seller-owned shop profile and product relationship.
- products: catalog fields, category/subcategory, inventory and prices, tags/options, status, soft-delete fields, shop relationship, images, and cart references.
- images: ImageKit file ID and URL, optional customer/product/seller ownership, plus a deletion-in-progress flag.
- discount_codes: globally unique code, discount type/value, public name, and seller relationship.
- carts and cartItems: one cart per customer and unique product item per cart.

The schema defines unique constraints for account email, product slug, shop seller, Stripe account ID, image file ID, discount code, cart owner, and cart/product pair. It also defines an index for cart item product ID. The actual local index state must be checked after schema synchronization.

## Development synchronization

This repository uses MongoDB and prisma db push for local schema synchronization; SQL migration commands do not apply. Run Prisma through the local guard:

~~~powershell
./tools/Invoke-LocalPrisma.ps1 validate
./tools/Invoke-LocalPrisma.ps1 generate
./tools/Invoke-LocalPrisma.ps1 db push
~~~

The guard accepts only 127.0.0.1:27018/eshop_development with replica set eshop-dev. Do not run a schema write against a shared or production database.

See [local services](../development/local-services.md) for replica-set setup and [known limitations](../project/known-limitations.md) for current verification status.
