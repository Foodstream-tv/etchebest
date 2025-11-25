FROM golang:1.24.6-alpine AS build

WORKDIR /foodstream

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN go build -o etchebest

EXPOSE 8080

CMD ["./etchebest"]
