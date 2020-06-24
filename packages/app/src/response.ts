import { ServerResponse } from 'http'
import encodeUrl from 'encodeurl'
import { sign } from '@tinyhttp/cookie-signature'
import mime from 'mime'
import cookie, { SerializeOptions } from '@tinyhttp/cookie'
import { setCharset, createETag } from './utils/response'
import { Request } from './request'
import { App } from './app'

export const json = (_req: Request, res: Response) => (body: any, ...args: any[]): Response => {
  res.setHeader('Content-Type', 'application/json')
  if (typeof body === 'object' && body != 'null') {
    res.end(JSON.stringify(body, null, 2), ...args)
  } else if (typeof body === 'string') {
    res.end(body, ...args)
  }

  return res
}

export const send = (req: Request, res: Response) => (body: any): Response => {
  let bodyToSend = body

  // in case of object - turn it to json
  if (typeof body === 'object' && body !== 'null') {
    bodyToSend = JSON.stringify(body, null, 2)
  } else {
    if (typeof body === 'string') {
      // reflect this in content-type
      const type = res.getHeader('Content-Type')
      if (typeof type === 'string') {
        res.setHeader('Content-Type', setCharset(type, 'utf-8'))
      }
    }
  }

  // Set encoding
  let encoding: 'utf8' | undefined = 'utf8'

  // populate ETag
  let etag: string | undefined
  if (!res.getHeader('etag') && (etag = createETag(bodyToSend, encoding))) {
    res.setHeader('etag', etag)
  }

  // strip irrelevant headers
  if (res.statusCode === 204 || res.statusCode === 304) {
    res.removeHeader('Content-Type')
    res.removeHeader('Content-Length')
    res.removeHeader('Transfer-Encoding')
    bodyToSend = ''
  }

  if (req.method === 'HEAD') {
    res.end('')
  }

  if (typeof body === 'object') {
    if (body === null) {
      res.end('')
    } else if (Buffer.isBuffer(body)) {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('content-type', 'application/octet-stream')
      }
    } else {
      encoding ? json(req, res)(bodyToSend, encoding) : json(req, res)(bodyToSend)
    }
  } else {
    if (encoding) {
      // respond with encoding
      res.end(bodyToSend, encoding)
    } else {
      // respond without encoding
      res.end(bodyToSend)
    }
  }

  return res
}

export const status = (_req: Request, res: Response) => (status: number): Response => {
  res.statusCode = status

  return res
}

export const setCookie = (req: Request, res: Response) => (
  name: string,
  value: string | object,
  options?: SerializeOptions &
    Partial<{
      signed: boolean
    }>
): Response => {
  const secret = req.secret as string

  const signed = options.signed

  if (signed && !secret) {
    throw new Error('cookieParser("secret") required for signed cookies')
  }

  let val = typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value)

  if (signed) {
    val = 's:' + sign(val, secret)
  }

  if (options.maxAge) {
    options.expires = new Date(Date.now() + options.maxAge)
    options.maxAge /= 1000
  }

  if (options.path == null) {
    options.path = '/'
  }

  res.setHeader('Set-Cookie', cookie.serialize(name, String(val), options))

  return res
}

export const clearCookie = (req: Request, res: Response) => (name: string, options?: SerializeOptions): Response => {
  const opts = Object.assign({}, { expires: new Date(1), path: '/' }, options)

  return setCookie(req, res)(name, '', opts)
}

const charsetRegExp = /;\s*charset\s*=/

export const setHeader = (_req: Request, res: Response) => (field: string | object, val: string | any[]) => {
  if (typeof field === 'string') {
    let value = Array.isArray(val) ? val.map(String) : String(val)

    // add charset to content-type
    if (field.toLowerCase() === 'content-type') {
      if (Array.isArray(value)) {
        throw new TypeError('Content-Type cannot be set to an Array')
      }
      if (!charsetRegExp.test(value)) {
        const charset = mime.getType(value.split(';')[0])
        if (charset) value += '; charset=' + charset.toLowerCase()
      }
    }

    res.setHeader(field, value)
  } else {
    for (const key in field) {
      res.setHeader(key, field[key])
    }
  }
  return res
}

export const setLocationHeader = (req: Request, res: Response) => (url: string) => {
  let loc = url

  // "back" is an alias for the referrer
  if (url === 'back') {
    loc = (req.get('Referrer') as string) || '/'
  }

  // set location
  return res.setHeader('Location', encodeUrl(loc))
}

export interface Response extends ServerResponse {
  app: App
  header(field: string | object, val: string | any[]): Response
  set(field: string | object, val: string | any[]): Response
  send(body: unknown): Response
  json(body: unknown): Response
  status(status: number): Response
  cookie(name: string, value: string | object, options?: SerializeOptions & Partial<{ signed: boolean }>): Response
  clearCookie(name: string, options?: SerializeOptions): Response
  location(url: string): Response
}