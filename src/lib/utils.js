import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export function getApiBase() {
  try {
    const isPreview = typeof window !== 'undefined' && window.location && window.location.port === '4173';
    return isPreview ? 'http://localhost:3001' : '';
  } catch {
    return '';
  }
}
