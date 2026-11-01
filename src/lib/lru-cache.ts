class LRUNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

export class LRUCache<K, V> {
  private capacity: number
  private cache = new Map<K, LRUNode<K, V>>()
  private head: LRUNode<K, V> | null = null
  private tail: LRUNode<K, V> | null = null

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key)
    if (!node) return undefined

    this.moveToFront(node)
    return node.value
  }

  set(key: K, value: V): void {
    let node = this.cache.get(key)

    if (node) {
      node.value = value
      this.moveToFront(node)
      return
    }

    if (this.cache.size >= this.capacity) {
      this.evictLRU()
    }

    node = new LRUNode(key, value)
    this.cache.set(key, node)
    this.addToFront(node)
  }

  delete(key: K): boolean {
    const node = this.cache.get(key)
    if (!node) return false

    this.removeNode(node)
    this.cache.delete(key)
    return true
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
  }

  size(): number {
    return this.cache.size
  }

  private moveToFront(node: LRUNode<K, V>): void {
    this.removeNode(node)
    this.addToFront(node)
  }

  private addToFront(node: LRUNode<K, V>): void {
    node.next = this.head
    node.prev = null

    if (this.head) {
      this.head.prev = node
    }

    this.head = node

    if (!this.tail) {
      this.tail = node
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }
  }

  private evictLRU(): void {
    if (!this.tail) return

    this.cache.delete(this.tail.key)
    this.removeNode(this.tail)
  }
}
