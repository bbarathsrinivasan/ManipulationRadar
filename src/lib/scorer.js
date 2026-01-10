import { detectManipulation, getSeverityWeight } from './detectors.js';

/**
 * Calculate trust score based on manipulation detection
 * @param {string} text - The text to analyze
 * @returns {number} Trust score from 0-100 (higher is more trustworthy)
 */
export function calculateTrustScore(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 100; // Empty text is neutral
  }

  const { flags, counts } = detectManipulation(text);
  
  if (flags.length === 0) {
    return 100; // No manipulation detected
  }

  // Base score starts at 100
  let score = 100;

  // Calculate penalty based on flag counts and severity
  const totalPenalty = flags.reduce((penalty, flag) => {
    const weight = getSeverityWeight(flag.severity);
    return penalty + (weight * 5); // Each flag reduces score by weight * 5
  }, 0);

  // Apply penalty
  score -= totalPenalty;

  // Additional penalties for high frequency of patterns
  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (totalCount > 5) {
    score -= (totalCount - 5) * 2; // Extra penalty for excessive patterns
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score));

  return Math.round(score);
}

/**
 * Get color class based on trust score
 * @param {number} score - Trust score from 0-100
 * @returns {string} Tailwind CSS color class
 */
export function getScoreColor(score) {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get background color class based on trust score
 * @param {number} score - Trust score from 0-100
 * @returns {string} Tailwind CSS color class
 */
export function getScoreBgColor(score) {
  if (score >= 90) return 'bg-green-500/20';
  if (score >= 70) return 'bg-yellow-500/20';
  if (score >= 50) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

/**
 * Get severity badge color
 * @param {string} severity - 'low', 'medium', or 'high'
 * @returns {string} Tailwind CSS color class
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'high':
      return 'bg-red-500/30 text-red-300 border-red-500/50';
    case 'medium':
      return 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50';
    case 'low':
      return 'bg-blue-500/30 text-blue-300 border-blue-500/50';
    default:
      return 'bg-gray-500/30 text-gray-300 border-gray-500/50';
  }
}
