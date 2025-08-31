FROM golang:1.24.6-alpine

WORKDIR /zeb

COPY go.sum go.mod

RUN go download

COPY . .

RUN go build -o ramsay

EXPOSE 8081

CMD ["./ramsay"]
