import { redirectToSellerApp } from '../../lib/sellerAppRedirect';

export default function SellerPaymentsRedirect() {
  redirectToSellerApp('/dashboard/payments');
}
