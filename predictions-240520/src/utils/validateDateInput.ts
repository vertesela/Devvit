import { ValidationResult } from '../types/ValidationResult.js';

export function validateDateInput(dateString: string): ValidationResult {
  // Regular expression to validate the date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return {
      isValid: false,
      errorMessage: 'Invalid date format. Please use YYYY-MM-DD.',
    };
  }

  // Parse the date and check if it's a valid date
  const dateObject = new Date(dateString);
  if (isNaN(dateObject.getTime())) {
    return {
      isValid: false,
      errorMessage: 'Invalid date value. Please enter a valid date.',
    };
  }

  // If all validations pass, return a valid result
  return {
    isValid: true,
  };
}
