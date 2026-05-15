import '@testing-library/jest-dom'

// Patch Reflect.construct so that vi.fn(() => ...) mocks created with arrow-function factories
// can be used as class constructors (new MockedClass()). Arrow functions cannot normally be
// passed to Reflect.construct, but many vi.mock factories use arrow functions for simplicity.
// When Reflect.construct fails with "is not a constructor", we fall back to calling the factory
// as a plain function and returning its result, which is the intended mock-factory pattern.
;(function () {
  const _origConstruct = Reflect.construct
  ;(Reflect as typeof Reflect).construct = function <T>(
    target: Function,
    args: ArrayLike<unknown>,
    newTarget?: Function,
  ): T {
    try {
      return _origConstruct.call(Reflect, target, args, newTarget as unknown as Function) as T
    } catch (e) {
      if (e instanceof TypeError && (e as TypeError).message.includes('is not a constructor')) {
        return (target as (...a: unknown[]) => T)(...Array.from(args))
      }
      throw e
    }
  }
})()

// Patch Request.prototype.formData to handle jsdom's broken multipart serialization.
// jsdom's Blob/File objects don't stream bytes through Node's internal undici multipart encoder,
// so `req.formData()` throws a WebIDL assertion error in tests that pass FormData as body.
// This polyfill pre-clones the body, attempts the native parser, and falls back to a manual
// multipart text parser when the native one throws.
if (typeof Request !== 'undefined') {
  const _origFormData = Request.prototype.formData

  function _parseMultipart(text: string, boundary: string): FormData {
    const fd = new FormData()
    const parts = text.split('--' + boundary)
    for (const part of parts) {
      if (!part || part.trim() === '--' || part.trim() === '') continue
      const headerEnd = part.indexOf('\r\n\r\n')
      if (headerEnd === -1) continue
      const headers = part.substring(0, headerEnd)
      const body = part.substring(headerEnd + 4).replace(/\r\n$/, '')
      const nameMatch = headers.match(/name="([^"]+)"/)
      if (!nameMatch) continue
      const name = nameMatch[1]
      const filenameMatch = headers.match(/filename="([^"]*)"/)
      if (filenameMatch !== null) {
        const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/)
        const ct = ctMatch?.[1]?.trim() ?? 'application/octet-stream'
        const bytes = body ? new TextEncoder().encode(body) : new Uint8Array(0)
        fd.append(name, new Blob([bytes], { type: ct }), filenameMatch[1] || 'file')
      } else {
        fd.append(name, body)
      }
    }
    return fd
  }

  Object.defineProperty(Request.prototype, 'formData', {
    value: async function (this: Request) {
      const ct = this.headers.get('content-type') ?? ''
      const m = ct.match(/boundary=([^\s;]+)/)
      if (m && ct.includes('multipart/form-data')) {
        const clone = this.clone()
        const text = await clone.text()
        try {
          return await _origFormData.call(this)
        } catch {
          return _parseMultipart(text, m[1])
        }
      }
      return _origFormData.call(this)
    },
    writable: true,
    configurable: true,
  })
}
