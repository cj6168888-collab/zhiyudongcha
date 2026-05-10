import { Router, Request, Response } from 'express'
import { attachCSRFToken, getCSRFToken, CSRF_HEADER_NAME } from '../middleware/csrf-protection'

const router = Router()

router.get('/csrf-token', attachCSRFToken, (req: Request, res: Response) => {
  const token = getCSRFToken(req)
  
  if (!token) {
    res.status(500).json({ error: 'Failed to generate CSRF token' })
    return
  }

  res.json({
    token,
    headerName: CSRF_HEADER_NAME
  })
})

export default router
