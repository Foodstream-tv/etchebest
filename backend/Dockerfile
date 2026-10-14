FROM golang:1.25.0-alpine AS build

WORKDIR /foodstream

# System packages and the data layout rarely change: keep them *before* the sources so that editing Go
# code does not reinstall ffmpeg on every rebuild.
RUN apk add --no-cache ffmpeg mailcap

# Live HLS, replays and uploads all live under one volume (/foodstream/data) so they survive container
# recreation, and so that moving a finished live from ./hls to ./storage/replays is an instant rename
# on the same filesystem instead of a multi-GB copy. The app keeps using ./hls and ./storage.
RUN mkdir -p /foodstream/data/hls /foodstream/data/storage/uploads /foodstream/data/storage/replays \
    && ln -s /foodstream/data/hls /foodstream/hls \
    && ln -s /foodstream/data/storage /foodstream/storage

COPY go.mod go.sum ./

# BuildKit cache mounts keep the module download and the compiler cache between builds: only the
# packages that changed are recompiled.
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o etchebest ./cmd/server/main.go

EXPOSE 8081
EXPOSE 50000-50100/udp

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${BACKEND_PORT:-8081}/" || exit 1

CMD ["./etchebest"]
