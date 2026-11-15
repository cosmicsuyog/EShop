import 'dotenv/config';
import prisma from '../Packages/libs/prisma/index.js';

const PREFIX = 'recommendation-seed';
const CATEGORIES = ['Electronics', 'Home & Kitchen', 'Fashion', 'Sports & Fitness'];
const SUBCATEGORIES = ['Mobiles', 'Accessories', 'Lighting', 'Outdoor'];
const ACTIONS = ['product_view', 'add_to_cart', 'add_to_wishlist', 'purchase'] as const;

const userId = process.argv.find((argument) => argument.startsWith('--user='))?.slice(7);
const reset = process.argv.includes('--reset');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed recommendation data while NODE_ENV=production.');
}

const run = async () => {
  if (reset) {
    await prisma.products.deleteMany({ where: { slug: { startsWith: `${PREFIX}-` } } });
    await prisma.shops.deleteMany({ where: { name: { startsWith: `${PREFIX} shop` } } });
    await prisma.sellers.deleteMany({ where: { email: { startsWith: `${PREFIX}-seller-` } } });
  }

  const shops: Array<{ id: string; sellerId: string }> = [];
  for (let index = 0; index < 50; index += 1) {
    const email = `${PREFIX}-seller-${index}@example.invalid`;
    const seller = await prisma.sellers.upsert({
      where: { email },
      update: { name: `Seed Seller ${index}`, country: 'India', phone_number: `+91000000${String(index).padStart(3, '0')}` },
      create: { name: `Seed Seller ${index}`, email, phone_number: `+91000000${String(index).padStart(3, '0')}`, country: 'India', password: 'seed-only-password' },
      select: { id: true },
    });
    const shop = await prisma.shops.upsert({
      where: { sellerId: seller.id },
      update: { name: `${PREFIX} shop ${index}`, category: CATEGORIES[index % CATEGORIES.length], bio: 'Seed shop for recommendation testing.', address: 'Local development' },
      create: { name: `${PREFIX} shop ${index}`, category: CATEGORIES[index % CATEGORIES.length], bio: 'Seed shop for recommendation testing.', address: 'Local development', sellerId: seller.id },
      select: { id: true, sellerId: true },
    });
    if (shop.sellerId) shops.push({ id: shop.id, sellerId: shop.sellerId });
  }

  const products: Array<{ id: string; shopId: string }> = [];
  for (let index = 0; index < 100; index += 1) {
    const shop = shops[index % shops.length];
    const isOffer = index < 10;
    const product = await prisma.products.upsert({
      where: { slug: `${PREFIX}-product-${index}` },
      update: { title: `Seed Product ${index}`, shopId: shop.id, category: CATEGORIES[index % CATEGORIES.length], subcategory: SUBCATEGORIES[index % SUBCATEGORIES.length], starting_date: isOffer ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, ending_date: isOffer ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null, stock: 25 + (index % 50), sale_price: 10 + index, regular_price: 15 + index, isDeleted: false, tags: ['seed', 'recommendation'], colors: ['Black', 'Blue'], sizes: ['S', 'M', 'L'] },
      create: { title: `Seed Product ${index}`, slug: `${PREFIX}-product-${index}`, category: CATEGORIES[index % CATEGORIES.length], subcategory: SUBCATEGORIES[index % SUBCATEGORIES.length], short_description: 'Seed product for local recommendation testing.', detailed_description: 'Generated development data only.', tags: ['seed', 'recommendation'], brand: 'EShop Labs', colors: ['Black', 'Blue'], sizes: ['S', 'M', 'L'], starting_date: isOffer ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, ending_date: isOffer ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null, stock: 25 + (index % 50), sale_price: 10 + index, regular_price: 15 + index, shopId: shop.id },
      select: { id: true, shopId: true },
    });
    products.push(product);
  }

  if (userId) {
    const actions = Array.from({ length: 100 }, (_, index) => {
      const product = products[(index * 7) % products.length];
      return { userId, productId: product.id, shopId: product.shopId, action: ACTIONS[index % ACTIONS.length], timestamp: new Date(Date.now() - index * 60 * 60 * 1000).toISOString() };
    });
    await prisma.userAnalytics.upsert({ where: { userId }, update: { actions, recommendations: [], lastTrained: null, lastVisited: new Date() }, create: { userId, actions, recommendations: [], lastVisited: new Date() } });
  }
  console.log(`Seeded ${shops.length} shops and ${products.length} products${userId ? ` plus 100 actions for ${userId}` : ''}.`);
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
