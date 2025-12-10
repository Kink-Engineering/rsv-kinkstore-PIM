import fs from 'fs'
import path from 'path'

declare global {
  // eslint-disable-next-line no-var
  var __consolePatched: boolean | undefined
}

if (typeof window === 'undefined' && !global.__consolePatched) {
  const logDir = path.join(process.cwd(), 'logs')
  const logPath = path.join(logDir, 'app.log')

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const stream = fs.createWriteStream(logPath, { flags: 'a' })
  const methods: Array<keyof Console> = ['log', 'info', 'warn', 'error', 'debug']

  methods.forEach((method) => {
    const original = console[method] as (...args: any[]) => void
    console[method] = (...args: any[]) => {
      try {
        const line = `[${new Date().toISOString()}] [${method.toUpperCase()}] ${args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ')}\n`
        stream.write(line)
      } catch {
        // swallow logging errors
      }
      original(...args)
    }
  })

  global.__consolePatched = true
}

