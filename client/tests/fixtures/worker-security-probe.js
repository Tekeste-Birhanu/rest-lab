self.addEventListener('message', () => {
  let evalResult
  try {
    evalResult = new Function('return 42')()
  } catch (error) {
    self.postMessage({ type: 'eval', error: error.message })
    return
  }

  const reportNestedWorker = (blocked) => self.postMessage({ type: 'nested-worker', blocked })
  try {
    const nested = new Worker('/restlab-worker.js')
    nested.addEventListener('error', () => reportNestedWorker(true), { once: true })
    nested.addEventListener('message', () => reportNestedWorker(false), { once: true })
    setTimeout(() => {
      nested.terminate()
      reportNestedWorker(false)
    }, 1000)
  } catch {
    reportNestedWorker(true)
  }

  const xhr = new XMLHttpRequest()
  xhr.open('GET', `${self.location.origin}/api/snippets`)
  xhr.onload = () => self.postMessage({ type: 'network', allowed: true })
  xhr.onerror = () => self.postMessage({ type: 'network', allowed: false })
  try {
    xhr.send()
  } catch {
    self.postMessage({ type: 'network', allowed: false })
  }
  self.postMessage({ type: 'eval', value: evalResult })
})

