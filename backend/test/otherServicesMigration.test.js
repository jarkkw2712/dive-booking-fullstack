import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('other service storage uses numeric money and does not expose direct writes',()=>{
  const sql=fs.readFileSync(new URL('../../supabase/migrations/20261108055023_booking_other_services.sql',import.meta.url),'utf8');
  assert.match(sql,/amount numeric\(14,2\)/i);
  assert.match(sql,/on delete restrict/i);
  assert.match(sql,/alter table public\.booking_other_services enable row level security/i);
  assert.match(sql,/revoke insert, update, delete on public\.booking_other_services from service_role/i);
  assert.doesNotMatch(sql,/delete\s+from|truncate/i);
});
