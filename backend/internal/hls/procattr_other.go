//go:build !linux

package hls

import "os/exec"

func setProcAttr(cmd *exec.Cmd) {}

func startCommand(cmd *exec.Cmd) error { return cmd.Start() }
