FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# 只安装可选的生产依赖（pg / redis / S3 SDK）。
# 不配置这些适配层时，应用本身仍然可以零依赖运行。
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/data && chown -R node:node /app

USER node
ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
