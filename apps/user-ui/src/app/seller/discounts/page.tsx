import { redirectToSellerApp } from '../../lib/sellerAppRedirect';

export default function SellerDiscountsRedirect() {
  redirectToSellerApp('/dashboard/discount-codes');
}
