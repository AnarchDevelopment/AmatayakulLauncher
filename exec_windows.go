//go:build windows

package main

import (
	"os"
	"os/exec"
	"syscall"
)

func prepareHiddenCommand(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
}

func AttachConsole() {
	// ATTACH_PARENT_PROCESS = -1
	_, _, _ = syscall.NewLazyDLL("kernel32.dll").NewProc("AttachConsole").Call(uintptr(0xFFFFFFFF))

	// Re-assign standard handles so Go's os.Stdout/os.Stderr point to the newly attached console
	if h, err := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE); err == nil {
		os.Stdout = os.NewFile(uintptr(h), "/dev/stdout")
	}
	if h, err := syscall.GetStdHandle(syscall.STD_ERROR_HANDLE); err == nil {
		os.Stderr = os.NewFile(uintptr(h), "/dev/stderr")
	}
}
