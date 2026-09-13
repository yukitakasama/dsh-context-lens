/**
 * Config schema and load-time validation for dsh-context-lens.
 *
 * Every deployment-tunable value lives here rather than as a literal in the
 * code, so an operator can change it from `cordis.yml`. Invalid input throws
 * at load time: a plugin whose only failure mode is "renders confusing
 * numbers" must not start in a state nobody can explain.
 *
 * The schema is expressed through Standard Schema (`~standard`) rather than a
 * validation library, which keeps the package free of runtime dependencies —
 * the same shape the proven community plugins use.
 *
 * @module dsh-context-lens/host/config
 */

/** Inclusive bounds for every numeric tunable. */
const LIMITS = {
  /** Timeline sampling: how many log revisions to advance between samples. */
  sampleStride: { min: 1, max: 10_000, default: 1 },
  /** Timeline sampling: hard cap on sampled points per request. */
  maxSamples: { min: 1, max: 50_000, default: 2_000 },
  /** Timeline sampling: cap on `nodes[]` echoed per sample before truncating. */
  maxNodesPerSample: { min: 1, max: 10_000, default: 500 },
  /** How long one cached measurement set stays valid, in milliseconds. */
  cacheTtlMs: { min: 0, max: 600_000, default: 15_000 },
  /** Estimates of remaining turns: how many recent steps to average over. */
  paceWindow: { min: 1, max: 200, default: 10 },
}

/** The validated configuration shape. */
export const DEFAULTS = Object.freeze(
  Object.fromEntries(Object.entries(LIMITS).map(([key, spec]) => [key, spec.default])),
)

/**
 * Validate one numeric tunable.
 * @param key - field name, used in the error message.
 * @param value - raw input value.
 * @returns the accepted number.
 * @throws when the value is not an integer within its declared bounds.
 */
function numeric(key, value) {
  const spec = LIMITS[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`context-lens: config "${key}" must be an integer, received ${JSON.stringify(value)}`)
  }
  if (value < spec.min || value > spec.max) {
    throw new RangeError(`context-lens: config "${key}" must be within [${spec.min}, ${spec.max}], received ${value}`)
  }
  return value
}

/**
 * Validate a whole configuration object, rejecting unknown keys.
 *
 * Unknown keys are an error rather than a warning: a typo in `cordis.yml`
 * would otherwise leave the operator believing a setting took effect.
 *
 * @param input - raw config from the loader.
 * @returns a frozen, fully populated configuration.
 * @throws when a value is out of range or a key is unknown.
 */
export function validateConfig(input) {
  if (input === undefined || input === null) return Object.freeze({ ...DEFAULTS })
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`context-lens: config must be an object, received ${Array.isArray(input) ? 'array' : typeof input}`)
  }
  const unknown = Object.keys(input).filter(key => !(key in LIMITS))
  if (unknown.length > 0) {
    throw new Error(`context-lens: unknown config key(s) ${unknown.map(k => `"${k}"`).join(', ')}; known keys are ${Object.keys(LIMITS).join(', ')}`)
  }
  const out = { ...DEFAULTS }
  for (const key of Object.keys(LIMITS)) {
    if (input[key] !== undefined) out[key] = numeric(key, input[key])
  }
  return Object.freeze(out)
}

/**
 * The plugin's `Config` export: a Standard Schema the loader validates with
 * before `apply` runs.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-context-lens',
    /**
     * Validate raw config.
     * @param value - raw config from the loader.
     * @returns a Standard Schema result.
     */
    validate(value) {
      try {
        return { value: validateConfig(value) }
      } catch (error) {
        return { issues: [{ message: error instanceof Error ? error.message : String(error) }] }
      }
    },
  },
}
