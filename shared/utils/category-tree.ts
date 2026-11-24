export type CategoryTreeItem = {
  id: string
  name: string
  slug: string
  description: string
  parent_id: string | null
  sort_order: number
  icon_name?: string | null
}

export type CategoryNode = CategoryTreeItem & { children: CategoryNode[] }

export function buildCategoryTree(categories: CategoryTreeItem[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map(category => [category.id, { ...category, children: [] }]))
  const roots: CategoryNode[] = []
  const ordered = [...nodes.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  for (const node of ordered) {
    const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function filterCategoryTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const search = query.trim().toLowerCase()
  if (!search) return nodes
  return nodes.flatMap(node => {
    if ([node.name, node.slug, node.description].some(value => value.toLowerCase().includes(search))) return [node]
    const children = filterCategoryTree(node.children, search)
    return children.length ? [{ ...node, children }] : []
  })
}

export function flattenCategoryTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap(node => [node, ...flattenCategoryTree(node.children)])
}
