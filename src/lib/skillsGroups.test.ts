import { describe, expect, it } from 'vitest'
import { createSkillGroup, defaultSkillGroups, normalizeSkillGroups } from './skillsGroups'

describe('skillsGroups', () => {
  it('falls back to defaults when settings are missing', () => {
    expect(normalizeSkillGroups(undefined)).toEqual(defaultSkillGroups)
  })

  it('preserves an intentionally empty skills page', () => {
    expect(normalizeSkillGroups([])).toEqual([])
  })

  it('creates new groups with a starter skill row', () => {
    const group = createSkillGroup()

    expect(group.title).toBe('')
    expect(group.items).toEqual([''])
    expect(group.id).toBeTruthy()
  })
})
