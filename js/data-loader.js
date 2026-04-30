// data-loader.js — Fetches and validates games.json

const VALID_STATUSES = ['published', 'unpublished', 'coming_soon'];
const REQUIRED_STRING_FIELDS = ['title', 'description', 'cover_image', 'game_url', 'slug', 'status'];

/**
 * Validates a single game entry against the required schema.
 * @param {*} entry - The game entry to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateGameEntry(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, reason: 'Entry must be a non-null object' };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
      return { valid: false, reason: `Missing or empty required string field: ${field}` };
    }
  }

  if (!VALID_STATUSES.includes(entry.status)) {
    return { valid: false, reason: `Invalid status: "${entry.status}". Must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  if (typeof entry.display_order !== 'number' || !Number.isFinite(entry.display_order)) {
    return { valid: false, reason: 'display_order must be a finite number' };
  }

  if (typeof entry.featured !== 'boolean') {
    return { valid: false, reason: 'featured must be a boolean' };
  }

  return { valid: true };
}

/**
 * Fetches games.json, validates each entry, filters out unpublished
 * games, and returns the remaining entries sorted by display_order.
 * @returns {Promise<Array>} Sorted array of valid, visible game entries
 * @throws {Error} With message "LOAD_FAILED" on network, parse, or structure errors
 */
export async function fetchGames() {
  let response;
  try {
    response = await fetch('games.json');
  } catch (_err) {
    throw new Error('LOAD_FAILED');
  }

  if (!response.ok) {
    throw new Error('LOAD_FAILED');
  }

  let data;
  try {
    data = await response.json();
  } catch (_err) {
    throw new Error('LOAD_FAILED');
  }

  if (!data || !Array.isArray(data.games)) {
    throw new Error('LOAD_FAILED');
  }

  const schemaVersion = data.schema_version ?? 1;
  console.info(`Schema version: ${schemaVersion}`);

  const validEntries = [];

  for (const entry of data.games) {
    const result = validateGameEntry(entry);
    if (!result.valid) {
      console.warn(`Skipping invalid game entry: ${result.reason}`, entry);
      continue;
    }
    validEntries.push(entry);
  }

  const visible = validEntries.filter((entry) => entry.status !== 'unpublished');

  visible.sort((a, b) => a.display_order - b.display_order);

  return visible;
}
