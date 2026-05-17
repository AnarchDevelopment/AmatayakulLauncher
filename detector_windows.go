//go:build windows
// +build windows

package main

import (
	"syscall"
)

// This file used to contain the pixel detection logic for the loading screen.
// Since we now use a configurable cooldown, the detection logic has been removed.
// We keep the file and the user32 declaration if other windows-specific 
// detection logic is needed in the future.

var (
	user32_detector = syscall.NewLazyDLL("user32.dll")
	procFindWindowW = user32_detector.NewProc("FindWindowW")
)
