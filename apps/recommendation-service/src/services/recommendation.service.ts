import * as tf from '@tensorflow/tfjs';
import { getUserActivity } from './fetch-user-activity.js';
import { preprocessData, type Interaction, type UserAction } from '../utils/preprocess-data.js';

export const EMBEDDING_DIM = 50;
export const EPOCHS = 5;
export const BATCH_SIZE = 32;
export const TOP_K = 10;
export const NEGATIVE_SAMPLES_PER_USER = 2;

export type RecommendedProduct = { productId: string; score: number };
export type RecommendationProduct = { id: string };

const actionWeight = (actionType: string) => {
  switch (actionType) {
    case 'purchase': return 1;
    case 'add_to_cart': return 0.7;
    case 'add_to_wishlist': return 0.5;
    case 'product_view': return 0.1;
    default: return 0;
  }
};

const addNegativeSamples = (interactions: Interaction[]) => {
  const byUser = new Map<string, Set<string>>();
  for (const interaction of interactions) {
    const products = byUser.get(interaction.userId) ?? new Set<string>();
    products.add(interaction.productId);
    byUser.set(interaction.userId, products);
  }
  const allProducts = [...new Set(interactions.map((item) => item.productId))];
  const negatives: Interaction[] = [];
  for (const [userId, touched] of byUser) {
    const candidates = allProducts.filter((productId) => !touched.has(productId));
    for (let index = 0; index < Math.min(NEGATIVE_SAMPLES_PER_USER, candidates.length); index += 1) {
      negatives.push({ userId, productId: candidates[index], actionType: '__negative__' });
    }
  }
  return negatives;
};

/** Trains a small collaborative-filtering model and returns ranked product ids. */
export async function recommendProducts(
  userId: string,
  allProducts: RecommendationProduct[]
): Promise<string[]> {
  let model: tf.LayersModel | undefined;
  const tensors: tf.Tensor[] = [];
  try {
    const rawActions = ((await getUserActivity(userId)) as UserAction[]).map((action) => ({ ...action, userId: action.userId ?? userId }));
    if (rawActions.length === 0 || allProducts.length === 0) return [];
    const processed = preprocessData(rawActions, allProducts);
    if (processed.interactions.length === 0) return [];

    const userMap: Record<string, number> = { [userId]: 0 };
    const productMap: Record<string, number> = {};
    for (const product of allProducts) productMap[product.id] ??= Object.keys(productMap).length;
    for (const interaction of processed.interactions) {
      userMap[interaction.userId] ??= Object.keys(userMap).length;
    }
    const interactions = [...processed.interactions, ...addNegativeSamples(processed.interactions)];
    const userCount = Object.keys(userMap).length;
    const productCount = Object.keys(productMap).length;
    const userInput = tf.input({ shape: [1], dtype: 'int32' });
    const productInput = tf.input({ shape: [1], dtype: 'int32' });
    const userVector = tf.layers.flatten().apply(tf.layers.embedding({ inputDim: userCount, outputDim: EMBEDDING_DIM }).apply(userInput) as tf.SymbolicTensor) as tf.SymbolicTensor;
    const productVector = tf.layers.flatten().apply(tf.layers.embedding({ inputDim: productCount, outputDim: EMBEDDING_DIM }).apply(productInput) as tf.SymbolicTensor) as tf.SymbolicTensor;
    const merged = tf.layers.dot({ axes: 1 }).apply([userVector, productVector]) as tf.SymbolicTensor;
    const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(merged) as tf.SymbolicTensor;
    model = tf.model({ inputs: [userInput, productInput], outputs: output });
    model.compile({ optimizer: tf.train.adam(), loss: 'binaryCrossentropy', metrics: ['accuracy'] });

    const userTensor = tf.tensor1d(interactions.map((item) => userMap[item.userId] ?? 0), 'int32');
    const productTensor = tf.tensor1d(interactions.map((item) => productMap[item.productId] ?? 0), 'int32');
    const labels = tf.tensor2d(interactions.map((item) => [actionWeight(item.actionType)]));
    tensors.push(userTensor, productTensor, labels);
    await model.fit([userTensor, productTensor], labels, { epochs: EPOCHS, batchSize: BATCH_SIZE, shuffle: true, verbose: 0 });

    const productIds = Object.keys(productMap);
    const allProductTensor = tf.tensor1d(productIds.map((id) => productMap[id]), 'int32');
    const userForAll = tf.tensor1d(productIds.map(() => userMap[userId] ?? 0), 'int32');
    tensors.push(allProductTensor, userForAll);
    const predictions = model.predict([userForAll, allProductTensor]) as tf.Tensor;
    tensors.push(predictions);
    const scores = Array.from(await predictions.data());
    const purchased = new Set(processed.interactions.filter((item) => item.actionType === 'purchase').map((item) => item.productId));
    return productIds.map((productId, index): RecommendedProduct => ({ productId, score: Number(scores[index] ?? 0) }))
      .filter((item) => !purchased.has(item.productId))
      .sort((left, right) => right.score - left.score)
      .slice(0, TOP_K)
      .map((item) => item.productId);
  } catch (error) {
    console.error('Recommendation training failed.', error);
    return [];
  } finally {
    tf.dispose(tensors);
    model?.dispose();
  }
}
