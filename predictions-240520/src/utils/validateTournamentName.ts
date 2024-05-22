import { ValidationResult } from '../types/ValidationResult.js';

export function validateTournamentName(titleString: string): ValidationResult {
  // Check if the title is empty
  if (titleString.trim().length === 0) {
    return {
      isValid: false,
      errorMessage: 'Name cannot be empty.',
    };
  }

  // Check if the title is too long
  const characterLimit = 300;
  if (titleString.length > characterLimit) {
    return {
      isValid: false,
      errorMessage: `Name cannot be longer than ${characterLimit} characters.`,
    };
  }

  // If all validations pass, return a valid result
  return {
    isValid: true,
  };
}
