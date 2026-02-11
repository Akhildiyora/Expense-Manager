import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { createServer } from 'node:net'

const app = new Hono()

// Function to find an available port
function findAvailablePort(startPort: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort)
      })
    })

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })
  })
}

// Middleware
app.use('*', cors())

// Minimal API just to confirm backend is alive
app.get('/', (c) => {
  return c.json({
    message: 'Expense Tracker Backend',
    title:
      'Frontend talks directly to Supabase for auth and data. This backend is available for future extensions (reports, integrations, etc.).',
    status: 'running',
  })
})

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource was not found',
    },
    404,
  )
})

// Error handler
app.onError((err, c) => {
  console.error(err)
  return c.json(
    {
      success: false,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    },
    500,
  )
})

// Start server with automatic port finding
findAvailablePort(3000)
  .then((port) => {
    console.log(`🚀 Backend is running on http://localhost:${port}`)

    serve({
      fetch: app.fetch,
      port,
    })
  })
  .catch((err) => {
    console.error('Failed to find available port:', err)
  })
