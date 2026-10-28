FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY eleventy.config.js ./
COPY lib ./lib
COPY src ./src
# Self-hosted at the root of its own domain, unlike the GitHub Pages build.
ARG PATH_PREFIX=/
ENV PATH_PREFIX=${PATH_PREFIX}
RUN bunx --bun eleventy

FROM busybox:stable-musl
COPY --from=build /app/_site /www
USER 10001:10001
EXPOSE 8080
# -f foreground, -v log requests to stderr, no config needed.
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/www"]
