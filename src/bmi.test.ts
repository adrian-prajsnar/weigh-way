import { describe, expect, it } from 'vitest';
import { calculateBmi, classifyBmiValue } from './bmi';

describe('classifyBmiValue', () => {
  it('uses adult categories when birth date is missing', () => {
    const info = classifyBmiValue(22);
    expect(info.classification).toBe('adult');
    expect(info.category).toBe('normal');
  });

  it('returns unclassified for weigh-ins before birth date', () => {
    const info = classifyBmiValue(22, {
      birthDate: '2000-06-15',
      date: '1999-12-31',
      sex: 'male',
    });
    expect(info.classification).toBe('unclassified');
    expect(info.category).toBe('unclassified');
  });

  it('classifies obese adult BMI', () => {
    const info = classifyBmiValue(31, {
      birthDate: '1990-01-01',
      date: '2024-01-01',
      sex: 'male',
    });
    expect(info.classification).toBe('adult');
    expect(info.category).toBe('obese');
    expect(info.percentile).toBeNull();
  });

  it('uses adult categories at age 20 with null percentile (BMI 22 normal)', () => {
    const info = classifyBmiValue(22, {
      birthDate: '2004-01-01',
      date: '2024-01-01',
      sex: 'male',
    });
    expect(info.classification).toBe('adult');
    expect(info.category).toBe('normal');
    expect(info.percentile).toBeNull();
  });

  it('male 24 months at LMS median M is ~50th percentile (CDC row 24)', () => {
    const birthDate = '2014-01-01';
    const weighInDate = '2016-01-01';
    const bmiAtMedian = 16.57502768;

    const info = classifyBmiValue(bmiAtMedian, {
      birthDate,
      date: weighInDate,
      sex: 'male',
    });

    expect(info.classification).toBe('bmiForAge');
    expect(info.classification).not.toBe('adult');
    expect(info.category).toBe('normal');
    expect(info.percentile).not.toBeNull();
    expect(info.percentile!).toBeGreaterThanOrEqual(48.5);
    expect(info.percentile!).toBeLessThanOrEqual(51.5);
  });
});

describe('calculateBmi', () => {
  it('returns null for invalid measurements', () => {
    expect(calculateBmi(0, 180)).toBeNull();
    expect(calculateBmi(80, 0)).toBeNull();
  });

  it('computes BMI from weight and height', () => {
    const info = calculateBmi(80, 180, {
      birthDate: '1990-01-01',
      date: '2024-01-01',
      sex: 'male',
    });
    expect(info?.value).toBe(24.7);
  });
});
