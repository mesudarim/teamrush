/**
 * Generates unique checkpoint routes for each team using a coprime-step
 * circular-shift algorithm on the full checkpoint list.
 *
 * Each team gets `checkpointsPerDay` checkpoints for Day 1 and the same
 * for Day 2, drawn from the full pool without repetition within a team.
 *
 * Coprime steps are computed dynamically for any pool size M.
 * Unique-route capacity = M × (number of integers coprime to M, up to 8 families).
 */

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

function getCoprimeFamilies(n, maxFamilies = 8) {
  const steps = []
  for (let s = 1; s < n && steps.length < maxFamilies; s++) {
    if (gcd(s, n) === 1) steps.push(s)
  }
  return steps
}

/**
 * @param {string[]} checkpointIds    All available checkpoint IDs (length M)
 * @param {number}   numTeams         Number of teams to generate routes for
 * @param {number}   checkpointsPerDay Checkpoints each team gets per day (Day1 + Day2 = 2×)
 * @returns {{ teamIndex: number, day1Order: string[], day2Order: string[] }[]}
 */
export function generateRoutes(checkpointIds, numTeams, checkpointsPerDay) {
  const M = checkpointIds.length
  const perTeam = checkpointsPerDay * 2

  if (perTeam > M) {
    throw new Error(
      `checkpointsPerDay (${checkpointsPerDay}) × 2 = ${perTeam} exceeds total checkpoints (${M})`
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

    // Full circular permutation of all M checkpoints for this team
    const indices = []
    for (let k = 0; k < M; k++) {
      indices.push((offset + k * step) % M)
    }

    // Take only the first `perTeam` slots, split evenly across the two days
    const selected = indices.slice(0, perTeam).map(idx => checkpointIds[idx])

    routes.push({
      teamIndex: i,
      day1Order: selected.slice(0, checkpointsPerDay),
      day2Order: selected.slice(checkpointsPerDay),
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
