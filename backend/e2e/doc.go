// Package e2e holds end-to-end tests of lives against the backend started by docker compose. They are
// behind the e2e build tag, so that `go test ./...` and the CI never run them:
//
//	make up && make seed
//	go test -tags e2e -v -count=1 ./e2e/
package e2e
