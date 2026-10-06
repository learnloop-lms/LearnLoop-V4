import feedbackData from '../data/visionaryFeedback.json' with { type: 'json' };

export const TRIGGER_TO_POOL = {
  course_opened: 'OPENING',
  progress_forward: 'FORWARD',
  progress_backward: 'FALLBACK'
};

/**
 * Check if the learner is a Visionary archetype.
 */
export function isVisionaryLearner(learner) {
  if (!learner) return false;
  const type = (learner.learner_type || learner.pt_ls || '').toUpperCase();
  return type.includes('VISIONAR');
}

/**
 * Creates a Fisher-Yates shuffled array of indices [0, 1, ..., length - 1].
 */
export function createShuffledBag(length) {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Replaces placeholders {name} and {course}.
 * If missing, defaults to "Explorer" and "this mission".
 */
export function fillPlaceholders(template, learner, context = {}) {
  if (!template) return '';

  let firstName = 'Explorer';
  if (learner?.name && typeof learner.name === 'string' && learner.name.trim()) {
    firstName = learner.name.trim().split(' ')[0];
  }

  const courseTitle =
    context?.course && typeof context.course === 'string' && context.course.trim()
      ? context.course.trim()
      : 'this mission';

  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{course\}/g, courseTitle);
}

/**
 * Pulls the next message from the shuffle-bag for the pool without immediate repetition.
 */
export function getNextMessageFromPool(learnerId, poolName, poolMessages) {
  if (!poolMessages || poolMessages.length === 0) return null;
  if (poolMessages.length === 1) return poolMessages[0];

  const bagKey = `vfb_bag_${learnerId}_${poolName}`;
  const lastKey = `vfb_last_${learnerId}_${poolName}`;

  let bag = [];
  try {
    const saved = localStorage.getItem(bagKey);
    if (saved) bag = JSON.parse(saved);
  } catch (e) {
    bag = [];
  }

  const lastShownMessage = localStorage.getItem(lastKey);

  // If bag is empty or invalid, replenish with fresh shuffled indices
  if (!Array.isArray(bag) || bag.length === 0) {
    bag = createShuffledBag(poolMessages.length);
    // Guarantee no immediate repeat across reshuffle
    if (poolMessages[bag[bag.length - 1]] === lastShownMessage && bag.length > 1) {
      const swapIdx = Math.floor(Math.random() * (bag.length - 1));
      const temp = bag[bag.length - 1];
      bag[bag.length - 1] = bag[swapIdx];
      bag[swapIdx] = temp;
    }
  }

  let chosenIdx = bag.pop();
  let chosenMessage = poolMessages[chosenIdx];

  // Rule 3: No immediate repeat. Never show the same message twice in a row for the same learner and pool
  if (chosenMessage === lastShownMessage && poolMessages.length > 1) {
    if (bag.length > 0) {
      const nextIdx = bag.pop();
      bag.push(chosenIdx); // Put previous back
      chosenIdx = nextIdx;
      chosenMessage = poolMessages[chosenIdx];
    } else {
      const newBag = createShuffledBag(poolMessages.length);
      const validIdx = newBag.findIndex((idx) => poolMessages[idx] !== lastShownMessage);
      if (validIdx !== -1) {
        chosenIdx = newBag.splice(validIdx, 1)[0];
        bag = newBag;
        chosenMessage = poolMessages[chosenIdx];
      }
    }
  }

  // If bag is empty after drawing, replenish ready for next call
  if (bag.length === 0) {
    const newBag = createShuffledBag(poolMessages.length);
    if (poolMessages[newBag[newBag.length - 1]] === chosenMessage && newBag.length > 1) {
      const swapIdx = Math.floor(Math.random() * (newBag.length - 1));
      const temp = newBag[newBag.length - 1];
      newBag[newBag.length - 1] = newBag[swapIdx];
      newBag[swapIdx] = temp;
    }
    bag = newBag;
  }

  try {
    localStorage.setItem(bagKey, JSON.stringify(bag));
    localStorage.setItem(lastKey, chosenMessage);
  } catch (e) {
    console.warn('Storage error saving feedback bag:', e);
  }

  return chosenMessage;
}

/**
 * Main selection function adhering to developer specification.
 *
 * @param {Object} learner - Learner profile object (must be VISIONARY)
 * @param {string} trigger - 'course_opened' | 'progress_forward' | 'progress_backward'
 * @param {Object} context - Optional context: { course: 'Course Name' }
 * @returns {Object|null} { message, trigger, pool, learnerType } or null if not applicable/rate-limited
 */
export function getFeedback(learner, trigger, context = {}) {
  // 1. Apply only to learners whose learner type is VISIONARY
  if (!isVisionaryLearner(learner)) {
    return null;
  }

  const poolName = TRIGGER_TO_POOL[trigger];
  if (!poolName || !feedbackData.pools || !feedbackData.pools[poolName]) {
    return null;
  }

  const learnerId = learner.id || learner.regno || learner.email || 'visionary_learner';

  // 8. Rate limit for Fallback events:
  // "For repeated Fallback events in a row (for example, 3 wrong answers), show a message only on the first one, then again after 3 more events, to avoid nagging."
  const streakKey = `vfb_fallback_streak_${learnerId}`;
  let fallbackStreak = 0;
  try {
    fallbackStreak = parseInt(sessionStorage.getItem(streakKey) || '0', 10);
    if (isNaN(fallbackStreak)) fallbackStreak = 0;
  } catch (e) {
    fallbackStreak = 0;
  }

  if (trigger === 'progress_backward') {
    fallbackStreak += 1;
    try {
      sessionStorage.setItem(streakKey, fallbackStreak.toString());
    } catch (e) {}

    // Show only on 1st event, then again after 3 more events (streak: 1, 5, 9, 13...)
    if ((fallbackStreak - 1) % 4 !== 0) {
      return null;
    }
  } else {
    // Forward or opening resets the fallback streak
    try {
      sessionStorage.setItem(streakKey, '0');
    } catch (e) {}
  }

  // 2, 3, 4. Shuffle-bag selection without immediate repetition
  const rawTemplate = getNextMessageFromPool(learnerId, poolName, feedbackData.pools[poolName]);
  if (!rawTemplate) return null;

  // 5. Fill placeholders
  const message = fillPlaceholders(rawTemplate, learner, context);

  return {
    trigger,
    pool: poolName,
    message,
    learnerType: 'VISIONARY'
  };
}

export default {
  getFeedback,
  isVisionaryLearner,
  fillPlaceholders,
  TRIGGER_TO_POOL
};
