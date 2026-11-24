import { spawn } from 'node:child_process'

const mode = process.argv[2]
if (!['dev', 'start'].includes(mode)) throw new Error('Expected dev or start')
const children = ['api', 'admin', 'app'].map((name, index) =>
  spawn('npm', ['run', mode, '--workspace', `@navhub/${name}`], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String([3002, 3001, 3000][index]), NITRO_PORT: String([3002, 3001, 3000][index]) }
  })
)
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
for (const child of children) {
  child.on('error', error => {
    console.error(error)
    stop(1)
  })
  child.on('exit', code => stop(code ?? 1))
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
