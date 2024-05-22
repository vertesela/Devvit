import { ValidationResult } from '../types/ValidationResult.js';

export function validateTimeInput(timeString: string): ValidationResult {
  // Regular expression to validate the time format (HH:MM) in 24-hour format
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(timeString)) {
    return {
      isValid: false,
      errorMessage: 'Invalid time format. Please use HH:MM in 24-hour format.',
    };
  }

  // Check if the hours value is out of bounds
  const [hours, minutes] = timeString.split(':').map(Number);
  if (hours < 0 || hours > 23) {
    return {
      isValid: false,
      errorMessage: 'Hours out of bounds (0-23)',
    };
  }

  // Check if the minutes value is out of bounds
  if (minutes < 0 || minutes > 59) {
    return {
      isValid: false,
      errorMessage: 'Minutes out of bounds (0-59)',
    };
  }

  // If all validations pass, return a valid result
  return {
    isValid: true,
  };
}
