// Phone number utilities for Ghana (+233)

const GHANA_CODE = '+233';
const GHANA_PATTERN = /^\+233\d{9}$/; // +233 followed by 9 digits

/**
 * Format phone number to Ghana format (+233XXXXXXXXX)
 * Accepts various input formats and normalizes to +233 format
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 0 if present (Ghanaian numbers sometimes start with 0)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 233 if present (international format without +)
  if (cleaned.startsWith('233')) {
    cleaned = cleaned.substring(3);
  }

  // Keep only digits
  cleaned = cleaned.replace(/\D/g, '');

  // Ensure it's exactly 9 digits
  if (cleaned.length === 9) {
    return `${GHANA_CODE}${cleaned}`;
  }

  // If less than 9 digits, return with GHANA_CODE prefix
  if (cleaned.length > 0 && cleaned.length < 9) {
    return `${GHANA_CODE}${cleaned}`;
  }

  return '';
};

/**
 * Validate if phone number is a valid Ghana number
 */
export const isValidGhanaPhone = (phone: string): boolean => {
  const formatted = formatPhoneNumber(phone);
  return GHANA_PATTERN.test(formatted);
};

/**
 * Display phone number in readable format
 * Converts +233123456789 to +233 123 456 789
 */
export const displayPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  const formatted = formatPhoneNumber(phone);
  if (!formatted) return phone;

  // Format as +233 XXX XXX XXX
  return formatted.replace(/(\+233)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
};

/**
 * Get display phone number for forms (shows current value or formatted)
 */
export const getDisplayPhone = (phone: string | undefined): string => {
  if (!phone) return '';
  return displayPhoneNumber(phone);
};

/**
 * Strip formatting from phone number for storage/API
 */
export const stripPhoneFormatting = (phone: string): string => {
  return formatPhoneNumber(phone);
};

export default {
  GHANA_CODE,
  GHANA_PATTERN,
  formatPhoneNumber,
  isValidGhanaPhone,
  displayPhoneNumber,
  getDisplayPhone,
  stripPhoneFormatting,
};
