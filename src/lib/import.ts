import type {
  BatteryConfig,
  CalculatorState,
  CurrentUnit,
  DurationUnit,
  FrequencyUnit,
  LeakageCurrent,
  Phase,
} from '@/types/calculator'

const CURRENT_UNITS = new Set<CurrentUnit>(['nA', 'µA', 'mA', 'A'])
const DURATION_UNITS = new Set<DurationUnit>(['ms', 's', 'min', 'h'])
const FREQUENCY_UNITS = new Set<FrequencyUnit>(['perHour', 'perDay', 'perWeek'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseBatteryConfig(value: unknown): BatteryConfig {
  if (!isRecord(value)) {
    throw new Error('Battery configuration is missing or invalid.')
  }

  const { capacity_mAh, usablePercent, selfDischargePercentPerMonth } = value

  if (
    !isFiniteNumber(capacity_mAh) ||
    !isFiniteNumber(usablePercent) ||
    !isFiniteNumber(selfDischargePercentPerMonth)
  ) {
    throw new Error('Battery configuration contains invalid numeric values.')
  }

  return {
    capacity_mAh,
    usablePercent,
    selfDischargePercentPerMonth,
  }
}

function parsePhase(value: unknown, index: number): Phase {
  if (!isRecord(value)) {
    throw new Error(`Phase ${index + 1} is invalid.`)
  }

  const {
    id,
    name,
    isDeepSleep,
    current,
    currentUnit,
    duration,
    durationUnit,
    frequency,
    frequencyUnit,
  } = value

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof isDeepSleep !== 'boolean' ||
    !isFiniteNumber(current) ||
    !CURRENT_UNITS.has(currentUnit as CurrentUnit) ||
    !isFiniteNumber(duration) ||
    !DURATION_UNITS.has(durationUnit as DurationUnit) ||
    !isFiniteNumber(frequency) ||
    !FREQUENCY_UNITS.has(frequencyUnit as FrequencyUnit)
  ) {
    throw new Error(`Phase ${index + 1} contains invalid values.`)
  }

  return {
    id,
    name,
    isDeepSleep,
    current,
    currentUnit,
    duration,
    durationUnit,
    frequency,
    frequencyUnit,
  }
}

function parseLeakageCurrent(value: unknown, index: number): LeakageCurrent {
  if (!isRecord(value)) {
    throw new Error(`Leakage current ${index + 1} is invalid.`)
  }

  const { id, label, current, currentUnit } = value

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !isFiniteNumber(current) ||
    !CURRENT_UNITS.has(currentUnit as CurrentUnit)
  ) {
    throw new Error(`Leakage current ${index + 1} contains invalid values.`)
  }

  return {
    id,
    label,
    current,
    currentUnit,
  }
}

export function importConfigFromJSON(jsonText: string): CalculatorState {
  let parsed: unknown

  // Parse the exported config file before validating its shape.
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  if (!isRecord(parsed)) {
    throw new Error('The selected file does not contain a calculator configuration.')
  }

  const { battery, phases, leakageCurrents } = parsed

  if (!Array.isArray(phases) || !Array.isArray(leakageCurrents)) {
    throw new Error('The selected file does not match the exported configuration format.')
  }

  // Rebuild a fully typed calculator state from the exported JSON structure.
  const nextState: CalculatorState = {
    battery: parseBatteryConfig(battery),
    phases: phases.map((phase, index) => parsePhase(phase, index)),
    leakageCurrents: leakageCurrents.map((leakage, index) =>
      parseLeakageCurrent(leakage, index),
    ),
  }

  // The calculator expects at least one DeepSleep phase to remain present.
  if (!nextState.phases.some((phase) => phase.isDeepSleep)) {
    throw new Error('The imported configuration must include a DeepSleep phase.')
  }

  return nextState
}
