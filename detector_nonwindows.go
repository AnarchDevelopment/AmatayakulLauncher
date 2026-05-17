//go:build !windows
// +build !windows

package main

import (
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) waitForMinecraftLoadingScreen() {
	runtime.LogInfo(a.ctx, "Not on Windows, skipping loading screen detection. State: Loaded.")
	runtime.EventsEmit(a.ctx, "injection:status", "Loaded")
	time.Sleep(1 * time.Second)
}
