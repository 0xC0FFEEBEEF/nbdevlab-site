import type { StatusPowerMode } from '../../shared/statusPowerMode'
import type { ProxmoxPower, ProxmoxPowerSummary, ProxmoxWallboard } from '../pages/StatusPage'

function buildSimulatedPowerSummary(
  mode: Exclude<StatusPowerMode, 'live'>,
  sourceSummary: ProxmoxPowerSummary | null,
): ProxmoxPowerSummary {
  const modelName = sourceSummary?.modelName ?? 'Simulated UPS'
  const batteryCapacity = sourceSummary?.batteryCapacity ?? (mode === 'battery' ? '78 %' : '100 %')
  const remainingRuntime =
    sourceSummary?.remainingRuntime ?? (mode === 'battery' ? '12 min.' : 'Standby / charged')
  const load = sourceSummary?.load ?? '32 %'
  const outputVoltage = sourceSummary?.outputVoltage ?? '120 V'

  if (mode === 'battery') {
    return {
      modelName,
      state: 'On Battery (Simulated)',
      powerSource: 'Battery Power (Simulated)',
      batteryCapacity,
      remainingRuntime,
      load,
      utilityVoltage: '0 V',
      outputVoltage,
      lineInteraction: 'Battery Discharge (Simulated)',
    }
  }

  return {
    modelName,
    state: 'Online (Simulated)',
    powerSource: 'Utility Power (Simulated)',
    batteryCapacity,
    remainingRuntime,
    load,
    utilityVoltage: sourceSummary?.utilityVoltage ?? '120 V',
    outputVoltage,
    lineInteraction: 'Normal Feed (Simulated)',
  }
}

export function applyStatusPowerModeToPower(
  power: ProxmoxPower | null,
  mode: StatusPowerMode,
): ProxmoxPower | null {
  if (mode === 'live') {
    return power
  }

  return {
    available: true,
    updatedAt: power?.updatedAt ?? null,
    issue: '',
    summary: buildSimulatedPowerSummary(mode, power?.summary ?? null),
  }
}

export function applyStatusPowerModeToWallboard(
  wallboard: ProxmoxWallboard | null,
  mode: StatusPowerMode,
): ProxmoxWallboard | null {
  if (!wallboard || mode === 'live') {
    return wallboard
  }

  return {
    ...wallboard,
    power: applyStatusPowerModeToPower(wallboard.power, mode),
  }
}
