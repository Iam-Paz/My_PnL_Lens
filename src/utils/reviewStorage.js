import { STORAGE_KEYS } from './storageKeys.js';
import {
  getReviewPeriod,
  normalizeReviewAnswers,
  reviewRecordKey,
} from './reviewPeriods.js';

// Do not silently replace damaged or inaccessible storage with an empty list.
export function readReviewRecords(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEYS.periodReviews);
  if (raw === null) return [];

  let records;

  try {
    records = JSON.parse(raw);
  } catch {
    throw new Error(
      'Saved reviews could not be read. Your stored data has not been changed.'
    );
  }

  if (!Array.isArray(records)) {
    throw new Error(
      'Saved reviews have an invalid format. Your stored data has not been changed.'
    );
  }

  for (const record of records) {
    const period = getReviewPeriod(record?.type, record?.start);

    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      !period ||
      period.start !== record.start ||
      !reviewRecordKey(record.accountId, record.type, record.start) ||
      !record.answers ||
      typeof record.answers !== 'object' ||
      Array.isArray(record.answers)
    ) {
      throw new Error(
        'A saved review is damaged. Your stored data has not been changed.'
      );
    }
  }

  return records;
}

export function findReviewRecord(records, accountId, type, day) {
  const key = reviewRecordKey(accountId, type, day);
  if (!key || !Array.isArray(records)) return null;

  const match = records.findLast((record) =>
    reviewRecordKey(
      record?.accountId,
      record?.type,
      record?.start
    ) === key
  );

  return match
    ? { ...match, answers: normalizeReviewAnswers(match.answers) }
    : null;
}

export function saveReviewRecord(
  accountId,
  type,
  day,
  answers,
  storage = localStorage
) {
  const key = reviewRecordKey(accountId, type, day);
  const period = getReviewPeriod(type, day);

  if (!key || !period) {
    throw new Error(
      'Choose a valid account and review period before saving.'
    );
  }

  const records = readReviewRecords(storage);

  const record = {
    accountId,
    type,
    start: period.start,
    answers: normalizeReviewAnswers(answers),
    updatedAt: new Date().toISOString(),
  };

  const next = records.filter((item) =>
    reviewRecordKey(item.accountId, item.type, item.start) !== key
  );

  next.push(record);

  // Let write failures reach the UI; never report "saved" after a failed write.
  storage.setItem(STORAGE_KEYS.periodReviews, JSON.stringify(next));

  return record;
}