import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateInitData, parseInitData } from '../src/api/auth.js';

const BOT_TOKEN = '1234567890:test_token_for_testing_purposes_only';

describe('validateInitData', () => {
  it('rejects empty string', () => {
    assert.equal(validateInitData('', BOT_TOKEN), false);
  });

  it('rejects tampered hash', () => {
    const fake = 'auth_date=9999999999&user=%7B%22id%22%3A1%7D&hash=badhash';
    assert.equal(validateInitData(fake, BOT_TOKEN), false);
  });
});

describe('parseInitData', () => {
  it('extracts user object', () => {
    const raw = 'auth_date=1700000000&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Nigora%22%7D&hash=abc';
    const result = parseInitData(raw);
    assert.equal(result.user.id, 42);
    assert.equal(result.user.first_name, 'Nigora');
  });
});
