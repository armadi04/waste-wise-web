export const CUSTOMER_KEY: Partial<Record<string, string>> = {
  customers: 'id',
  orders: 'userId',
  wallets: 'userId',
  gifts: 'senderUserId',
  referrals: 'userId',
}
