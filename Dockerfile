FROM oven/bun
WORKDIR /app
COPY . .
RUN bun install
VOLUME /app/configs
ENTRYPOINT bun run .
# Test