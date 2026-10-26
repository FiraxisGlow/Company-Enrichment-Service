import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { InputError, matchCsv } from './matchCompanies.js'
import { toCompanyRecord } from './companyMapping.js'

const app = express()

const UPLOAD_DEADLINE_MS = 240000 // 4 minutes; the proxy gives up at 5

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
})

app.post('/api/companies/match', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Upload a CSV file in the form field 'file'" })
    return
  }
  // Stop calling PRH if the client goes away or the upload runs too long
  const disconnected = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) disconnected.abort()
  })
  const signal = AbortSignal.any([disconnected.signal, AbortSignal.timeout(UPLOAD_DEADLINE_MS)])
  try {
    const { matches, errors } = await matchCsv(req.file.buffer, signal)
    res.json({
      total: matches.length + errors.length,
      matchedCount: matches.length,
      errorCount: errors.length,
      matches,
      companies: matches.map(toCompanyRecord),
      errors,
    })
  } catch (err) {
    if (err instanceof InputError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Matching failed' })
  }
})

// Must come after the routes
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT) || 5000
app.listen(port, () => console.log(`API on ${port}`))
