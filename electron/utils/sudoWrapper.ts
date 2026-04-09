import sudo from 'sudo-prompt'

export function runAsAdmin(command: string, options?: { name?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    sudo.exec(command, { name: options?.name || 'OneConfig' }, (error) => {
      if (error) return reject(error)
      resolve()
    })
  })
}
