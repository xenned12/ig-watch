import { expect, it } from 'vitest';
import { normaliseHandle, tagError, validateRunInput } from '@/lib/handles';

it.each(['@Promptpilot','promptpilot/','https://instagram.com/promptpilot?igsh=x','https://www.instagram.com/PROMPTPILOT/reels/',' PROMPTPILOT '])
  ('normalises %s', raw => expect(normaliseHandle(raw)).toBe('promptpilot'));
it('rejects a duplicate after normalising', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:['a1','@A1','b2','c3'] }))
    .toEqual({ ok:false, errors:{ competitors:'@a1 is already in the list.' } }));
it('rejects client listed as competitor', () =>
  expect(validateRunInput({ niche:'AI', client:'@Me', competitors:['me','b','c'] }))
    .toMatchObject({ ok:false, errors:{ client:'@me is also in the competitor list. Remove it there first.' } }));
it('needs 3 competitors', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:['a'] }))
    .toMatchObject({ ok:false, errors:{ competitors:'Add 2 more competitors. You need 3 to 10.' } }));
it('caps at 10', () =>
  expect(validateRunInput({ niche:'AI', client:'me', competitors:Array.from({length:11},(_,i)=>'c'+i) }))
    .toMatchObject({ ok:false, errors:{ competitors:'You can compare up to 10 competitors.' } }));
it('rejects an unknown niche', () =>
  expect(validateRunInput({ niche:'Food', client:'me', competitors:['a','b','c'] })).toMatchObject({ ok:false }));
it('tagError flags the client', () => expect(tagError('me','me',[])).toBe('@me is already the client.'));
it('accepts and returns normalised values', () =>
  expect(validateRunInput({ niche:'AI', client:'@Me', competitors:['A','b','c'] }))
    .toEqual({ ok:true, value:{ niche:'AI', client:'me', competitors:['a','b','c'] } }));
