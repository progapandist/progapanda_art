# syntax = docker/dockerfile:1

ARG RUBY_VERSION=3.4.4
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim AS base

WORKDIR /rails

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"

# Build stage
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential curl git libyaml-dev pkg-config unzip

ENV BUN_INSTALL=/usr/local/bun
ENV PATH=/usr/local/bun/bin:$PATH
ARG BUN_VERSION=1.1.0
RUN curl -fsSL https://bun.sh/install | bash -s -- "bun-v${BUN_VERSION}"

COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile --trace

# Final stage
FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libsqlite3-0 libyaml-0-2 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

USER root:root

RUN chown -R root:root /rails && \
    mkdir -p /rails/art_sources /rails/storage && \
    chown -R root:root /rails/art_sources /rails/storage

ENTRYPOINT ["/rails/bin/docker-entrypoint"]

EXPOSE 3000
CMD ["./bin/rails", "server"]
