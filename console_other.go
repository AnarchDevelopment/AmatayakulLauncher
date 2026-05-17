//go:build !windows
package main

// OpenConsole is a dummy for non-windows platforms
func (a *App) OpenConsole() {
	a.logToFrontend("Debug console is only supported on Windows.", "warn")
}
