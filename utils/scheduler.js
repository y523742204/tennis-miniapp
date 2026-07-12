function assignCourts(matches, numCourts) {
  return matches.map((m, i) => ({ ...m, court: (i % numCourts) + 1 }));
}

function generateSinglesRound(players, round) {
  const n = players.length;
  if (n < 2) return { matches: [], byes: players.map(p => p.label) };
  const indices = [0];
  for (let i = 1; i < n; i++) {
    indices.push(1 + (i - 1 + round) % (n - 1));
  }
  const matches = [];
  const byes = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const j = n - 1 - i;
    matches.push({
      teams: [[players[indices[i]].label], [players[indices[j]].label]]
    });
  }
  if (n % 2 === 1) {
    byes.push(players[indices[Math.floor(n / 2)]].label);
  }
  return { matches, byes };
}

function generateDoublesRound(players, round) {
  const n = players.length;
  const matches = [];
  const byes = [];
  if (n < 4) return { matches: [], byes: players.map(p => p.label) };
  const rotated = [...players];
  for (let i = 0; i < round * 2; i++) {
    const last = rotated.pop();
    rotated.splice(1, 0, last);
  }
  for (let i = 0; i < Math.floor(n / 4); i++) {
    const group = rotated.slice(i * 4, i * 4 + 4);
    matches.push({
      teams: [
        [group[0].label, group[1].label],
        [group[2].label, group[3].label]
      ]
    });
  }
  const remaining = n - Math.floor(n / 4) * 4;
  for (let i = 0; i < remaining; i++) {
    byes.push(rotated[Math.floor(n / 4) * 4 + i].label);
  }
  return { matches, byes };
}

function generateSchedule(mode, playerNames, rounds, numCourts) {
  const players = playerNames.map(n => ({ label: n }));
  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    const result = mode === 'doubles'
      ? generateDoublesRound(players, r)
      : generateSinglesRound(players, r);
    if (schedule.length > 0) {
      let prevMatches = schedule[schedule.length - 1].matches;
      let retry = 0;
      while (retry < 50) {
        const currentKey = result.matches.map(m =>
          JSON.stringify(m.teams)
        ).sort().join('|');
        const prevKey = prevMatches.map(m =>
          JSON.stringify(m.teams)
        ).sort().join('|');
        if (currentKey !== prevKey) break;
        const last = result.matches.pop();
        result.matches.unshift(last);
        retry++;
      }
    }
    schedule.push({
      round: r + 1,
      matches: assignCourts(result.matches, numCourts),
      byes: result.byes
    });
  }
  return {
    mode, playerNames, rounds: schedule.length,
    courts: numCourts, schedule, createdAt: Date.now()
  };
}

module.exports = { generateSchedule };
