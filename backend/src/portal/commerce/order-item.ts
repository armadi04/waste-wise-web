export const ORDER_ITEM_PRODUCT_TYPES = ['coupon', 'ticket', 'bundle'] as const;
export type OrderItemProductType = (typeof ORDER_ITEM_PRODUCT_TYPES)[number];
