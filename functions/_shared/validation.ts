import type { MessageStatus, ProjectStatus } from './types'

const validProjectStatuses = new Set<ProjectStatus>(['draft', 'published', 'scheduled'])
const validMessageStatuses = new Set<MessageStatus>(['new', 'read', 'archived'])

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && validProjectStatuses.has(value as ProjectStatus)
}

export function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === 'string' && validMessageStatuses.has(value as MessageStatus)
}
