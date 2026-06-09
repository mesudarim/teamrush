/**
 * Generates unique checkpoint routes for each team using a coprime-step
 * circular-shift algorithm on the full checkpoint list.
 *
 * With M checkpoints and 8 coprime step families, supports up to M×8 unique routes.
 * For M=20 → 160 max unique routes (sufficient for up to 160 teams).
 *
 * Each route = full ordered list of M checkpoint IDs.
 *   day1Order = first  M/2 checkpoint IDs  (Day 1 route)
 *   day2Order = last   M/2 checkpoint IDs  (Day 2 route)
 *
 * At T=0, teams are spread across all M starting checkpoints (optimal dispatch).
 * Teams in different families diverge immediately after the first checkpoint.
 */

// Steps coprime to 20 — ordered for maximum route diversity
const COPRIME_STEPS = [7, 9, 11, 13, 3, 17, 19, 1]

/**
 * @param {string[]} checkpointIds  Ordered array of all checkpoint IDs (length M, M must be even)
 * @param {number}   numTeams       Number of teams to generate routes for
 * @returns {{ teamIndex: number, day1Order: string[], day2Order: string[] }[]}
 */
export function generateRoutes(checkpointIds, numTeams) {
  const M = checkpointIds.length
  if (M % 2 !== 0) throw new Error('checkpointIds length must be even')

  const maxTeams = M * COPRIME_STEPS.length
  if (numTeams > maxTeams) {
    throw new Error(`Cannot generate ${numTeams} unique routes from ${M} checkpoints (max ${maxTeams})`)
  }

  const half = M / 2
  const routes = []

  for (let i = 0; i < numTeams; i++) {
    const familyIdx = Math.floor(i / M)
    const offset    = i % M
    const step      = COPRIME_STEPS[familyIdx]

    // Build the full 20-checkpoint sequence for this team
    const indices = []
    for (let k = 0; k < M; k++) {
      indices.push((offset + k * step) % M)
    }

    routes.push({
      teamIndex: i,
      day1Order: indices.slice(0, half).map(idx => checkpointIds[idx]),
      day2Order: indices.slice(half).map(idx => checkpointIds[idx]),
    })
  }

  return routes
}

/**
 * Returns a human-readable summary matrix for the admin table.
 * @param {object[]} routes         Output of generateRoutes()
 * @param {object[]} checkpoints    Array of checkpoint objects with { id, title }
 * @param {number}   day            1 or 2
 * @returns {{ teamIndex: number, checkpointNames: string[] }[]}
 */
export function buildDisplayMatrix(routes, checkpoints, day) {
  const nameById = {}
  checkpoints.forEach(cp => { nameById[cp.id] = cp.title ?? cp.id })

  return routes.map(r => ({
    teamIndex: r.teamIndex,
    order: (day === 1 ? r.day1Order : r.day2Order).map(id => nameById[id] ?? id),
  }))
}
