export type MainTab = 'home' | 'offers' | 'internet' | 'wallet' | 'more';

export type AppRoute =
  | 'home'
  | 'offers'
  | 'internet'
  | 'wallet'
  | 'wallet-history'
  | 'wallet-tx-detail'
  | 'import-data'
  | 'admin-login'
  | 'admin'
  | 'more';

export interface RouteEntry {
  route: AppRoute;
  transactionId?: string;
}
