import { redirectToSellerApp } from '../../lib/sellerAppRedirect';

export default function SellerProductsRedirect() {
  redirectToSellerApp('/dashboard/all-products');
}
