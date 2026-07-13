# Render.com blueprint — deploy frontend + backend เป็นบริการเดียว
# อย่าลืมตั้ง Environment Variables: SUPABASE_URL, SUPABASE_SERVICE_KEY
services:
  - type: web
    name: thamc-e-material-v2
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
