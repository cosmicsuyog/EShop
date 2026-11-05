import { redirectToSellerApp } from '../../lib/sellerAppRedirect';

export default function SellerLoginRedirect() {
  redirectToSellerApp('/login');
}
