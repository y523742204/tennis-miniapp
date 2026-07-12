function assignCourts(matches, numCourts) {
  return matches.map((m, i) => ({
    ...m,
    court: (i % numCourts) + 1,
    display: m.teams.map(t => t.join('')).join(' vs ')
  }));
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
  let males = players.filter(p => p.gender === 'male');
  let females = players.filter(p => p.gender === 'female');

  for (let r = 0; r < round; r++) {
    if (males.length >= 2) { const last = males.pop(); males.splice(1, 0, last); }
    if (females.length >= 2) { const last = females.pop(); females.splice(1, 0, last); }
  }

  const teams = [];
  const indivByes = [];
  let mi = 0;
  while (mi + 1 < males.length) { teams.push({ members: [males[mi].label, males[mi+1].label] }); mi += 2; }
  if (mi < males.length) indivByes.push(males[mi].label);
  let fi = 0;
  while (fi + 1 < females.length) { teams.push({ members: [females[fi].label, females[fi+1].label] }); fi += 2; }
  if (fi < females.length) indivByes.push(females[fi].label);
  if (indivByes.length === 2) { teams.push({ members: [indivByes[0], indivByes[1]] }); indivByes.length = 0; }

  const n = teams.length;
  if (n < 2) return { matches: [], byes: indivByes.concat(teams.map(t => t.members.join(''))) };

  const indices = [0];
  for (let i = 1; i < n; i++) indices.push(1 + (i - 1 + round) % (n - 1));

  const matches = [];
  const byes = [...indivByes];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const j = n - 1 - i;
    matches.push({ teams: [teams[indices[i]].members, teams[indices[j]].members] });
  }
  if (n % 2 === 1) byes.push(teams[indices[Math.floor(n / 2)]].members.join(''));

  return { matches, byes };
}

function generateSchedule(mode, players, rounds, numCourts) {
  const playerNames = players.map(p => p.label);
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
