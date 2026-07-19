function assignCourts(matches, numCourts) {
  return matches.map((m, i) => ({
    ...m,
    court: (i % numCourts) + 1,
    display: m.teams.map(t => t.join('')).join(' vs ')
  }));
}

function generateSinglesRound(players, round, numCourts) {
  const n = players.length;
  if (n < 2) return { matches: [], byes: players.map(p => p.label) };
  const indices = [0];
  for (let i = 1; i < n; i++) {
    indices.push(1 + (i - 1 + round) % (n - 1));
  }
  const max = Math.min(Math.floor(n / 2), numCourts);
  const matches = [];
  const paired = new Set();
  for (let i = 0; i < max; i++) {
    const j = n - 1 - i;
    const p1 = players[indices[i]];
    const p2 = players[indices[j]];
    matches.push({ teams: [[p1.label], [p2.label]] });
    paired.add(p1.label); paired.add(p2.label);
  }
  const byes = players.filter(p => !paired.has(p.label)).map(p => p.label);
  return { matches, byes };
}

function generateSinglesSchedule(players, numCourts, targetRounds, targetPerPlayer) {
  const n = players.length;
  // All possible unique matchups
  const allMatchups = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allMatchups.push({ p1: players[i].label, p2: players[j].label, used: false });
    }
  }
  // Remaining matches each player still needs
  const remaining = {};
  players.forEach(p => { remaining[p.label] = targetPerPlayer; });

  const schedule = [];
  for (let r = 0; r < targetRounds; r++) {
    const usedInRound = new Set();
    const matches = [];

    const pool = allMatchups.filter(m => !m.used && remaining[m.p1] > 0 && remaining[m.p2] > 0);
    // Sort: players with more remaining matches get priority
    pool.sort((a, b) => {
      const aSum = remaining[a.p1] + remaining[a.p2];
      const bSum = remaining[b.p1] + remaining[b.p2];
      if (aSum !== bSum) return bSum - aSum;
      return Math.min(remaining[a.p1], remaining[a.p2]) - Math.min(remaining[b.p1], remaining[b.p2]);
    });

    // DFS: find max non-conflicting match subset from pool
    const maxSize = Math.min(numCourts, pool.length);
    function dfsSearch(idx, selected, used) {
      let best = selected.slice();
      if (selected.length >= maxSize || idx >= pool.length) return best;
      // skip current
      best = dfsSearch(idx + 1, selected, used);
      // take current if both free
      const m = pool[idx];
      if (!used.has(m.p1) && !used.has(m.p2)) {
        used.add(m.p1); used.add(m.p2);
        selected.push(m);
        const cand = dfsSearch(idx + 1, selected, used);
        if (cand.length > best.length) best = cand;
        selected.pop();
        used.delete(m.p1); used.delete(m.p2);
      }
      return best;
    }
    const selected = dfsSearch(0, [], new Set());
    for (const m of selected) {
      m.used = true;
      matches.push({ teams: [[m.p1], [m.p2]] });
      usedInRound.add(m.p1);
      usedInRound.add(m.p2);
      remaining[m.p1]--;
      remaining[m.p2]--;
    }
    const byes = players.filter(p => !usedInRound.has(p.label)).map(p => p.label);
    schedule.push({ round: r + 1, matches, byes });
  }
  return schedule;
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

function applyFixedPairsMixed(allMales, allFemales, fixedPairs, round) {
  for (const pair of fixedPairs) {
    if (round >= pair.rounds) continue;
    const mi = allMales.findIndex(p => p.label === pair.p1);
    const fi = allFemales.findIndex(p => p.label === pair.p2);
    if (mi > -1 && fi > -1 && allFemales[mi].label !== pair.p2) {
      [allFemales[mi], allFemales[fi]] = [allFemales[fi], allFemales[mi]];
    }
  }
}

function applyFixedPairsNormal(arr, fixedPairs, round) {
  for (const pair of fixedPairs) {
    if (round >= pair.rounds) continue;
    const i1 = arr.findIndex(p => p.label === pair.p1);
    const i2 = arr.findIndex(p => p.label === pair.p2);
    if (i1 > -1 && i2 > -1) {
      const partnerIdx = i1 % 2 === 0 ? i1 + 1 : i1 - 1;
      if (partnerIdx >= 0 && partnerIdx < arr.length && i2 !== partnerIdx) {
        [arr[partnerIdx], arr[i2]] = [arr[i2], arr[partnerIdx]];
      }
    }
  }
}

function generateDoublesRound(players, globalRound, type, fixedPairs, mixedRoundIdx, femaleBase) {
  let males = players.filter(p => p.gender === 'male');
  let females = players.filter(p => p.gender === 'female');

  if (type === 'mixed') {
    const allMales = players.filter(p => p.gender === 'male');
    const allFemales = femaleBase ? [...femaleBase] : players.filter(p => p.gender === 'female');
    for (let r = 0; r < mixedRoundIdx; r++) { if (allFemales.length >= 2) { allFemales.push(allFemales.shift()); } }
    if (fixedPairs) applyFixedPairsMixed(allMales, allFemales, fixedPairs, globalRound);
    const mc = Math.min(allMales.length, allFemales.length);
    const teams = [];
    for (let i = 0; i < mc; i++) teams.push([allMales[i].label, allFemales[i].label]);
    const extra = [];
    if (allMales.length > mc) extra.push(allMales[mc].label);
    if (allFemales.length > mc) extra.push(allFemales[mc].label);
    const result = pairTeams(teams, mixedRoundIdx);
    result.byes.push(...extra);
    return result;
  }

  // normal: auto 男双+女双, fallback 混双 when only 1+1
  for (let r = 0; r < globalRound; r++) {
    if (males.length >= 2) { const last = males.pop(); males.splice(1, 0, last); }
    if (females.length >= 2) { const last = females.pop(); females.splice(1, 0, last); }
  }
  if (fixedPairs) {
    applyFixedPairsNormal(males, fixedPairs, globalRound);
    applyFixedPairsNormal(females, fixedPairs, globalRound);
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
    const r = pairTeams(tlist, globalRound);
    matches.push(...r.matches);
    byes.push(...r.byes);
  }
  return { matches, byes };
}

function generateSchedule(mode, players, rounds, numCourts, roundTypes, fixedPairs) {
  const playerNames = players.map(p => p.label);
  const maleCount = players.filter(p => p.gender === 'male').length;
  const femaleCount = players.filter(p => p.gender === 'female').length;
  const schedule = [];
  let mixedRoundCount = 0;
  // Pre‑compute adjusted female base so fixed‑pair partners align at rotation 0
  let femaleBase = null;
  if (mode === 'doubles' && fixedPairs && fixedPairs.length > 0) {
    const allFemales = players.filter(p => p.gender === 'female');
    const allMales = players.filter(p => p.gender === 'male');
    for (const pair of fixedPairs) {
      const mi = allMales.findIndex(p => p.label === pair.p1);
      const fi = allFemales.findIndex(p => p.label === pair.p2);
      if (mi > -1 && fi > -1 && allFemales[mi].label !== pair.p2) {
        [allFemales[mi], allFemales[fi]] = [allFemales[fi], allFemales[mi]];
      }
    }
    femaleBase = allFemales;
  }
  if (mode === 'singles') {
    const y = Math.min(Math.floor(2 * numCourts * rounds / players.length), players.length - 1) || 1;
    const singlesSchedule = generateSinglesSchedule(players, numCourts, rounds, y);
    for (const rd of singlesSchedule) {
      schedule.push({
        round: rd.round,
        matches: assignCourts(rd.matches, numCourts),
        byes: rd.byes
      });
    }
  } else {
    for (let r = 0; r < rounds; r++) {
      const isMixed = roundTypes[r] === 'mixed';
      const result = generateDoublesRound(players, r, roundTypes[r], fixedPairs, isMixed ? mixedRoundCount++ : -1, femaleBase);
      // Doubles: check vs previous round only
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
  }
  return {
    mode, playerNames, rounds: schedule.length, roundTypes,
    courts: numCourts, schedule, fixedPairs: fixedPairs || [],
    maleCount, femaleCount,
    createdAt: Date.now()
  };
}

module.exports = { generateSchedule };
