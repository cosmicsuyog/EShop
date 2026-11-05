import { redirectToSellerApp } from '../../../lib/sellerAppRedirect';

export default function SellerProductCreateRedirect() {
  redirectToSellerApp('/dashboard/create-product');
}
