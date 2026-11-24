import { spawn } from 'node:child_process'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databaseUrl = process.env.DATABASE_URL
const outputDir = resolve(process.env.BACKUP_DIR || join(projectRoot, 'backups'))
const retention = Number(process.env.BACKUP_RETENTION ?? 14)

if (!databaseUrl) throw new Error('DATABASE_URL must be set')
if (!Number.isInteger(retention) || retention < 1 || retention > 3650) {
  throw new Error('BACKUP_RETENTION must be an integer between 1 and 3650')
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} failed (${signal || code})`))
    })
  })
}

await mkdir(outputDir, { recursive: true, mode: 0o700 })
const timestamp = new Date()
  .toISOString()
  .replaceAll(':', '')
  .replaceAll('-', '')
  .replace(/\.\d{3}Z$/, 'Z')
const backupPath = join(outputDir, `navhub-${timestamp}.dump`)
const partialPath = `${backupPath}.partial`

try {
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', partialPath], {
    env: { ...process.env, PGDATABASE: databaseUrl }
  })
  await run('pg_restore', ['--list', partialPath], { stdio: ['ignore', 'ignore', 'inherit'] })
  const backupStat = await stat(partialPath)
  if (backupStat.size === 0) throw new Error('pg_dump produced an empty backup')
  await rename(partialPath, backupPath)

  const backups = (await readdir(outputDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /^navhub-\d{8}T\d{6}Z\.dump$/.test(entry.name))
    .map(entry => entry.name)
    .sort()
  for (const oldBackup of backups.slice(0, Math.max(0, backups.length - retention))) {
    await rm(join(outputDir, oldBackup))
  }
  console.log(`Backup verified: ${backupPath} (${backupStat.size} bytes)`)
} catch (error) {
  await rm(partialPath, { force: true })
  throw error
}
