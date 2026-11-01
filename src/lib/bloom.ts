export class BloomFilter {
  private bits: Uint8Array
  private size: number
  private hashCount: number

  constructor(expectedItems: number = 10000, falsePositiveRate: number = 0.01) {
    this.size = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2)
    )
    this.hashCount = Math.ceil((this.size / expectedItems) * Math.log(2))
    this.bits = new Uint8Array(Math.ceil(this.size / 8))
  }

  private hash(value: string, seed: number): number {
    let hash = seed
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash) % this.size
  }

  add(value: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(value, i)
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      this.bits[byteIndex] |= 1 << bitIndex
    }
  }

  has(value: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(value, i)
      const byteIndex = Math.floor(index / 8)
      const bitIndex = index % 8
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false
      }
    }
    return true
  }

  clear(): void {
    this.bits.fill(0)
  }
}

export const blockedIpFilter = new BloomFilter(100000, 0.001)
export const commonPasswordFilter = new BloomFilter(50000, 0.001)
