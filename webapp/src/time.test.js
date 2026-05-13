import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVirdInputLockedAt } from './time.js';

describe('isVirdInputLockedAt', () => {
  it('keeps vird input open until 23:50 in Tashkent', () => {
    assert.equal(isVirdInputLockedAt(new Date('2026-05-13T18:49:00Z')), false);
  });

  it('locks vird input from 23:50 in Tashkent', () => {
    assert.equal(isVirdInputLockedAt(new Date('2026-05-13T18:50:00Z')), true);
  });
});
