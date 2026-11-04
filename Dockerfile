FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY cli/package.json cli/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN cd .output/server && node -e "require('better-sqlite3')(':memory:').prepare('SELECT 1').get()"

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output .output
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.CHARTROOM_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
