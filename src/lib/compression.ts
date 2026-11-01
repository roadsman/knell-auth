import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export async function compress(data: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(data, 'utf-8'))
}

export async function decompress(data: Buffer): Promise<string> {
  const buffer = await gunzipAsync(data)
  return buffer.toString('utf-8')
}

export function shouldCompress(data: string): boolean {
  return data.length > 1024
}
