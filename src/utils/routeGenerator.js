/**
 * Generates unique checkpoint routes for each team using a coprime-step
 * circular-shift algorithm on the full checkpoint list.
 *
 * Each team gets `checkpointsPerDay` checkpoints for Day 1 and the same
 * for Day 2, drawn from the full pool without repetition within a team.
 *
 * Coprime steps are computed dynamically for any pool size M.
 * Unique-route capacity = M × φ(M)  (M times Euler's totient of M).
 */

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

function getCoprimeFamilies(n) {
  const steps = []
  for (let s = 1; s < n; s++) {
    if (gcd(s, n) === 1) steps.push(s)
  }
  return steps
}

/**
 * @param {string[]} checkpointIds     All available checkpoint IDs (length M)
 * @param {number}   numTeams          Number of teams to generate routes for
 * @param {number}   checkpointsPerDay Checkpoints each team gets per day (includes final if set)
 * @param {string|null} finalCheckpointId  If set, this checkpoint is always placed last on each day
 * @returns {{ teamIndex: number, day1Order: string[], day2Order: string[] }[]}
 */
export function generateRoutes(checkpointIds, numTeams, checkpointsPerDay, finalCheckpointId = null) {
  // Exclude the final checkpoint from the random pool
  const pool = finalCheckpointId
    ? checkpointIds.filter(id => id !== finalCheckpointId)
    : checkpointIds

  const randomPerDay = finalCheckpointId ? checkpointsPerDay - 1 : checkpointsPerDay
  const M       = pool.length
  const perTeam = randomPerDay * 2

  if (randomPerDay < 0 || perTeam > M) {
    throw new Error(
      `checkpointsPerDay (${checkpointsPerDay}) × 2 exceeds available checkpoints (${M}${finalCheckpointId ? ' after reserving the final checkpoint' : ''})`
    )
  }

  const families = getCoprimeFamilies(M)
  const maxTeams = M * families.length
  if (numTeams > maxTeams) {
    throw new Error(
      `Cannot generate ${numTeams} unique routes from ${M} checkpoints (max ${maxTeams})`
    )
  }

  const routes = []

  for (let i = 0; i < numTeams; i++) {
    const familyIdx = Math.floor(i / M)
    const offset    = i % M
    const step      = families[familyIdx]

    // Full circular permutation of the pool for this team
    const indices = []
    for (let k = 0; k < M; k++) {
      indices.push((offset + k * step) % M)
    }

    // Take only the random slots, split evenly across the two days
    const selected  = indices.slice(0, perTeam).map(idx => pool[idx])
    const day1Random = selected.slice(0, randomPerDay)
    const day2Random = selected.slice(randomPerDay)

    routes.push({
      teamIndex: i,
      day1Order: finalCheckpointId ? [...day1Random, finalCheckpointId] : day1Random,
      day2Order: finalCheckpointId ? [...day2Random, finalCheckpointId] : day2Random,
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
