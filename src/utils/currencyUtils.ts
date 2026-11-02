// src/utils/currencyUtils.ts

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  rate_to_zar: number;
  country?: string;
}

// Country to currency mapping with exchange rates to ZAR
export const countryCurrencyMap: Record<string, CurrencyInfo> = {
  // Africa
  'South Africa': { code: 'ZAR', symbol: 'R', name: 'South African Rand', rate_to_zar: 1.0 },
  'Nigeria': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate_to_zar: 85.0 },
  'Kenya': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', rate_to_zar: 7.2 },
  'Egypt': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', rate_to_zar: 2.7 },
  'Morocco': { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', rate_to_zar: 0.55 },
  'Ghana': { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', rate_to_zar: 0.67 },
  'Tanzania': { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', rate_to_zar: 140.0 },
  'Uganda': { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', rate_to_zar: 200.0 },
  'Rwanda': { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', rate_to_zar: 70.0 },
  'Botswana': { code: 'BWP', symbol: 'P', name: 'Botswana Pula', rate_to_zar: 0.75 },
  'Mauritius': { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', rate_to_zar: 2.5 },
  'Namibia': { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', rate_to_zar: 1.0 },
  'Zambia': { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', rate_to_zar: 1.35 },
  'Mozambique': { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical', rate_to_zar: 3.5 },
  'Zimbabwe': { code: 'USD', symbol: '$', name: 'Zimbabwean Dollar', rate_to_zar: 0.055 },
  
  // North America
  'USA': { code: 'USD', symbol: '$', name: 'US Dollar', rate_to_zar: 0.055 },
  'Canada': { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate_to_zar: 0.075 },
  'Mexico': { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', rate_to_zar: 0.94 },
  
  // Europe
  'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound', rate_to_zar: 0.044 },
  'Germany': { code: 'EUR', symbol: '€', name: 'Euro', rate_to_zar: 0.051 },
  'France': { code: 'EUR', symbol: '€', name: 'Euro', rate_to_zar: 0.051 },
  'Italy': { code: 'EUR', symbol: '€', name: 'Euro', rate_to_zar: 0.051 },
  'Spain': { code: 'EUR', symbol: '€', name: 'Euro', rate_to_zar: 0.051 },
  'Netherlands': { code: 'EUR', symbol: '€', name: 'Euro', rate_to_zar: 0.051 },
  'Switzerland': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', rate_to_zar: 0.049 },
  'Sweden': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', rate_to_zar: 0.58 },
  'Norway': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', rate_to_zar: 0.58 },
  'Denmark': { code: 'DKK', symbol: 'kr', name: 'Danish Krone', rate_to_zar: 0.38 },
  'Poland': { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', rate_to_zar: 0.22 },
  'Russia': { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate_to_zar: 1.8 },
  
  // Asia
  'Japan': { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate_to_zar: 8.3 },
  'China': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate_to_zar: 0.40 },
  'India': { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate_to_zar: 4.6 },
  'South Korea': { code: 'KRW', symbol: '₩', name: 'South Korean Won', rate_to_zar: 73.0 },
  'Singapore': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate_to_zar: 0.074 },
  'Malaysia': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', rate_to_zar: 0.26 },
  'Thailand': { code: 'THB', symbol: '฿', name: 'Thai Baht', rate_to_zar: 2.0 },
  'Vietnam': { code: 'VND', symbol: '₫', name: 'Vietnamese Đồng', rate_to_zar: 1400.0 },
  'Indonesia': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rate_to_zar: 850.0 },
  'Philippines': { code: 'PHP', symbol: '₱', name: 'Philippine Peso', rate_to_zar: 3.2 },
  'Pakistan': { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rate_to_zar: 15.0 },
  'Bangladesh': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', rate_to_zar: 6.0 },
  'Sri Lanka': { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', rate_to_zar: 17.0 },
  'Nepal': { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', rate_to_zar: 7.5 },
  'UAE': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', rate_to_zar: 0.20 },
  'Saudi Arabia': { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', rate_to_zar: 0.21 },
  'Israel': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', rate_to_zar: 0.20 },
  'Turkey': { code: 'TRY', symbol: '₺', name: 'Turkish Lira', rate_to_zar: 1.8 },
  
  // Oceania
  'Australia': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate_to_zar: 0.083 },
  'New Zealand': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', rate_to_zar: 0.091 },
  
  // South America
  'Brazil': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rate_to_zar: 0.28 },
  'Argentina': { code: 'ARS', symbol: '$', name: 'Argentine Peso', rate_to_zar: 55.0 },
  'Chile': { code: 'CLP', symbol: '$', name: 'Chilean Peso', rate_to_zar: 50.0 },
  'Colombia': { code: 'COP', symbol: '$', name: 'Colombian Peso', rate_to_zar: 230.0 },
  'Peru': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', rate_to_zar: 0.21 },
  'Venezuela': { code: 'VES', symbol: 'Bs', name: 'Venezuelan Bolívar', rate_to_zar: 2.0 },
};

// Default country if none selected
export const DEFAULT_COUNTRY = 'USA';

// 🆕 Get currency info for a country with case-insensitive matching and logging
export const getCurrencyForCountry = (country?: string): CurrencyInfo => {
  // If no country provided, log warning and return default
  if (!country) {
    console.log('⚠️ [CurrencyUtils] No country provided, defaulting to USD');
    return { ...countryCurrencyMap[DEFAULT_COUNTRY], country: DEFAULT_COUNTRY };
  }
  
  // Try exact match first
  if (countryCurrencyMap[country]) {
    console.log(`✅ [CurrencyUtils] Exact match for "${country}" → ${countryCurrencyMap[country].symbol}`);
    return { ...countryCurrencyMap[country], country: country };
  }
  
  // Try case-insensitive match
  const countryLower = country.toLowerCase();
  const matchedCountry = Object.keys(countryCurrencyMap).find(
    key => key.toLowerCase() === countryLower
  );
  
  if (matchedCountry) {
    console.log(`✅ [CurrencyUtils] Case-insensitive match: "${country}" → "${matchedCountry}" (${countryCurrencyMap[matchedCountry].symbol})`);
    return { ...countryCurrencyMap[matchedCountry], country: matchedCountry };
  }
  
  // Try partial match (e.g., "United States" vs "USA")
  const partialMatch = Object.keys(countryCurrencyMap).find(key => 
    countryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(countryLower)
  );
  
  if (partialMatch) {
    console.log(`⚠️ [CurrencyUtils] Partial match: "${country}" → "${partialMatch}" (${countryCurrencyMap[partialMatch].symbol})`);
    return { ...countryCurrencyMap[partialMatch], country: partialMatch };
  }
  
  // If no match found, log warning and return default
  console.log(`⚠️ [CurrencyUtils] Country "${country}" not found in currency map, defaulting to USD`);
  return { ...countryCurrencyMap[DEFAULT_COUNTRY], country: DEFAULT_COUNTRY };
};

// ✅ Get just the currency symbol (for backward compatibility)
export const getCurrencySymbol = (country: string): string => {
  const currency = getCurrencyForCountry(country);
  return currency.symbol;
};

// 🆕 Get just the currency code
export const getCurrencyCode = (country: string): string => {
  const currency = getCurrencyForCountry(country);
  return currency.code;
};

// 🆕 Convert ZAR to the country's currency
export const convertZARToCurrency = (amountZAR: number, country: string): number => {
  const currency = getCurrencyForCountry(country);
  const rate = currency.rate_to_zar || 1;
  return amountZAR * rate;
};

// Enhanced: Format amount with currency symbol for display
export const formatAmountWithCurrency = (amount: number | string, country: string): string => {
  const currency = getCurrencyForCountry(country);
  // Handle if amount is a string or number
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  return `${currency.symbol}${numericAmount.toFixed(2)}`;
};

// Format amount without decimal places for whole numbers
export const formatAmountWithCurrencySimple = (amount: number | string, country: string): string => {
  const currency = getCurrencyForCountry(country);
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  
  // Show decimals only if not a whole number
  if (Number.isInteger(numericAmount)) {
    return `${currency.symbol}${numericAmount}`;
  }
  return `${currency.symbol}${numericAmount.toFixed(2)}`;
};

// Get all countries for dropdown
export const getAllCountries = (): string[] => {
  return Object.keys(countryCurrencyMap).sort();
};

// Group countries by region for better organization
export const countriesByRegion: Record<string, string[]> = {
  'Africa': ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Ghana', 'Tanzania', 'Uganda', 'Rwanda', 'Botswana', 'Mauritius', 'Namibia', 'Zambia', 'Mozambique', 'Zimbabwe'],
  'North America': ['USA', 'Canada', 'Mexico'],
  'South America': ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela'],
  'Europe': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 
             'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Poland', 'Russia'],
  'Asia': ['Japan', 'China', 'India', 'South Korea', 'Singapore', 'Malaysia', 
           'Thailand', 'Vietnam', 'Indonesia', 'Philippines', 'Pakistan', 
           'Bangladesh', 'Sri Lanka', 'Nepal', 'UAE', 'Saudi Arabia', 'Israel', 'Turkey'],
  'Oceania': ['Australia', 'New Zealand'],
};

// 🆕 Debug function to test currency mapping with conversion
export const testCurrencyMapping = (): void => {
  console.log('🧪 Testing currency mapping:');
  const testCountries = ['South Africa', 'Kenya', 'USA', 'United Kingdom', 'Japan', 'Germany', 'Nigeria', 'Ghana'];
  
  testCountries.forEach(country => {
    const currency = getCurrencyForCountry(country);
    const converted = convertZARToCurrency(36, country);
    console.log(`  🌍 "${country}" → ${currency.symbol}${converted.toFixed(2)} (${currency.code}) - Rate: ${currency.rate_to_zar}`);
  });
  
  console.log('\n💰 R36 conversions:');
  testCountries.forEach(country => {
    const converted = convertZARToCurrency(36, country);
    const currency = getCurrencyForCountry(country);
    console.log(`  R36 → ${country}: ${currency.symbol}${converted.toFixed(2)}`);
  });
};

// Also export a default object with all functions for convenience
export default {
  countryCurrencyMap,
  DEFAULT_COUNTRY,
  getCurrencyForCountry,
  getCurrencySymbol,
  getCurrencyCode,
  convertZARToCurrency,
  formatAmountWithCurrency,
  formatAmountWithCurrencySimple,
  getAllCountries,
  countriesByRegion,
  testCurrencyMapping
};