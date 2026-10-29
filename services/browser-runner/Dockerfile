FROM node:22.22.3-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright-core install --with-deps chromium && chmod -R a+rX /root/.cache/ms-playwright && mv /root/.cache/ms-playwright /ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright NODE_ENV=production
COPY *.mjs viewer.* ./
RUN groupadd --gid 10001 soma && useradd --uid 10001 --gid soma --create-home soma
USER 10001:10001
EXPOSE 8080
CMD ["node","main.mjs"]
