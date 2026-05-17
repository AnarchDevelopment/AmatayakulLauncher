//go:build windows
package main

import (
	"fmt"
	"os"
	"syscall"
	"time"
)

var (
	consoleAllocated = false
	consoleHidden    = false
	ctrlHandlerPtr   uintptr
	consoleKernel32  = syscall.NewLazyDLL("kernel32.dll")
	consoleUser32    = syscall.NewLazyDLL("user32.dll")
)

func (a *App) OpenConsole() {
	if consoleAllocated {
		if consoleHidden {
			procGetConsoleWindow := consoleKernel32.NewProc("GetConsoleWindow")
			procShowWindow := consoleUser32.NewProc("ShowWindow")
			hwnd, _, _ := procGetConsoleWindow.Call()
			if hwnd != 0 {
				procShowWindow.Call(hwnd, 5) // SW_SHOW
				consoleHidden = false
				a.logToFrontend("Debug console restored.", "info")
			}
		}
		return
	}

	procAllocConsole := consoleKernel32.NewProc("AllocConsole")
	r, _, _ := procAllocConsole.Call()
	if r == 0 {
		return
	}

	consoleAllocated = true

	// Set control handler
	procSetConsoleCtrlHandler := consoleKernel32.NewProc("SetConsoleCtrlHandler")
	procGetConsoleWindow := consoleKernel32.NewProc("GetConsoleWindow")
	procShowWindow := consoleUser32.NewProc("ShowWindow")
	procFreeConsole := consoleKernel32.NewProc("FreeConsole")
	
	handler := func(ctrlType uintptr) uintptr {
		if ctrlType == 2 { // CTRL_CLOSE_EVENT
			hwnd, _, _ := procGetConsoleWindow.Call()
			if hwnd != 0 {
				procShowWindow.Call(hwnd, 0) // SW_HIDE
				consoleHidden = true
				return 1 // Handled
			}
			// Fallback if hwnd failed
			procFreeConsole.Call()
			consoleAllocated = false
			return 1
		}
		return 0
	}
	
	ctrlHandlerPtr = syscall.NewCallback(handler)
	procSetConsoleCtrlHandler.Call(ctrlHandlerPtr, 1)

	// Redirect
	stdout, _ := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE)
	os.Stdout = os.NewFile(uintptr(stdout), "/dev/stdout")
	stderr, _ := syscall.GetStdHandle(syscall.STD_ERROR_HANDLE)
	os.Stderr = os.NewFile(uintptr(stderr), "/dev/stderr")
	stdin, _ := syscall.GetStdHandle(syscall.STD_INPUT_HANDLE)
	os.Stdin = os.NewFile(uintptr(stdin), "/dev/stdin")

	fmt.Println("====================================================")
	fmt.Println("         AMATAYAKUL LAUNCHER DEBUG CONSOLE          ")
	fmt.Println("====================================================")
	fmt.Println("Launcher Version:", appVersion)
	fmt.Println("Time:", time.Now().Format(time.RFC1123))
	fmt.Println("Status: DEBUG MODE ACTIVE")
	fmt.Println("----------------------------------------------------")
	
	a.logToFrontend("Native console opened successfully.", "info")
}
