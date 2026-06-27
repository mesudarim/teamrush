/**
 * Generates unique checkpoint routes for each team.
 *
 * Strategy:
 *  - First M×φ(M) teams: coprime-step circular-shift (guarantees every checkpoint
 *    appears exactly once per position within each "family" of M teams).
 *  - Teams beyond that: deterministic seeded Fisher-Yates shuffle (mulberry32 PRNG),
 *    giving M! possible distinct orderings — effectively unlimited capacity.
 */

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

function getCoprimeFamilies(n) {
  const steps = []
  for (let s = 1; s < n; s++) {
    if (gcd(s, n) === 1) steps.push(s)
  }
  return steps
}

// Mulberry32 — fast, deterministic, good distribution
function mulberry32(seed) {
  let t = (seed >>> 0) + 0x6D2B79F5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(arr, seed) {
  const result = [...arr]
  const rand = mulberry32(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * @param {string[]} checkpointIds     All available checkpoint IDs (length M)
 * @param {number}   numTeams          Number of teams to generate routes for
 * @param {number}   checkpointsPerDay Checkpoints each team gets per day (includes final if set)
 * @param {string|null} finalDay1Id    If set, pinned as the last checkpoint of every Day 1 route
 * @param {string|null} finalDay2Id    If set, pinned as the last checkpoint of every Day 2 route
 * @returns {{ teamIndex: number, day1Order: string[], day2Order: string[] }[]}
 */
export function generateRoutes(checkpointIds, numTeams, checkpointsPerDay, finalDay1Id = null, finalDay2Id = null) {
  // Exclude both finals from the random pool (de-duplicated if they happen to be the same)
  const finalsToExclude = new Set([finalDay1Id, finalDay2Id].filter(Boolean))
  const pool = checkpointIds.filter(id => !finalsToExclude.has(id))

  const randomDay1 = checkpointsPerDay - (finalDay1Id ? 1 : 0)
  const randomDay2 = checkpointsPerDay - (finalDay2Id ? 1 : 0)
  const M       = pool.length
  const perTeam = randomDay1 + randomDay2

  if (randomDay1 < 0 || randomDay2 < 0 || perTeam > M) {
    throw new Error(
      `checkpointsPerDay (${checkpointsPerDay}) × 2 exceeds available checkpoints (${M}${finalsToExclude.size ? ` after reserving ${finalsToExclude.size} final checkpoint(s)` : ''})`
    )
  }

  const families       = getCoprimeFamilies(M)
  const maxCoprimeTeams = M * families.length

  const routes = []

  for (let i = 0; i < numTeams; i++) {
    let selected

    if (i < maxCoprimeTeams) {
      // ── Coprime-step circular permutation (optimal spreading) ──────────────
      const familyIdx = Math.floor(i / M)
      const offset    = i % M
      const step      = families[familyIdx]
      const indices   = Array.from({ length: M }, (_, k) => (offset + k * step) % M)
      selected = indices.slice(0, perTeam).map(idx => pool[idx])
    } else {
      // ── Seeded Fisher-Yates fallback (capacity = M!, effectively unlimited) ─
      selected = seededShuffle(pool, i).slice(0, perTeam)
    }

    const day1Random = selected.slice(0, randomDay1)
    const day2Random = selected.slice(randomDay1)

    routes.push({
      teamIndex: i,
      day1Order: finalDay1Id ? [...day1Random, finalDay1Id] : day1Random,
      day2Order: finalDay2Id ? [...day2Random, finalDay2Id] : day2Random,
    })
  }

  return routes
}

/**
 * Returns a human-readable summary matrix for the admin table.
 */
export function buildDisplayMatrix(routes, checkpoints, day) {
  const nameById = {}
  checkpoints.forEach(cp => { nameById[cp.id] = cp.title ?? cp.id })

  return routes.map(r => ({
    teamIndex: r.teamIndex,
    order: (day === 1 ? r.day1Order : r.day2Order).map(id => nameById[id] ?? id),
  }))
}
