# Build from repository services/ so shared browser/state modules keep imports.
FROM node:22.22.3-bookworm-slim
WORKDIR /app/credential-runner
COPY credential-runner/package.json credential-runner/package-lock.json ./
RUN npm ci --omit=dev && npx playwright-core install --with-deps chromium && chmod -R a+rX /root/.cache/ms-playwright && mv /root/.cache/ms-playwright /ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright NODE_ENV=production
COPY credential-runner/*.mjs credential-runner/login.* credential-runner/mfa.js ./
COPY browser-runner/engine.mjs browser-runner/state.mjs browser-runner/egress.mjs /app/browser-runner/
# Share pinned runtime modules without duplicating any general-runner server.
RUN ln -s /app/credential-runner/node_modules /app/browser-runner/node_modules && groupadd --gid 10001 soma && useradd --uid 10001 --gid soma --create-home soma
USER 10001:10001
EXPOSE 8080
CMD ["node","main.mjs"]
