export type SellerRegistrationValues = {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  country: string;
};

export type SellerShopValues = {
  name: string;
  bio: string;
  address: string;
  opening_hours: string;
  website: string;
  category: string;
};

export const validateSellerRegistration = (
  values: SellerRegistrationValues
) => {
  if (values.name.trim().length < 3) {
    return 'Name must be at least 3 characters long.';
  }
  const email = values.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }
  if (!values.password) {
    return 'Enter a password.';
  }
  if (!values.phone_number.trim()) {
    return 'Enter a phone number.';
  }
  if (!values.country.trim()) {
    return 'Enter your country.';
  }
  return null;
};

export const validateSellerShop = (values: SellerShopValues) => {
  if (
    values.name.trim().length < 3 ||
    values.bio.trim().length < 3 ||
    values.address.trim().length < 3 ||
    values.opening_hours.trim().length < 3
  ) {
    return 'Name, bio, address, and opening hours must be at least 3 characters.';
  }
  if (values.bio.trim().split(/\s+/).length > 100) {
    return 'Bio must be at most 100 words long.';
  }
  if (!values.category) {
    return 'Choose a shop category.';
  }
  const website = values.website.trim();
  if (website && !/^(https?:\/\/)?([\w\d-]+\.)+\w{2,}(\/.*)?$/i.test(website)) {
    return 'Enter a valid website URL.';
  }
  return null;
};
