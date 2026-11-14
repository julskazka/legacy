// GitHub Actions only. Apply one Notibot user's latest vote.
// Input values arrive through workflow_dispatch, never through public JavaScript.
import { readFileSync, writeFileSync } from 'node:fs';

const userId = String(process.env.VOTE_USER_ID ?? '').trim();
const nomineeId = Number(process.env.VOTE_NOMINEE_ID);
const votingEndsAt = Date.parse('2026-11-21T23:59:00+03:00');

if (!/^[A-Za-z0-9:_-]{1,100}$/.test(userId)) {
  throw new Error('Missing or invalid Notibot user ID');
}
if (!Number.isSafeInteger(nomineeId) || nomineeId < 1) {
  throw new Error('Invalid nominee ID');
}
if (Date.now() >= votingEndsAt) {
  throw new Error('Voting has ended');
}

// Verify against the actual nominee list in the published page, not a range
// that could include nonexistent nominees.
const html = readFileSync('index.html', 'utf8');
const marker = 'const NOMINEES=';
const start = html.indexOf(marker);
const end = html.indexOf('];', start);
if (start < 0 || end < 0) {
  throw new Error('Cannot locate nominees in index.html');
}
const nominees = JSON.parse(html.slice(start + marker.length, end + 1));
if (!nominees.some(n => n.id === nomineeId)) {
  throw new Error('Nominee does not exist');
}

const file = 'votes/votes.json';
const votes = JSON.parse(readFileSync(file, 'utf8'));
if (!votes || Array.isArray(votes) || typeof votes !== 'object') {
  throw new Error('Invalid votes.json');
}

// Re-voting replaces the old selection; the same choice is idempotent.
if (Number(votes[userId]?.nominee_id) === nomineeId) {
  console.log('Vote already recorded for the same nominee');
} else {
  votes[userId] = {
    nominee_id: nomineeId,
    updated_at: new Date().toISOString()
  };
  writeFileSync(file, JSON.stringify(votes, null, 2) + '\n');
  console.log('Vote written for one user (ID hidden)');
}
