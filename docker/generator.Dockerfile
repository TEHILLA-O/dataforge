FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENTRYPOINT ["npx", "ts-node", "--prefer-ts-exts", "cli/dataforge/src/index.ts", "generate"]
