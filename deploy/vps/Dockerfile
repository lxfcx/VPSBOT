FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN node vps/build.mjs
FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist-vps ./
# Git checkout/cp can preserve 0600 files and 0700 directories from the
# installer's umask 077. Runtime code stays root-owned but readable by node.
RUN find /app -type d -exec chmod 0755 {} + && find /app -type f -exec chmod 0644 {} +
RUN mkdir /data && chown node:node /data && chmod 0700 /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
