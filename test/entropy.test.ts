import { calculateShannonEntropy, isHighEntropyString } from '../src/utils/entropy';

describe('Shannon Entropy Calculator', () => {
  test('returns 0 for empty or null string', () => {
    expect(calculateShannonEntropy('')).toBe(0);
    expect(calculateShannonEntropy(null as any)).toBe(0);
    expect(calculateShannonEntropy(undefined as any)).toBe(0);
  });

  test('returns 0 for single character repeated string', () => {
    expect(calculateShannonEntropy('aaaaaaa')).toBe(0);
    expect(calculateShannonEntropy('11111111')).toBe(0);
  });

  test('returns expected entropy for known uniform distribution', () => {
    // 2 unique characters equally distributed: entropy = 1.0
    expect(calculateShannonEntropy('abababab')).toBeCloseTo(1.0, 4);
    // 4 unique characters equally distributed: entropy = 2.0
    expect(calculateShannonEntropy('abcdabcd')).toBeCloseTo(2.0, 4);
  });

  test('detects high entropy strings like cryptographic keys', () => {
    const highEntropyKey = 'd8f43a9b8e2c71f05423bc89a712e098';
    const entropy = calculateShannonEntropy(highEntropyKey);
    expect(entropy).toBeGreaterThan(3.5);
  });

  test('differentiates low entropy English sentences from random keys', () => {
    const regularSentence = 'this_is_a_normal_variable_name_without_randomness';
    const randomKey = 'k9J#m2$xL!9zPq7@wR4tV';
    expect(calculateShannonEntropy(randomKey)).toBeGreaterThan(
      calculateShannonEntropy(regularSentence)
    );
  });

  test('isHighEntropyString rejects strings shorter than minLength', () => {
    expect(isHighEntropyString('abc', 16)).toBe(false);
    expect(isHighEntropyString('shortSecretKey', 16)).toBe(false);
  });

  test('isHighEntropyString rejects strings with spaces', () => {
    expect(isHighEntropyString('this is a sentence with more than sixteen characters', 16)).toBe(
      false
    );
  });

  test('isHighEntropyString ignores standard URL prefixes without credentials', () => {
    expect(isHighEntropyString('https://api.github.com/v1/users/repos', 16)).toBe(false);
    expect(isHighEntropyString('mongodb://localhost:27017/my_local_db', 16)).toBe(false);
  });

  test('isHighEntropyString recognizes random hex/base64 tokens as high entropy', () => {
    const token = 'c9a2f7e4b1d6083e95a7f2c8d1e3a6b4';
    expect(isHighEntropyString(token, 16, 3.8)).toBe(true);
  });

  test('isHighEntropyString respects custom threshold parameter', () => {
    const token = 'c9a2f7e4b1d6083e95a7f2c8d1e3a6b4';
    // Very high threshold should return false
    expect(isHighEntropyString(token, 16, 5.0)).toBe(false);
  });
});
