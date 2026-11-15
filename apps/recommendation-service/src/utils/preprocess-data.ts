export type UserAction = {
  userId?: string;
  productId?: string;
  shopId?: string;
  action?: string;
  actionType?: string;
  timestamp?: string;
};

export type Interaction = {
  userId: string;
  productId: string;
  actionType: string;
};

export type RecommendationProduct = { id: string };

/** Normalizes the stored `action` shape into the model's `actionType` shape. */
export const preprocessData = (
  userActions: UserAction[],
  products: RecommendationProduct[]
) => {
  const knownProducts = new Set(products.map((product) => product.id));
  const interactions = userActions.flatMap<Interaction>((action) => {
    const userId = typeof action.userId === 'string' ? action.userId : undefined;
    const productId = typeof action.productId === 'string' ? action.productId : undefined;
    const actionType = action.actionType ?? action.action;
    if (!userId || !productId || !actionType || !knownProducts.has(productId)) return [];
    return [{ userId, productId, actionType }];
  });
  return { interactions, products };
};
