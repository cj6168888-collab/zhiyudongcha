import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const CSRF_TOKEN_LENGTH = 32
const CSRF_HEADER_NAME = 'x-csrf-token'

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string
    userRole?: 'MASTER' | 'GUEST'
    authenticatedAt?: number
    /** 绑定到业务用户 UUID 时，合并加载 USER 主体授权（见 effective-grants） */
    userId?: string
    username?: string
  }
}

export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

export function attachCSRFToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    next()
    return
  }

  const shouldSave = !req.session.csrfToken
  if (shouldSave) {
    req.session.csrfToken = generateCSRFToken()
  }

  res.locals.csrfToken = req.session.csrfToken
  if (shouldSave && typeof req.session.save === 'function') {
    req.session.save((error) => {
      if (error) {
        next(error)
        return
      }
      next()
    })
    return
  }

  next()
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']

  if (safeMethods.includes(req.method)) {
    next()
    return
  }

  if (!req.session) {
    res.status(500).json({ error: 'Session not available' })
    return
  }

  const tokenFromHeader = req.headers[CSRF_HEADER_NAME] as string | undefined
  const tokenFromBody = req.body?._csrf as string | undefined
  const providedToken = tokenFromHeader || tokenFromBody

  if (!providedToken) {
    res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    })
    return
  }

  if (!req.session.csrfToken || providedToken !== req.session.csrfToken) {
    res.status(403).json({
      error: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH'
    })
    return
  }

  next()
}

export function getCSRFToken(req: Request): string | undefined {
  return req.session?.csrfToken || req.res?.locals?.csrfToken
}

export { CSRF_HEADER_NAME }
