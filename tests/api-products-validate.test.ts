import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildCreatePayload, buildUpdatePayload, normalizeTags } from '../src/app/api/products/validate'

describe('product validation', () => {
  it('rejects missing title', () => {
    const res = buildCreatePayload({})
    assert.equal('error' in res ? res.error : '', 'title is required')
  })

  it('builds payload with defaults', () => {
    const res = buildCreatePayload({ title: 'Test' })
    assert.ok(!('error' in res))
    if (!('error' in res)) {
      assert.equal(res.payload.title, 'Test')
      assert.equal(res.payload.status, 'active')
      assert.deepEqual(res.payload.tags, [])
    }
  })

  it('normalizes tags from string', () => {
    const tags = normalizeTags('a, b , ,c')
    assert.deepEqual(tags, ['a', 'b', 'c'])
  })

  it('update payload keeps only provided fields', () => {
    const res = buildUpdatePayload({ title: 'New', tags: ['x'] })
    assert.ok(!('error' in res))
    if (!('error' in res)) {
      assert.deepEqual(res.payload, { title: 'New', tags: ['x'] })
    }
  })
})

