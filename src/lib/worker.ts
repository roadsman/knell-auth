import { parentPort, workerData } from 'worker_threads'
import { hashPassword as _hashPassword } from './crypto.js'

if (parentPort) {
  parentPort.on('message', async (data: { password: string; id: number }) => {
    const hash = await _hashPassword(data.password)
    parentPort!.postMessage({ hash, id: data.id })
  })
}
