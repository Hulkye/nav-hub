import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, digest] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !digest || !/^[a-f0-9]{128}$/.test(digest)) {
    throw new Error('Invalid administrator password hash')
  }
  const actual = await scrypt(password, salt, 64) as Buffer
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'))
}
