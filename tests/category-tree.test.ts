import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCategoryTree, filterCategoryTree, flattenCategoryTree } from '../shared/utils/category-tree'
import type { CategoryTreeItem } from '../shared/utils/category-tree'

const categories: CategoryTreeItem[] = [
  { id: 'child', name: '开发者社区', slug: 'community-developers', description: '', parent_id: 'community', sort_order: 2 },
  { id: 'prompts', name: 'AI 提示词', slug: 'prompts', description: '', parent_id: null, sort_order: 3 },
  { id: 'community', name: 'AI 社区', slug: 'community', description: '', parent_id: null, sort_order: 1 },
  { id: 'general', name: '综合交流', slug: 'community-general', description: '', parent_id: 'community', sort_order: 1 },
  { id: 'nested', name: '框架交流', slug: 'frameworks', description: '', parent_id: 'child', sort_order: 1 }
]

test('builds ordered branches regardless of input order without mutating source', () => {
  const original = structuredClone(categories)
  const tree = buildCategoryTree(categories)
  assert.deepEqual(tree.map(node => node.id), ['community', 'prompts'])
  assert.deepEqual(tree[0]!.children.map(node => node.id), ['general', 'child'])
  assert.deepEqual(flattenCategoryTree(tree).map(node => node.id), ['community', 'general', 'child', 'nested', 'prompts'])
  assert.deepEqual(categories, original)
})

test('search retains the ancestor path and excludes unrelated branches', () => {
  const tree = buildCategoryTree(categories)
  const filtered = filterCategoryTree(tree, ' 框架 ')
  assert.deepEqual(flattenCategoryTree(filtered).map(node => node.id), ['community', 'child', 'nested'])
  assert.equal(tree[0]!.children.length, 2)
  assert.deepEqual(filterCategoryTree(tree, 'no-match'), [])
})

test('matching parents retain their subtree and pagination keeps branches together', () => {
  const tree = filterCategoryTree(buildCategoryTree(categories), 'COMMUNITY')
  assert.deepEqual(flattenCategoryTree(tree.slice(0, 1)).map(node => node.id), ['community', 'general', 'child', 'nested'])
  assert.deepEqual(filterCategoryTree(buildCategoryTree(categories), '  '), buildCategoryTree(categories))
})
