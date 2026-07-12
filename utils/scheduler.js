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

function pairTeams(teamList, round) {
  const n = teamList.length;
  if (n < 2) return { matches: [], byes: teamList.map(t => t.join('')) };
  const indices = [0];
  for (let i = 1; i < n; i++) indices.push(1 + (i - 1 + round) % (n - 1));
  const matches = [];
  const byes = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const j = n - 1 - i;
    matches.push({ teams: [teamList[indices[i]], teamList[indices[j]]] });
  }
  if (n % 2 === 1) byes.push(teamList[indices[Math.floor(n / 2)]].join(''));
  return { matches, byes };
}

function generateDoublesRound(players, round, type) {
  let males = players.filter(p => p.gender === 'male');
  let females = players.filter(p => p.gender === 'female');

  if (type === 'mixed') {
    const allMales = players.filter(p => p.gender === 'male');
    const allFemales = players.filter(p => p.gender === 'female');
    const mc = Math.min(allMales.length, allFemales.length);
    const teams = [];
    for (let i = 0; i < mc; i++) teams.push([allMales[i].label, allFemales[i].label]);
    const extra = [];
    if (allMales.length > mc) extra.push(allMales[mc].label);
    if (allFemales.length > mc) extra.push(allFemales[mc].label);
    const result = pairTeams(teams, round);
    result.byes.push(...extra);
    return result;
  }

  // normal: auto 男双+女双, fallback 混双 when only 1+1
  for (let r = 0; r < round; r++) {
    if (males.length >= 2) { const last = males.pop(); males.splice(1, 0, last); }
    if (females.length >= 2) { const last = females.pop(); females.splice(1, 0, last); }
  }
  const mTeams = [];
  const fTeams = [];
  const indivByes = [];
  let mi = 0;
  while (mi + 1 < males.length) { mTeams.push([males[mi].label, males[mi+1].label]); mi += 2; }
  if (mi < males.length) indivByes.push(males[mi].label);
  let fi = 0;
  while (fi + 1 < females.length) { fTeams.push([females[fi].label, females[fi+1].label]); fi += 2; }
  if (fi < females.length) indivByes.push(females[fi].label);
  if (indivByes.length === 2) { mTeams.push([indivByes[0], indivByes[1]]); indivByes.length = 0; }
  if (mTeams.length === 1 && fTeams.length === 1) {
    const allM = mTeams[0].concat(indivByes.filter(b => players.some(p => p.gender === 'male' && p.label === b)));
    const allF = fTeams[0].concat(indivByes.filter(b => players.some(p => p.gender === 'female' && p.label === b)));
    if (Math.min(allM.length, allF.length) >= 2) {
      const mc = Math.min(allM.length, allF.length);
      mTeams.length = 0; fTeams.length = 0; indivByes.length = 0;
      for (let i = 0; i < mc; i++) mTeams.push([allM[i], allF[i]]);
      if (allM.length > mc) indivByes.push(allM[mc]);
      if (allF.length > mc) indivByes.push(allF[mc]);
    }
  }
  const matches = [];
  const byes = [...indivByes];
  for (const tlist of [mTeams, fTeams]) {
    const r = pairTeams(tlist, round);
    matches.push(...r.matches);
    byes.push(...r.byes);
  }
  return { matches, byes };
}

function generateSchedule(mode, players, rounds, numCourts, roundTypes) {
  const playerNames = players.map(p => p.label);
  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    const result = mode === 'doubles'
      ? generateDoublesRound(players, r, roundTypes[r])
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
    mode, playerNames, rounds: schedule.length, roundTypes,
    courts: numCourts, schedule, createdAt: Date.now()
  };
}

module.exports = { generateSchedule };
