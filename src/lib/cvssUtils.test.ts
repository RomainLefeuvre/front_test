/**
 * Tests for CVSS Utility Functions
 */

import { describe, it, expect } from 'vitest';
import { interpretCVSSScore, extractCVSSScore, isCVSSVector } from './cvssUtils';

describe('cvssUtils', () => {
  describe('interpretCVSSScore', () => {
    it('should interpret score 0.0 as None', () => {
      const result = interpretCVSSScore(0.0);
      expect(result.label).toBe('None');
      expect(result.color).toBe('gray');
    });

    it('should interpret scores 0.1-3.9 as Low', () => {
      expect(interpretCVSSScore(0.1).label).toBe('Low');
      expect(interpretCVSSScore(2.0).label).toBe('Low');
      expect(interpretCVSSScore(3.9).label).toBe('Low');
      expect(interpretCVSSScore(0.1).color).toBe('yellow');
    });

    it('should interpret scores 4.0-6.9 as Medium', () => {
      expect(interpretCVSSScore(4.0).label).toBe('Medium');
      expect(interpretCVSSScore(5.5).label).toBe('Medium');
      expect(interpretCVSSScore(6.9).label).toBe('Medium');
      expect(interpretCVSSScore(4.0).color).toBe('orange');
    });

    it('should interpret scores 7.0-8.9 as High', () => {
      expect(interpretCVSSScore(7.0).label).toBe('High');
      expect(interpretCVSSScore(8.0).label).toBe('High');
      expect(interpretCVSSScore(8.9).label).toBe('High');
      expect(interpretCVSSScore(7.0).color).toBe('red');
    });

    it('should interpret scores 9.0-10.0 as Critical', () => {
      expect(interpretCVSSScore(9.0).label).toBe('Critical');
      expect(interpretCVSSScore(9.5).label).toBe('Critical');
      expect(interpretCVSSScore(10.0).label).toBe('Critical');
      expect(interpretCVSSScore(9.0).color).toBe('purple');
    });

    it('should handle string scores', () => {
      expect(interpretCVSSScore('7.5').label).toBe('High');
      expect(interpretCVSSScore('9.8').label).toBe('Critical');
      expect(interpretCVSSScore('3.1').label).toBe('Low');
    });

    it('should handle invalid scores', () => {
      expect(interpretCVSSScore('invalid').label).toBe('Unknown');
      expect(interpretCVSSScore('').label).toBe('Unknown');
      expect(interpretCVSSScore(NaN).label).toBe('Unknown');
    });

    it('should return proper styling classes', () => {
      const critical = interpretCVSSScore(9.5);
      expect(critical.bgColor).toBe('bg-purple-100');
      expect(critical.textColor).toBe('text-purple-800');

      const high = interpretCVSSScore(7.5);
      expect(high.bgColor).toBe('bg-red-100');
      expect(high.textColor).toBe('text-red-800');

      const medium = interpretCVSSScore(5.0);
      expect(medium.bgColor).toBe('bg-orange-100');
      expect(medium.textColor).toBe('text-orange-800');

      const low = interpretCVSSScore(2.0);
      expect(low.bgColor).toBe('bg-yellow-100');
      expect(low.textColor).toBe('text-yellow-800');
    });
  });

  describe('extractCVSSScore', () => {
    it('should extract numeric scores', () => {
      expect(extractCVSSScore('7.5')).toBe(7.5);
      expect(extractCVSSScore('9.8')).toBe(9.8);
      expect(extractCVSSScore('0.0')).toBe(0.0);
      expect(extractCVSSScore('10.0')).toBe(10.0);
    });

    it('should handle invalid scores', () => {
      expect(extractCVSSScore('invalid')).toBeNull();
      expect(extractCVSSScore('')).toBeNull();
      expect(extractCVSSScore('abc')).toBeNull();
    });

    it('should reject out-of-range scores', () => {
      expect(extractCVSSScore('11.0')).toBeNull();
      expect(extractCVSSScore('-1.0')).toBeNull();
      expect(extractCVSSScore('15.5')).toBeNull();
    });

    it('should handle CVSS vector strings', () => {
      // Vector strings should return null as we don't calculate them
      expect(extractCVSSScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBeNull();
    });
  });

  describe('isCVSSVector', () => {
    it('should identify CVSS vector strings', () => {
      expect(isCVSSVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(true);
      expect(isCVSSVector('CVSS:3.0/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H')).toBe(true);
      expect(isCVSSVector('CVSS:2.0/AV:N/AC:L/Au:N/C:P/I:P/A:P')).toBe(true);
    });

    it('should not identify numeric scores as vectors', () => {
      expect(isCVSSVector('7.5')).toBe(false);
      expect(isCVSSVector('9.8')).toBe(false);
      expect(isCVSSVector('0.0')).toBe(false);
    });

    it('should handle invalid strings', () => {
      expect(isCVSSVector('invalid')).toBe(false);
      expect(isCVSSVector('')).toBe(false);
      expect(isCVSSVector('HIGH')).toBe(false);
    });
  });
});
