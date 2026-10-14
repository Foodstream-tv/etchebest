FROM golang:1.25.0-alpine AS build

WORKDIR /foodstream

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o etchebest ./cmd/server/main.go

RUN apk add --no-cache ffmpeg mailcap

# Live HLS, replays and uploads all live under one volume (/foodstream/data) so they survive container
# recreation, and so that moving a finished live from ./hls to ./storage/replays is an instant rename
# on the same filesystem instead of a multi-GB copy. The app keeps using ./hls and ./storage.
RUN mkdir -p /foodstream/data/hls /foodstream/data/storage/uploads /foodstream/data/storage/replays \
    && rm -rf /foodstream/hls /foodstream/storage \
    && ln -s /foodstream/data/hls /foodstream/hls \
    && ln -s /foodstream/data/storage /foodstream/storage

EXPOSE 8081
EXPOSE 50000-50100/udp

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${BACKEND_PORT:-8081}/" || exit 1

CMD ["./etchebest"]
