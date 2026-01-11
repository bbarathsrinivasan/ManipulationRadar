/**
 * Score calculation logic
 */

import {
  ManipulationDetection,
  RiskLevel,
  ReliabilityLevel,
} from './types.ts';

// Weights for manipulation types
const MANIPULATION_WEIGHTS: Record<string, number> = {
  persuasion: 20,
  emotional: 20,
  sycophancy: 12,
  flattery: 10,
  authority: 12,
};

/**
 * Calculate risk score from detections
 */
export function calculateRiskScore(
  detections: ManipulationDetection[]
): {
  score: number;
  level: RiskLevel;
  countsByType: Record<string, number>;
} {
  // Count detections by type
  const countsByType: Record<string, number> = {
    sycophancy: 0,
    flattery: 0,
    persuasion: 0,
    emotional: 0,
    authority: 0,
  };

  // Calculate weighted risk score
  let risk = 0;

  for (const detection of detections) {
    const type = detection.type;
    const severity = Math.max(0, Math.min(10, detection.severity)); // Clamp 0-10
    const weight = MANIPULATION_WEIGHTS[type] || 10;

    // Add to risk: weight * (severity / 10)
    risk += weight * (severity / 10);

    // Count by type
    countsByType[type] = (countsByType[type] || 0) + 1;
  }

  // Clamp risk score to 0-100
  const score = Math.max(0, Math.min(100, Math.round(risk)));

  // Determine risk level
  let level: RiskLevel;
  if (score <= 24) {
    level = 'Low';
  } else if (score <= 49) {
    level = 'Medium';
  } else if (score <= 74) {
    level = 'High';
  } else {
    level = 'Critical';
  }

  return {
    score,
    level,
    countsByType,
  };
}

/**
 * Calculate reliability level from score
 */
export function calculateReliabilityLevel(score: number): ReliabilityLevel {
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 90) {
    return 'High';
  } else if (clampedScore >= 70) {
    return 'Caution';
  } else if (clampedScore >= 50) {
    return 'Low';
  } else {
    return 'Unreliable';
  }
}
