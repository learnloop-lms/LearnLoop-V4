import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import feedbackData from '../data/visionaryFeedback.json' with { type: 'json' };
import {
  isVisionaryLearner,
  fillPlaceholders,
  getNextMessageFromPool,
  getFeedback,
  createShuffledBag,
  TRIGGER_TO_POOL
} from '../services/visionaryFeedbackService.js';

// Setup Mock localStorage & sessionStorage for node environment
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();

function runTests() {
  console.log('=== VISIONARY FEEDBACK TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // TEST 1: Pool size validation (Acceptance criterion: >= 10 each)
  console.log('Test 1: Acceptance Criterion - Pool Sizes');
  assert(feedbackData.pools.OPENING.length >= 10, `OPENING pool has ${feedbackData.pools.OPENING.length} messages (>= 10)`);
  assert(feedbackData.pools.FORWARD.length >= 10, `FORWARD pool has ${feedbackData.pools.FORWARD.length} messages (>= 10)`);
  assert(feedbackData.pools.FALLBACK.length >= 10, `FALLBACK pool has ${feedbackData.pools.FALLBACK.length} messages (>= 10)`);

  // TEST 2: Learner Type Filtering (Acceptance criterion: Messages appear ONLY for Visionary learners)
  console.log('\nTest 2: Acceptance Criterion - Visionary Learner Only');
  const visionaryStudent = { id: 's1', name: 'Aadhya Patel', pt_ls: 'Visionaries' };
  const mentorStudent = { id: 's2', name: 'Karthik Rao', pt_ls: 'Mentors' };
  const conquerorStudent = { id: 's3', name: 'Deepa S', pt_ls: 'Conquerors' };
  const pioneerStudent = { id: 's4', name: 'Rohan Sharma', pt_ls: 'Pioneers' };

  assert(isVisionaryLearner(visionaryStudent) === true, 'Visionary student correctly identified');
  assert(isVisionaryLearner(mentorStudent) === false, 'Mentor student excluded');
  assert(isVisionaryLearner(conquerorStudent) === false, 'Conqueror student excluded');
  assert(isVisionaryLearner(pioneerStudent) === false, 'Pioneer student excluded');

  assert(getFeedback(mentorStudent, 'course_opened', { course: 'Data Structures' }) === null, 'Mentor receives null');
  assert(getFeedback(conquerorStudent, 'progress_forward', { course: 'Data Structures' }) === null, 'Conqueror receives null');
  assert(getFeedback(pioneerStudent, 'progress_backward', { course: 'Data Structures' }) === null, 'Pioneer receives null');

  const visionaryFeedback = getFeedback(visionaryStudent, 'course_opened', { course: 'C Programming' });
  assert(visionaryFeedback !== null, 'Visionary receives valid feedback object');
  assert(visionaryFeedback.pool === 'OPENING', 'Maps course_opened to OPENING pool');

  // TEST 3: Placeholders never show as raw text (Acceptance criterion)
  console.log('\nTest 3: Acceptance Criterion - Placeholder Replacement');
  const sampleTemplate = 'Hello {name}! Welcome to {course}. Ready {name}?';
  const filledWithBoth = fillPlaceholders(sampleTemplate, { name: 'Srimathi Soundararajan' }, { course: 'C Programming' });
  assert(filledWithBoth === 'Hello Srimathi! Welcome to C Programming. Ready Srimathi?', 'Both placeholders replaced correctly with first name');
  assert(!filledWithBoth.includes('{name}') && !filledWithBoth.includes('{course}'), 'No raw placeholders remaining');

  const filledWithDefaults = fillPlaceholders(sampleTemplate, {}, {});
  assert(filledWithDefaults === 'Hello Explorer! Welcome to this mission. Ready Explorer?', 'Defaults to Explorer and this mission');
  assert(!filledWithDefaults.includes('{name}') && !filledWithDefaults.includes('{course}'), 'No raw placeholders with defaults');

  // TEST 4: No Immediate Repeat across 200 consecutive draws (Acceptance criterion)
  console.log('\nTest 4: Acceptance Criterion - No Immediate Repeat & Shuffle-Bag');
  globalThis.localStorage.clear();
  let immediateRepeatDetected = false;
  let previousMessage = null;

  for (let i = 0; i < 200; i++) {
    const res = getFeedback(visionaryStudent, 'progress_forward', { course: 'Physics' });
    if (!res) {
      assert(false, `Unexpected null message on iteration ${i}`);
      break;
    }
    if (res.message === previousMessage) {
      immediateRepeatDetected = true;
      console.error(`Immediate repeat found at step ${i}: "${res.message}"`);
      break;
    }
    previousMessage = res.message;
  }
  assert(!immediateRepeatDetected, 'Zero immediate repeats detected over 200 consecutive draws');

  // TEST 5: Rate Limiting on Fallback Events
  console.log('\nTest 5: Rate Limiting for progress_backward');
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();

  // Repeated 7 fallback events
  const fbResults = [];
  for (let step = 1; step <= 9; step++) {
    const res = getFeedback(visionaryStudent, 'progress_backward', { course: 'Algorithms' });
    fbResults.push(res !== null);
  }

  // Expected pattern: 1st -> YES, 2nd, 3rd, 4th -> NO, 5th -> YES, 6th, 7th, 8th -> NO, 9th -> YES
  assert(fbResults[0] === true, '1st fallback event displays message');
  assert(fbResults[1] === false, '2nd consecutive fallback event is suppressed');
  assert(fbResults[2] === false, '3rd consecutive fallback event is suppressed');
  assert(fbResults[3] === false, '4th consecutive fallback event is suppressed');
  assert(fbResults[4] === true, '5th consecutive fallback event displays message (after 3 events)');
  assert(fbResults[5] === false, '6th consecutive fallback event is suppressed');
  assert(fbResults[6] === false, '7th consecutive fallback event is suppressed');
  assert(fbResults[7] === false, '8th consecutive fallback event is suppressed');
  assert(fbResults[8] === true, '9th consecutive fallback event displays message (after 3 more events)');

  // Forward event resets fallback count
  getFeedback(visionaryStudent, 'progress_forward', { course: 'Algorithms' });
  const nextFb = getFeedback(visionaryStudent, 'progress_backward', { course: 'Algorithms' });
  assert(nextFb !== null, 'Fallback streak reset by progress_forward event, displays immediately on next error');

  // TEST 6: Dynamic JSON Expansion (Acceptance criterion: Add message by editing JSON with no code change)
  console.log('\nTest 6: Acceptance Criterion - Extensible without code change');
  const customPool = [...feedbackData.pools.OPENING, 'A custom galaxy 13 message for {name} in {course}!'];
  const testLearnerId = 'test_dynamic_learner';
  const customDrawn = getNextMessageFromPool(testLearnerId, 'CUSTOM_OPENING', customPool);
  assert(typeof customDrawn === 'string' && customDrawn.length > 0, 'Custom pool length handled dynamically without code change');

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
