import { addDays, fromDateKey, toDateKey } from '../format';
import { BiologicalSex, HeightEntry, WeightEntry } from '../types';

export const DEMO_EMAIL = 'demo@weighway.app';
export const DEMO_MEMBER_SINCE = '2026-01-08T00:00:00.000Z';
export const DEMO_BIRTH_DATE = '1992-04-18';
export const DEMO_SEX: BiologicalSex = 'male';

export const DEMO_HEIGHT_ENTRIES: HeightEntry[] = [
  { effectiveDate: '2024-03-01', heightCm: 181 },
  { effectiveDate: '2025-11-12', heightCm: 182 },
];

export const DEMO_WEIGHT_ENTRY_COUNT = 1000;
export const DEMO_WEIGHT_NET_LOSS_KG = 15;
export const DEMO_WEIGHT_START_KG = 88.5;
export const DEMO_WEIGHT_STEP_KG = 0.05;

const DEMO_WEIGHT_RANDOM_SEED = 0x77656967;
const DEMO_TIMESTAMP_RANDOM_SEED = 0x74696d65;
const DEMO_EDIT_CHANCE = 0.06;
const DEMO_SAME_DAY_EDIT_CHANCE = 0.85;

export function getDemoLatestWeighInDate(today: Date): Date {
  const latest = new Date(today);
  latest.setHours(0, 0, 0, 0);
  latest.setDate(latest.getDate() - 1);
  return latest;
}

export function roundDemoWeightKg(value: number): number {
  return Math.round(value / DEMO_WEIGHT_STEP_KG) * DEMO_WEIGHT_STEP_KG;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rawDailyDelta(dayIndex: number, random: () => number): number {
  const gainPhase = Math.sin((dayIndex / 118) * Math.PI * 2) * 0.03;
  const rebound = Math.sin((dayIndex / 41) * Math.PI * 2) * 0.012;
  const weekly = Math.sin((dayIndex / 7) * Math.PI * 2) * 0.006;

  const r1 = random() - 0.5;
  const r2 = random() - 0.5;
  let daily = (r1 + r2) * 0.42;

  const spikeRoll = random();
  if (spikeRoll < 0.05) {
    daily += (random() > 0.5 ? 1 : -1) * (0.7 + random() * 0.3);
  } else if (spikeRoll < 0.2) {
    daily += (random() > 0.5 ? 1 : -1) * (0.35 + random() * 0.15);
  }

  return gainPhase + rebound + weekly + daily;
}

function buildDailyDeltas(span: number, random: () => number): number[] {
  const raw = Array.from({ length: span }, (_, dayIndex) => rawDailyDelta(dayIndex, random));
  const rawSum = raw.reduce((total, delta) => total + delta, 0);
  const targetSum = -DEMO_WEIGHT_NET_LOSS_KG;
  const correction = (targetSum - rawSum) / span;
  return raw.map((delta) => delta + correction);
}

function clampDailyChange(delta: number): number {
  return Math.max(-1, Math.min(1, delta));
}

function stepDemoWeight(current: number, delta: number): number {
  const next = roundDemoWeightKg(current + clampDailyChange(delta));
  const maxNext = roundDemoWeightKg(current + 1);
  const minNext = roundDemoWeightKg(current - 1);
  return Math.min(maxNext, Math.max(minNext, next));
}

function isValidNeighborStep(previous: number, current: number, next?: number): boolean {
  if (Math.abs(current - previous) > 1) {
    return false;
  }

  if (next !== undefined && Math.abs(next - current) > 1) {
    return false;
  }

  return true;
}

function applyEndWeightCorrection(weights: number[]): void {
  const endTarget = roundDemoWeightKg(DEMO_WEIGHT_START_KG - DEMO_WEIGHT_NET_LOSS_KG);
  const maxPasses = Math.round(DEMO_WEIGHT_NET_LOSS_KG / DEMO_WEIGHT_STEP_KG) * 4;

  for (let pass = 0; pass < maxPasses && weights[weights.length - 1] !== endTarget; pass += 1) {
    const gap = endTarget - weights[weights.length - 1];
    const step = gap > 0 ? DEMO_WEIGHT_STEP_KG : -DEMO_WEIGHT_STEP_KG;
    let moved = false;

    for (let index = weights.length - 1; index > 0; index -= 1) {
      const candidate = roundDemoWeightKg(weights[index] + step);
      const next = index < weights.length - 1 ? weights[index + 1] : undefined;
      if (!isValidNeighborStep(weights[index - 1], candidate, next)) {
        continue;
      }

      weights[index] = candidate;
      moved = true;
      break;
    }

    if (!moved) {
      break;
    }
  }
}

function toDemoIsoTimestamp(dateKey: string, hour: number, minute: number, second: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${dateKey}T${hh}:${mm}:${ss}.000Z`;
}

function pickWeighInTimestamp(dateKey: string, random: () => number): string {
  const roll = random();
  let hour: number;
  let minute: number;

  if (roll < 0.82) {
    hour = 5 + Math.floor(random() * 4);
    minute = Math.floor(random() * 60);
    if (random() < 0.4) {
      hour = 9;
      minute = Math.floor(random() * 46);
    }
  } else if (roll < 0.94) {
    hour = 10 + Math.floor(random() * 2);
    minute = Math.floor(random() * 60);
  } else {
    hour = 12 + Math.floor(random() * 9);
    minute = Math.floor(random() * 60);
  }

  const second = Math.floor(random() * 60);
  return toDemoIsoTimestamp(dateKey, hour, minute, second);
}

function pickSameDayEditTimestamp(dateKey: string, createdAt: string, random: () => number): string {
  const created = new Date(createdAt);
  const hour = Math.max(created.getUTCHours() + 1, 17 + Math.floor(random() * 5));
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  let updatedAt = toDemoIsoTimestamp(dateKey, Math.min(hour, 23), minute, second);

  if (updatedAt <= createdAt) {
    updatedAt = toDemoIsoTimestamp(dateKey, 22, 59, Math.floor(random() * 60));
  }

  return updatedAt;
}

function pickLaterDayEditTimestamp(dateKey: string, random: () => number): string {
  const offsetDays = 1 + Math.floor(random() * 4);
  const editDateKey = toDateKey(addDays(fromDateKey(dateKey), offsetDays));
  const hour = 17 + Math.floor(random() * 5);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  return toDemoIsoTimestamp(editDateKey, hour, minute, second);
}

function buildDemoEntryTimestamps(
  dateKey: string,
  random: () => number,
): { createdAt: string; updatedAt: string } {
  const createdAt = pickWeighInTimestamp(dateKey, random);

  if (random() > DEMO_EDIT_CHANCE) {
    return { createdAt, updatedAt: createdAt };
  }

  const updatedAt =
    random() < DEMO_SAME_DAY_EDIT_CHANCE
      ? pickSameDayEditTimestamp(dateKey, createdAt, random)
      : pickLaterDayEditTimestamp(dateKey, random);

  if (updatedAt <= createdAt) {
    return { createdAt, updatedAt: pickSameDayEditTimestamp(dateKey, createdAt, random) };
  }

  return { createdAt, updatedAt };
}

function buildWeightSeries(span: number, random: () => number): number[] {
  const deltas = buildDailyDeltas(span, random);
  const weights = [roundDemoWeightKg(DEMO_WEIGHT_START_KG)];

  for (const delta of deltas) {
    weights.push(stepDemoWeight(weights[weights.length - 1], delta));
  }

  applyEndWeightCorrection(weights);
  return weights;
}

export function buildDemoWeightEntries(today: Date): WeightEntry[] {
  const latest = getDemoLatestWeighInDate(today);
  const span = DEMO_WEIGHT_ENTRY_COUNT - 1;
  const weightRandom = createSeededRandom(DEMO_WEIGHT_RANDOM_SEED);
  const timestampRandom = createSeededRandom(DEMO_TIMESTAMP_RANDOM_SEED);
  const weightsChronological = buildWeightSeries(span, weightRandom);
  const entries: WeightEntry[] = [];

  for (let daysBeforeLatest = span; daysBeforeLatest >= 0; daysBeforeLatest -= 1) {
    const date = new Date(latest);
    date.setDate(latest.getDate() - daysBeforeLatest);
    const key = toDateKey(date);
    const weightIndex = span - daysBeforeLatest;
    const { createdAt, updatedAt } = buildDemoEntryTimestamps(key, timestampRandom);
    entries.push({
      date: key,
      weightKg: weightsChronological[weightIndex],
      createdAt,
      updatedAt,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
