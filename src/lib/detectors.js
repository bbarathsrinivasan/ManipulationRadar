/**
 * Pattern detectors for AI manipulation techniques
 */

// Sycophancy patterns - excessive agreement and validation
const sycophancyPatterns = [
  /\b(you're absolutely right|you're completely correct|exactly right|spot on|perfectly said)\b/gi,
  /\b(I completely agree|I totally agree|absolutely|without a doubt)\b/gi,
  /\b(you've hit the nail on the head|you nailed it|brilliant point)\b/gi,
  /\b(you're so smart|you're brilliant|you're amazing)\b/gi,
  /\b(that's exactly what I was thinking|you read my mind)\b/gi,
];

// Flattery patterns - excessive praise
const flatteryPatterns = [
  /\b(you're such a|you're an|you're the|you're one of the)\s+(amazing|brilliant|incredible|outstanding|exceptional|remarkable)\s+(person|individual|thinker|professional)\b/gi,
  /\b(I'm impressed by|I'm amazed by|I'm in awe of)\s+(your|you)\b/gi,
  /\b(you have such|you possess such)\s+(incredible|amazing|remarkable|exceptional)\s+(talent|ability|skill|intelligence)\b/gi,
  /\b(you're a genius|you're a master|you're a pro)\b/gi,
  /\b(no one does it like you|you're the best|you're unmatched)\b/gi,
];

// Persuasion patterns - manipulative language
const persuasionPatterns = [
  /\b(you should|you must|you need to|you have to|you ought to)\s+(trust|believe|accept|agree)\b/gi,
  /\b(everyone knows|it's common knowledge|it's well known|everyone agrees)\b/gi,
  /\b(obviously|clearly|undoubtedly|certainly|definitely)\s+(you|we|everyone)\b/gi,
  /\b(you'll regret|you'll be sorry|you'll miss out|don't miss)\b/gi,
  /\b(limited time|act now|don't wait|urgent|immediate)\b/gi,
  /\b(trust me|believe me|I promise|I guarantee)\b/gi,
  /\b(you're making a mistake|you're wrong|you don't understand)\b/gi,
];

// Emotional manipulation patterns
const emotionalPatterns = [
  /\b(I'm disappointed|I'm hurt|I'm sad|I'm upset)\s+(that|because|when)\b/gi,
  /\b(if you really|if you truly|if you actually)\s+(cared|loved|respected)\b/gi,
  /\b(you don't care|you don't understand|you don't appreciate)\b/gi,
  /\b(I thought you|I expected you|I hoped you)\s+(would|could)\b/gi,
];

// Authority manipulation patterns
const authorityPatterns = [
  /\b(as an expert|as a professional|as someone who|with my experience)\b/gi,
  /\b(I've been doing this|I've worked in|I've studied)\s+(for|in)\s+(\d+|years|decades)\b/gi,
  /\b(studies show|research proves|experts agree|science says)\b/gi,
  /\b(according to|based on|per|as per)\s+(experts|research|studies|science)\b/gi,
];

/**
 * Detect manipulation patterns in text
 * @param {string} text - The text to analyze
 * @returns {Object} Detection results with flags and counts
 */
export function detectManipulation(text) {
  if (!text || typeof text !== 'string') {
    return {
      flags: [],
      counts: {
        sycophancy: 0,
        flattery: 0,
        persuasion: 0,
        emotional: 0,
        authority: 0,
      },
    };
  }

  const flags = [];
  const counts = {
    sycophancy: 0,
    flattery: 0,
    persuasion: 0,
    emotional: 0,
    authority: 0,
  };

  // Check sycophancy patterns
  sycophancyPatterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      counts.sycophancy += matches.length;
      flags.push({
        type: 'sycophancy',
        severity: 'medium',
        message: `Excessive agreement detected: "${matches[0]}"`,
        matchedText: matches[0],
        pattern: index,
      });
    }
  });

  // Check flattery patterns
  flatteryPatterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      counts.flattery += matches.length;
      flags.push({
        type: 'flattery',
        severity: 'medium',
        message: `Excessive flattery detected: "${matches[0]}"`,
        matchedText: matches[0],
        pattern: index,
      });
    }
  });

  // Check persuasion patterns
  persuasionPatterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      counts.persuasion += matches.length;
      flags.push({
        type: 'persuasion',
        severity: 'high',
        message: `Persuasive language detected: "${matches[0]}"`,
        matchedText: matches[0],
        pattern: index,
      });
    }
  });

  // Check emotional manipulation
  emotionalPatterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      counts.emotional += matches.length;
      flags.push({
        type: 'emotional',
        severity: 'high',
        message: `Emotional manipulation detected: "${matches[0]}"`,
        matchedText: matches[0],
        pattern: index,
      });
    }
  });

  // Check authority manipulation
  authorityPatterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      counts.authority += matches.length;
      flags.push({
        type: 'authority',
        severity: 'medium',
        message: `Authority appeal detected: "${matches[0]}"`,
        matchedText: matches[0],
        pattern: index,
      });
    }
  });

  return { flags, counts };
}

/**
 * Get severity weight for scoring
 * @param {string} severity - 'low', 'medium', or 'high'
 * @returns {number} Weight multiplier
 */
export function getSeverityWeight(severity) {
  const weights = {
    low: 1,
    medium: 2,
    high: 3,
  };
  return weights[severity] || 1;
}
