FROM node:20-slim
WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# คัดลอกซอร์สทั้งหมดแล้ว build (frontend -> dist/ , server -> dist/server.cjs)
COPY . .
RUN npm run build

ENV NODE_ENV=production
# โฮสต์ส่วนใหญ่ (Cloud Run/Render/Railway) จะ inject ตัวแปร PORT เข้ามาเอง
# เซิร์ฟเวอร์อ่านจาก process.env.PORT อยู่แล้ว
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
