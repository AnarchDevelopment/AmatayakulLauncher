//go:build !windows

package main

import (
	"os/exec"
)

func prepareHiddenCommand(cmd *exec.Cmd) {
	// Do nothing on non-Windows platforms
}

func AttachConsole() {
	// No-op
}
