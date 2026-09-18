FROM golang:1.25.0-alpine AS build

WORKDIR /foodstream

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o etchebest ./cmd/server/main.go

RUN apk add --no-cache ffmpeg

EXPOSE 8081
EXPOSE 50000-50100/udp

CMD ["./etchebest"]
