package main

import (
	"archive/zip"
	"bufio"
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"math"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	discordrpc "github.com/xeyossr/go-discordrpc/client"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend
var assets embed.FS

// Discord Application ID for Amatayakul Launcher
const discordAppID = "1503246619368362094"

const appVersion = "1.1.2"

type AppConfig struct {
	Language             string `json:"language"`
	CustomDLL            string `json:"custom_dll"`
	AutoInject           bool   `json:"auto_inject"`
	InjectCooldown       int    `json:"inject_cooldown"`
	CheckMara            bool   `json:"check_mara"`
	CheckDll             bool   `json:"check_dll"`
	SkipInjectWarning    bool   `json:"skip_inject_warning"`
	ManageVersions       bool   `json:"manage_versions"`
	InstalledAssetVersion string `json:"installed_asset_version"`
	TweaksAutoGap        bool   `json:"tweaks_autogap"`
	TweaksAutoGapIntensity int  `json:"tweaks_autogap_intensity"`
	TweaksFullBright     bool   `json:"tweaks_fullbright"`
	TweaksShaders        bool   `json:"tweaks_shaders"`
}

func getConfigPath() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return ""
	}
	return filepath.Join(appData, "AmatayakulLauncher", "config", "config.json")
}

func loadConfig() AppConfig {
	cfg := AppConfig{
		Language:             "es",
		CustomDLL:            "",
		AutoInject:           false,
		InjectCooldown:       10,
		CheckMara:            true,
		CheckDll:             true,
		SkipInjectWarning:    false,
		ManageVersions:       false,
		InstalledAssetVersion: "",
		TweaksAutoGap:        false,
		TweaksAutoGapIntensity: 32,
		TweaksFullBright:     false,
		TweaksShaders:        false,
	}
	path := getConfigPath()
	if path == "" {
		return cfg
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return cfg
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg
	}
	_ = json.Unmarshal(data, &cfg)
	return cfg
}

func saveConfig(cfg AppConfig) error {
	path := getConfigPath()
	if path == "" {
		return fmt.Errorf("APPDATA not set")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

type App struct {
	ctx          context.Context
	rpcMu        sync.Mutex
	rpcClient    *discordrpc.Client // nil = not connected
	isInjected   bool               // true after a successful injection, reset when process dies
	launchTime   time.Time          // when the launcher started (for RPC timestamp)
	lastPresence string             // "launcher" or "game" to avoid redundant updates
	cancelInject bool               // Flag to cancel injection during cooldown
}

func (a *App) GetConfig() AppConfig {
	return loadConfig()
}

func (a *App) SaveConfig(cfg AppConfig) map[string]interface{} {
	err := saveConfig(cfg)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	return map[string]interface{}{"success": true}
}

func NewApp() *App {
	return &App{launchTime: time.Now()}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Try initial RPC connect; processWatcher will keep retrying if Discord isn't open yet
	a.ensureRPC()
	a.setLauncherPresence()
	go a.processWatcher()
	go a.updateChecker()
}

func (a *App) shutdown(ctx context.Context) {
	a.rpcMu.Lock()
	defer a.rpcMu.Unlock()
	if a.rpcClient != nil {
		_ = a.rpcClient.Logout()
		a.rpcClient = nil
	}
}

// ensureRPC lazily connects to Discord. Safe to call repeatedly; no-ops if already connected.
// Must NOT be called with rpcMu held.
func (a *App) ensureRPC() *discordrpc.Client {
	a.rpcMu.Lock()
	defer a.rpcMu.Unlock()
	if a.rpcClient != nil {
		return a.rpcClient
	}
	runtime.LogDebug(a.ctx, "Attempting Discord RPC Login...")
	c := discordrpc.NewClient(discordAppID)
	if err := c.Login(); err != nil {
		runtime.LogErrorf(a.ctx, "Discord RPC Login failed: %v", err)
		return nil
	}
	runtime.LogInfo(a.ctx, "Discord RPC Connected!")
	a.rpcClient = c
	return a.rpcClient
}

// setLauncherPresence pushes the "idle in launcher" state.
func (a *App) setLauncherPresence() {
	c := a.ensureRPC()
	if c == nil {
		return
	}
	now := a.launchTime
	err := c.SetActivity(discordrpc.Activity{
		Type:       0,
		State:      "Active in launcher",
		Details:    "",
		LargeImage: "logo",
		LargeText:  "Amatayakul",
		Timestamps: &discordrpc.Timestamps{Start: &now},
		Buttons: []*discordrpc.Button{
			{Label: "GitHub", Url: "https://github.com/AnarchDevelopment"},
		},
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "SetActivity (Launcher) failed: %v", err)
		// Pipe went stale — force reconnect next call
		a.rpcMu.Lock()
		a.rpcClient = nil
		a.rpcMu.Unlock()
	} else {
		a.rpcMu.Lock()
		a.lastPresence = "launcher"
		a.rpcMu.Unlock()
	}
}

// setGamePresence pushes the "in-game" state with the player username.
func (a *App) setGamePresence() {
	c := a.ensureRPC()
	if c == nil {
		return
	}
	username := a.readMinecraftUsername()
	state := "User: " + username
	if username == "" {
		state = "In-game"
	}
	now := time.Now()
	err := c.SetActivity(discordrpc.Activity{
		Type:       0,
		State:      state,
		Details:    "Playing 0.15.10",
		LargeImage: "logo",
		LargeText:  "Amatayakul",
		Timestamps: &discordrpc.Timestamps{Start: &now},
		Buttons: []*discordrpc.Button{
			{Label: "GitHub", Url: "https://github.com/AnarchDevelopment"},
		},
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "SetActivity (Game) failed: %v", err)
		a.rpcMu.Lock()
		a.rpcClient = nil
		a.rpcMu.Unlock()
	} else {
		a.rpcMu.Lock()
		a.lastPresence = "game"
		a.rpcMu.Unlock()
	}
}

// processWatcher polls Minecraft every second, emits events to the frontend,
// and keeps the Discord RPC presence refreshed.
func (a *App) processWatcher() {
	for {
		time.Sleep(1 * time.Second)

		running := isMinecraftRunning()

		// Read state under lock
		a.rpcMu.Lock()
		injected := a.isInjected
		last := a.lastPresence
		connected := a.rpcClient != nil
		a.rpcMu.Unlock()

		if running {
			runtime.EventsEmit(a.ctx, "minecraft:running", true)
			if injected && (last != "game" || !connected) {
				a.setGamePresence()
			}
		} else {
			runtime.EventsEmit(a.ctx, "minecraft:running", false)
			if injected {
				// Game exited — clear injection flag
				a.rpcMu.Lock()
				a.isInjected = false
				a.rpcMu.Unlock()
				a.setLauncherPresence()
			} else if last != "launcher" || !connected {
				// Revert to launcher presence if not already set or if disconnected
				a.setLauncherPresence()
			}
		}
	}
}

// IsMinecraftRunning exposes process detection to the frontend
func (a *App) IsMinecraftRunning() bool {
	return isMinecraftRunning()
}

// KillMinecraft terminates Minecraft.Win10.DX11.exe
func (a *App) KillMinecraft() map[string]interface{} {
	cmd := exec.Command("taskkill", "/F", "/IM", "Minecraft.Win10.DX11.exe")
	prepareHiddenCommand(cmd)
	err := cmd.Run()
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	return map[string]interface{}{"success": true}
}

// LaunchMinecraft starts Minecraft.Win10.DX11.exe via explorer shell
func (a *App) LaunchMinecraft() map[string]interface{} {
	launchCmd := exec.Command("explorer.exe", "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App")
	prepareHiddenCommand(launchCmd)
	err := launchCmd.Start()
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	
	// Don't wait for explorer to exit, just return success immediately
	return map[string]interface{}{"success": true}
}

// CancelInjection sets the cancel flag
func (a *App) CancelInjection() {
	a.cancelInject = true
}

// GetMinecraftUsername reads mp_username from Minecraft's options.txt
func (a *App) GetMinecraftUsername() string {
	return a.readMinecraftUsername()
}

// GetAppVersion returns the current launcher version
func (a *App) GetAppVersion() string {
	return appVersion
}

// SetRPCIngame marks the session as injected and immediately pushes game presence.
// processWatcher will continue refreshing it every second.
func (a *App) SetRPCIngame() {
	a.rpcMu.Lock()
	a.isInjected = true
	a.rpcMu.Unlock()
	a.setGamePresence()
}

// SetRPCLauncher clears the injected flag and reverts to launcher presence.
func (a *App) SetRPCLauncher() {
	a.rpcMu.Lock()
	a.isInjected = false
	a.rpcMu.Unlock()
	a.setLauncherPresence()
}

// logToFrontend emits a log event to the frontend and prints to console
func (a *App) logToFrontend(msg string, level string) {
	fmt.Printf("[%s] %s\n", strings.ToUpper(level), msg)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "app:log", msg, level)
	}
}

// --- Helpers ---

func isMinecraftRunning() bool {
	cmd := exec.Command("tasklist", "/FI", "IMAGENAME eq Minecraft.Win10.DX11.exe", "/NH")
	prepareHiddenCommand(cmd)
	out, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(string(out)), strings.ToLower("Minecraft.Win10.DX11.exe"))
}

func (a *App) readMinecraftUsername() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return ""
	}
	optionsPath := filepath.Join(
		localAppData,
		"Packages", "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
		"LocalState", "games", "com.mojang", "minecraftpe", "options.txt",
	)
	f, err := os.Open(optionsPath)
	if err != nil {
		runtime.LogErrorf(a.ctx, "Failed to open options.txt: %v", err)
		return ""
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Handle both mp_username=name and mp_username:name just in case
		if strings.HasPrefix(line, "mp_username=") || strings.HasPrefix(line, "mp_username:") {
			val := ""
			if strings.Contains(line, "=") {
				val = strings.SplitN(line, "=", 2)[1]
			} else {
				val = strings.SplitN(line, ":", 2)[1]
			}
			return strings.TrimSpace(val)
		}
	}
	runtime.LogDebug(a.ctx, "mp_username not found in options.txt")
	return ""
}

func (a *App) GetMinecraftVersion() string {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Get-AppxPackage Microsoft.MinecraftUWP | Select -ExpandProperty Version")
	prepareHiddenCommand(cmd)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// GetMinecraftSkinBase64 reads custom.png and returns it as a base64 string.
func (a *App) GetMinecraftSkinBase64() string {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		fmt.Println("[Skin] LOCALAPPDATA env var not found")
		return ""
	}
	
	// The exact path provided by the user
	skinPath := filepath.Join(
		localAppData,
		"Packages", "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
		"LocalState", "games", "com.mojang", "minecraftpe", "custom.png",
	)
	
	if _, err := os.Stat(skinPath); os.IsNotExist(err) {
		a.logToFrontend(fmt.Sprintf("Skin file not found at: %s", skinPath), "warn")
		
		// Debug: list directory contents
		dir := filepath.Dir(skinPath)
		entries, err := os.ReadDir(dir)
		if err == nil {
			var files []string
			for _, e := range entries {
				files = append(files, e.Name())
			}
			a.logToFrontend(fmt.Sprintf("Contents of %s: %v", dir, files), "info")
		} else {
			a.logToFrontend(fmt.Sprintf("Could not read directory %s: %v", dir, err), "error")
		}
		return ""
	}

	data, err := os.ReadFile(skinPath)
	if err != nil {
		a.logToFrontend(fmt.Sprintf("Failed to read skin: %v", err), "error")
		return ""
	}

	// Validate image
	reader := strings.NewReader(string(data))
	config, _, err := image.DecodeConfig(reader)
	if err != nil {
		a.logToFrontend(fmt.Sprintf("Skin file is not a valid image: %v", err), "error")
		return ""
	}
	
	a.logToFrontend(fmt.Sprintf("Skin loaded: %dx%d, %d bytes", config.Width, config.Height, len(data)), "info")
	
	if config.Width != 64 || (config.Height != 64 && config.Height != 32) {
		a.logToFrontend(fmt.Sprintf("Warning: Skin dimensions (%dx%d) are unusual for Minecraft.", config.Width, config.Height), "warn")
	}

	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}


func (a *App) SelectDLL() string {
	fp, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Custom DLL",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "DLL Files (*.dll)",
				Pattern:     "*.dll",
			},
		},
	})
	if err != nil {
		return ""
	}
	return fp
}

func (a *App) SelectAPK() string {
	fp, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select MCPE 0.15.10 APK",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "APK Files (*.apk)",
				Pattern:     "*.apk",
			},
		},
	})
	if err != nil {
		return ""
	}
	return fp
}

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func (a *App) ensureAssetUpdated(repo string, dest string, versionFile string) error {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)
	resp, err := http.Get(apiURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return err
	}
	if len(release.Assets) == 0 {
		return fmt.Errorf("no assets found in latest release")
	}

	currentVersion := ""
	if _, err := os.Stat(versionFile); err == nil {
		vData, _ := os.ReadFile(versionFile)
		currentVersion = strings.TrimSpace(string(vData))
	}

	// Check if file exists too
	_, fileErr := os.Stat(dest)

	if currentVersion != release.TagName || os.IsNotExist(fileErr) {
		runtime.LogInfof(a.ctx, "Updating asset %s: %s -> %s", filepath.Base(dest), currentVersion, release.TagName)
		
		// If file exists, try to delete it
		if !os.IsNotExist(fileErr) {
			_ = os.Remove(dest)
		}

		// Download
		out, err := os.Create(dest)
		if err != nil {
			return err
		}
		
		dlResp, err := http.Get(release.Assets[0].BrowserDownloadURL)
		if err != nil {
			out.Close()
			return err
		}
		defer dlResp.Body.Close()

		_, err = io.Copy(out, dlResp.Body)
		out.Close() // Close before version write
		if err != nil {
			return err
		}

		// Save version
		_ = os.WriteFile(versionFile, []byte(release.TagName), 0644)
	}

	return nil
}

func (a *App) updateChecker() {
	// Check immediately on start
	a.checkForUpdates()

	// Ensure updater.exe is downloaded and up to date in the background
	go func() {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return
		}
		launcherDir := filepath.Join(appData, "AmatayakulLauncher", "client-sources")
		os.MkdirAll(launcherDir, 0755)
		updaterPath := filepath.Join(launcherDir, "updater.exe")
		updaterVersionPath := filepath.Join(launcherDir, "updater_version.txt")
		if err := a.ensureAssetUpdated("AnarchDevelopment/AmatayakulUpdater", updaterPath, updaterVersionPath); err != nil {
			runtime.LogErrorf(a.ctx, "Failed to check/update updater.exe: %v", err)
		}
	}()

	// Then every 1 minute
	ticker := time.NewTicker(1 * time.Minute)
	for {
		select {
		case <-ticker.C:
			a.checkForUpdates()
		case <-a.ctx.Done():
			return
		}
	}
}

func (a *App) checkForUpdates() {
	url := "https://api.github.com/repos/AnarchDevelopment/AmatayakulLauncher/releases/latest"
	
	// The user asked for POST, but GitHub API uses GET for latest releases.
	// I'll use a Client with a timeout.
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return
	}
	req.Header.Set("User-Agent", "Amatayakul-Launcher")

	resp, err := client.Do(req)
	if err != nil {
		runtime.LogErrorf(a.ctx, "Update check failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var release struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return
	}

	remoteVersion := strings.TrimPrefix(release.TagName, "v")
	if isNewerVersion(appVersion, remoteVersion) {
		downloadUrl := ""
		if len(release.Assets) > 0 {
			downloadUrl = release.Assets[0].BrowserDownloadURL
		}
		runtime.EventsEmit(a.ctx, "update:available", map[string]string{
			"version": remoteVersion,
			"url":     downloadUrl,
		})
	}
}

func (a *App) StartUpdate(downloadUrl string, lang string) map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return map[string]interface{}{"success": false, "error": "APPDATA not found"}
	}

	launcherDir := filepath.Join(appData, "AmatayakulLauncher", "client-sources")
	os.MkdirAll(launcherDir, 0755)

	updaterPath := filepath.Join(launcherDir, "updater.exe")
	updaterVersionPath := filepath.Join(launcherDir, "updater_version.txt")

	// Ensure updater is downloaded and up to date
	if err := a.ensureAssetUpdated("AnarchDevelopment/AmatayakulUpdater", updaterPath, updaterVersionPath); err != nil {
		runtime.LogErrorf(a.ctx, "Failed to download updater: %v", err)
		return map[string]interface{}{"success": false, "error": "Failed to download updater: " + err.Error()}
	}

	exePath, err := os.Executable()
	if err != nil {
		exePath = "AmatayakulLauncher.exe"
	}

	pid := os.Getpid()

	cmd := exec.Command(updaterPath, "-update", "-path", exePath, "-url", downloadUrl, "-pid", fmt.Sprintf("%d", pid), "-lang", lang)
	if err := cmd.Start(); err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to launch updater: " + err.Error()}
	}

	go func() {
		time.Sleep(500 * time.Millisecond)
		os.Exit(0)
	}()

	return map[string]interface{}{"success": true}
}

func isNewerVersion(current, remote string) bool {
	currParts := strings.Split(current, ".")
	remParts := strings.Split(remote, ".")

	for i := 0; i < len(currParts) && i < len(remParts); i++ {
		var c, r int
		fmt.Sscanf(currParts[i], "%d", &c)
		fmt.Sscanf(remParts[i], "%d", &r)

		if r > c {
			return true
		}
		if c > r {
			return false
		}
	}
	return len(remParts) > len(currParts)
}

// PerformInjection downloads mara + DLL if needed, launches Minecraft, and injects.
// When skipLaunch=true it skips launching Minecraft (used for "inject anyways").
func (a *App) PerformInjection(customDll string, skipLaunch bool, checkMara bool, checkDll bool, cooldownVal int) map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return map[string]interface{}{"success": false, "error": "APPDATA not found"}
	}

	launcherDir := filepath.Join(appData, "AmatayakulLauncher", "client-sources")
	os.MkdirAll(launcherDir, 0755)

	maraPath := filepath.Join(launcherDir, "mara.exe")
	maraVersionPath := filepath.Join(launcherDir, "mara_version.txt")
	var dllPath string

	// 1. Check and download mara.exe if missing or update needed
	if checkMara {
		if err := a.ensureAssetUpdated("AnarchDevelopment/MaraInjector", maraPath, maraVersionPath); err != nil {
			runtime.LogErrorf(a.ctx, "Failed to ensure mara injector is updated: %v", err)
			// Fallback: check if it exists at least
			if _, errS := os.Stat(maraPath); os.IsNotExist(errS) {
				return map[string]interface{}{"success": false, "error": "Failed to download mara injector: " + err.Error()}
			}
		}
	} else {
		// Just check if it exists
		if _, err := os.Stat(maraPath); os.IsNotExist(err) {
			return map[string]interface{}{"success": false, "error": "Mara injector not found and auto-check is disabled"}
		}
	}

	// 2. Check and download default DLL if not using custom
	if customDll == "" || customDll == "Default Amatayakul DLL" {
		dllPath = filepath.Join(launcherDir, "amatayakul.dll")
		dllVersionPath := filepath.Join(launcherDir, "dll_version.txt")
		
		if checkDll {
			if err := a.ensureAssetUpdated("AnarchDevelopment/AmatayakulDLL", dllPath, dllVersionPath); err != nil {
				runtime.LogErrorf(a.ctx, "Failed to ensure default DLL is updated: %v", err)
				// Fallback: check if it exists at least
				if _, errS := os.Stat(dllPath); os.IsNotExist(errS) {
					return map[string]interface{}{"success": false, "error": "Failed to download default DLL: " + err.Error()}
				}
			}
		} else {
			// Just check if it exists
			if _, err := os.Stat(dllPath); os.IsNotExist(err) {
				return map[string]interface{}{"success": false, "error": "Default DLL not found and auto-check is disabled"}
			}
		}
	} else {
		dllPath = customDll
	}

	// 3. Launch Minecraft (unless skipping)
	if !skipLaunch {
		launchCmd := exec.Command("explorer.exe", "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App")
		prepareHiddenCommand(launchCmd)
		launchCmd.Start()

		// 4. Wait for Minecraft to start (up to 10s)
		minecraftRunning := false
		for i := 0; i < 10; i++ {
			if isMinecraftRunning() {
				minecraftRunning = true
				break
			}
			time.Sleep(1 * time.Second)
		}
		if !minecraftRunning {
			return map[string]interface{}{"success": false, "error": "Minecraft failed to start in time"}
		}

		// 5. Cooldown instead of pixel detector
		a.cancelInject = false
		for i := cooldownVal; i > 0; i-- {
			if a.cancelInject {
				a.logToFrontend("Injection cancelled.", "info")
				return map[string]interface{}{"success": false, "error": "cancelled"}
			}
			a.logToFrontend(fmt.Sprintf("Waiting for %d seconds before injection...", i), "info")
			time.Sleep(1 * time.Second)
		}
	} else {
        // If skipping launch, wait a small bit just to ensure process is settled
        time.Sleep(2 * time.Second)
    }

	// Bring game to foreground before injecting
	a.logToFrontend("Focusing game window...", "info")
	focusCmd := exec.Command("explorer.exe", "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App")
	prepareHiddenCommand(focusCmd)
	focusCmd.Start()
	time.Sleep(500 * time.Millisecond)

	// Check if game is still running before firing injector
	if !isMinecraftRunning() {
		return map[string]interface{}{"success": false, "error": "process_not_found"}
	}

	a.logToFrontend(fmt.Sprintf("Injecting with Mara: %s", maraPath), "info")
	cmd := exec.Command(maraPath, "Minecraft.Win10.DX11.exe", dllPath)
	prepareHiddenCommand(cmd)
	out, err := cmd.CombinedOutput()
	outputStr := string(out)

	a.logToFrontend(fmt.Sprintf("Mara Output: %s", outputStr), "system")

	success := strings.Contains(strings.ToLower(outputStr), "successfully injected")

	if success {
		a.logToFrontend("Injection successful!", "success")
		runtime.WindowMinimise(a.ctx)
		
		psCommand := `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$xml = @"
<toast>
    <visual>
        <binding template="ToastText02">
            <text id="1">Amatayakul Launcher</text>
            <text id="2">Successfully injected! Launcher is minimized.</text>
        </binding>
    </visual>
</toast>
"@
$xmlDoc = New-Object Windows.Data.Xml.Dom.XmlDocument
$xmlDoc.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Amatayakul").Show($toast)
`
		toastCmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", psCommand)
		prepareHiddenCommand(toastCmd)
		toastCmd.Start()

		// Switch RPC to in-game presence
		a.setGamePresence()
	} else if err != nil {
		a.logToFrontend(fmt.Sprintf("Injection failed: %v", err), "error")
	}

	return map[string]interface{}{
		"success": success,
		"output":  outputStr,
		"error":   fmt.Sprintf("%v", err),
	}
}

// ValidateDLLPath checks whether the given file path exists and ends with .dll.
// Returns true if the path is valid (file exists on disk), false otherwise.
// An empty path (meaning "use default") always returns true.
func (a *App) ValidateDLLPath(path string) bool {
	if path == "" {
		return true
	}
	if !strings.HasSuffix(strings.ToLower(path), ".dll") {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

// LogJS allows the frontend to print messages to the native console
func (a *App) LogJS(msg string, level string) {
	a.logToFrontend(msg, level)
}

// ── Manage Versions / Asset Management ───────────────────────

type AssetRelease struct {
	TagName    string `json:"tag_name"`
	ZipballURL string `json:"zipball_url"`
}

const assetsRepo = "AnarchDevelopment/AmatayakulAssets"
const supportedGameVersion = "0.15.10"

func (a *App) getAssetsDir() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return ""
	}
	return filepath.Join(appData, "AmatayakulLauncher", "Assets")
}

func (a *App) getAssetVersionFilePath() string {
	return filepath.Join(a.getAssetsDir(), "asset_version.txt")
}

func (a *App) getTempAssetsDir() string {
	return filepath.Join(os.Getenv("TEMP"), "AmatayakulAssets")
}

// CheckGameVersionSupported checks if the installed Minecraft version is 0.15.10.
func (a *App) CheckGameVersionSupported() map[string]interface{} {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
		"$pkg = Get-AppxPackage Microsoft.MinecraftUWP; if ($pkg) { $pkg.Version }")
	prepareHiddenCommand(cmd)
	out, err := cmd.Output()
	if err != nil {
		return map[string]interface{}{"supported": false, "not_installed": false, "installed": "", "error": "Failed to detect game version: " + err.Error()}
	}
	installed := strings.TrimSpace(string(out))
	if installed == "" {
		return map[string]interface{}{"supported": false, "not_installed": true, "installed": "", "error": "Minecraft is not installed"}
	}
	// PowerShell returns version like "0.1510.0.0" — check if it starts with the supported version digits
	if strings.HasPrefix(installed, "0.1510") {
		return map[string]interface{}{"supported": true, "not_installed": false, "installed": installed}
	}
	return map[string]interface{}{"supported": false, "not_installed": false, "installed": installed}
}

// GetInstalledAssetVersion returns the currently installed asset version string.
func (a *App) GetInstalledAssetVersion() string {
	path := a.getAssetVersionFilePath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

// GetLatestAssetRelease fetches the latest release tag_name and zipball_url.
func (a *App) GetLatestAssetRelease() map[string]interface{} {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", assetsRepo)
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create request: " + err.Error()}
	}
	req.Header.Set("User-Agent", "Amatayakul-Launcher")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Network error: " + err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("GitHub API returned status %d", resp.StatusCode)}
	}

	var release AssetRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return map[string]interface{}{"success": false, "error": "Invalid JSON response: " + err.Error()}
	}

	if release.TagName == "" {
		return map[string]interface{}{"success": false, "error": "Missing tag_name in release data"}
	}
	if release.ZipballURL == "" {
		return map[string]interface{}{"success": false, "error": "Missing zipball_url in release data"}
	}

	return map[string]interface{}{
		"success":     true,
		"tag_name":    release.TagName,
		"zipball_url": release.ZipballURL,
	}
}

// DownloadAndExtractAssets downloads a ZIP from zipballUrl, extracts to APPDATA Assets dir.
// Emits progress events to the frontend.
func (a *App) DownloadAndExtractAssets(zipballUrl string, tagName string) map[string]interface{} {
	tempDir := a.getTempAssetsDir()
	assetsDir := a.getAssetsDir()

	// Ensure directories exist
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create temp directory: " + err.Error()}
	}
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create assets directory: " + err.Error()}
	}

	zipPath := filepath.Join(tempDir, "assets.zip")

	// ── Download ──
	client := &http.Client{Timeout: 5 * time.Minute}
	req, err := http.NewRequest("GET", zipballUrl, nil)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create download request: " + err.Error()}
	}
	req.Header.Set("User-Agent", "Amatayakul-Launcher")

	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Download failed: " + err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("Download returned status %d", resp.StatusCode)}
	}

	totalSize := resp.ContentLength
	out, err := os.Create(zipPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create temp file: " + err.Error()}
	}

	buf := make([]byte, 32*1024)
	downloaded := int64(0)
	startTime := time.Now()
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			_, writeErr := out.Write(buf[:n])
			if writeErr != nil {
				out.Close()
				os.Remove(zipPath)
				return map[string]interface{}{"success": false, "error": "Failed to write temp file: " + writeErr.Error()}
			}
			downloaded += int64(n)
			elapsed := time.Since(startTime).Seconds()
			speed := 0.0
			if elapsed > 0 {
				speed = (float64(downloaded) / elapsed) * 8 / 1000000 // Mbps
			}
			percentage := 0.0
			if totalSize > 0 {
				percentage = float64(downloaded) / float64(totalSize) * 100
			} else {
				// Unknown total size — show pseudo-progress so the bar moves
				percentage = math.Min(float64(downloaded)/float64(1024*1024)*5, 95)
			}
			runtime.EventsEmit(a.ctx, "asset:download-progress", map[string]interface{}{
				"downloaded": downloaded,
				"total":      totalSize,
				"percentage": percentage,
				"speed":      speed,
			})
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			out.Close()
			os.Remove(zipPath)
			return map[string]interface{}{"success": false, "error": "Download read error: " + readErr.Error()}
		}
	}
	// Emit final 100% so the bar fills
	runtime.EventsEmit(a.ctx, "asset:download-progress", map[string]interface{}{
		"downloaded": downloaded,
		"total":      totalSize,
		"percentage": 100.0,
		"speed":      0.0,
	})
	out.Close()

	// ── Extract ──
	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		os.Remove(zipPath)
		return map[string]interface{}{"success": false, "error": "Failed to open ZIP archive: " + err.Error()}
	}
	defer zipReader.Close()

	// First, clean the assets directory (remove everything except version file)
	entries, _ := os.ReadDir(assetsDir)
	for _, entry := range entries {
		if entry.Name() == "asset_version.txt" {
			continue
		}
		os.RemoveAll(filepath.Join(assetsDir, entry.Name()))
	}

	// Determine the top-level directory name in the zipball (GitHub wraps in a subdir)
	var topDir string
	for _, f := range zipReader.File {
		if f.FileInfo().IsDir() && strings.Count(f.Name, "/") == 1 && !strings.HasPrefix(f.Name, "/") {
			parts := strings.SplitN(f.Name, "/", 2)
			if len(parts) == 2 && parts[1] == "" {
				topDir = parts[0]
			}
		}
		if topDir != "" {
			break
		}
	}

	totalFiles := len(zipReader.File)
	extracted := 0
	extractStart := time.Now()

	for _, f := range zipReader.File {
		// Strip top-level directory from path
		name := f.Name
		if topDir != "" {
			name = strings.TrimPrefix(name, topDir+"/")
		}
		if name == "" {
			continue
		}

		destPath := filepath.Join(assetsDir, name)

		if f.FileInfo().IsDir() {
			os.MkdirAll(destPath, 0755)
		} else {
			os.MkdirAll(filepath.Dir(destPath), 0755)
			rc, err := f.Open()
			if err != nil {
				// Clean up on error
				os.RemoveAll(tempDir)
				return map[string]interface{}{"success": false, "error": "Failed to open ZIP entry: " + err.Error()}
			}
			dst, err := os.Create(destPath)
			if err != nil {
				rc.Close()
				os.RemoveAll(tempDir)
				return map[string]interface{}{"success": false, "error": "Failed to create extracted file: " + err.Error()}
			}
			_, err = io.Copy(dst, rc)
			rc.Close()
			dst.Close()
			if err != nil {
				os.RemoveAll(tempDir)
				return map[string]interface{}{"success": false, "error": "Failed to write extracted file: " + err.Error()}
			}
		}

		extracted++
		elapsed := time.Since(extractStart).Seconds()
		speed := 0.0
		if elapsed > 0 {
			speed = float64(extracted) / elapsed
		}
		runtime.EventsEmit(a.ctx, "asset:extract-progress", map[string]interface{}{
			"extracted":  extracted,
			"total":      totalFiles,
			"percentage": float64(extracted) / float64(totalFiles) * 100,
			"speed":      speed,
		})
	}

	// Save installed version
	os.WriteFile(a.getAssetVersionFilePath(), []byte(tagName), 0644)

	// Clean up temp files
	os.RemoveAll(tempDir)

	return map[string]interface{}{"success": true}
}

var cachedInstallLocation string

func getInstallLocation() (string, error) {
	if cachedInstallLocation != "" {
		return cachedInstallLocation, nil
	}
	cmd := exec.Command("powershell", "-NoProfile", "-Command", "(Get-AppxPackage -Name *MinecraftUWP*).InstallLocation")
	prepareHiddenCommand(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	loc := strings.TrimSpace(string(out))
	if loc != "" {
		cachedInstallLocation = loc
	}
	return loc, nil
}

// IsAppxRegisteredToAssets checks if the installed Minecraft UWP package is pointing to the Assets folder
func (a *App) IsAppxRegisteredToAssets() bool {
	loc, err := getInstallLocation()
	if err != nil || loc == "" {
		return false
	}
	
	assetsDir := a.getAssetsDir()
	if assetsDir == "" {
		return false
	}
	
	locNorm := filepath.Clean(loc)
	assetsNorm := filepath.Clean(assetsDir)
	
	return strings.EqualFold(locNorm, assetsNorm)
}

// RegisterAssetsAppx finds an AppxManifest.xml in the assets dir and registers it.
func (a *App) RegisterAssetsAppx() map[string]interface{} {
	assetsDir := a.getAssetsDir()

	// Search for AppxManifest.xml
	var manifestPath string
	filepath.Walk(assetsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.EqualFold(info.Name(), "AppxManifest.xml") {
			manifestPath = path
			return fmt.Errorf("found") // stop walk
		}
		return nil
	})

	if manifestPath == "" {
		return map[string]interface{}{"success": false, "error": "AppxManifest.xml not found in assets"}
	}

	manifestDir := filepath.Dir(manifestPath)
	a.logToFrontend(fmt.Sprintf("Registering APPX from: %s", manifestDir), "info")

	// Emit step 1 – reading manifest
	runtime.EventsEmit(a.ctx, "asset:register-progress", map[string]interface{}{
		"step": "reading", "percent": 10, "message": "Reading manifest...",
	})

	// Use Add-AppxPackage -Register (the correct standard API).
	// The previous WinRT PackageManager approach polled IAsyncOperation.Status against integer
	// literals, but PowerShell returns enum *names* (e.g. "Canceled"), not integers, so the
	// while-loop exited immediately with status "Canceled" and the registration always failed.
	psCommand := fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$manifest = '%s'

# Read manifest and extract Identity
[xml]$xml = Get-Content -Path $manifest -Raw
$identityNode = $xml.GetElementsByTagName("Identity") | Select-Object -First 1
if (-not $identityNode) {
    Write-Host "ERROR: No Identity element found in manifest"
    exit 1
}
$pkgName = $identityNode.GetAttribute("Name")
$publisher = $identityNode.GetAttribute("Publisher")
Write-Host "Package Name: $pkgName"
Write-Host "Publisher: $publisher"

if (-not $pkgName) {
    Write-Host "ERROR: Package name is empty in manifest"
    exit 1
}

# Remove existing package (preserving app data) so Add-AppxPackage can re-register cleanly
$existing = Get-AppxPackage -Name $pkgName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Found existing package: $($existing.PackageFullName)"
    Write-Host "Removing existing package (preserving app data)..."
    Remove-AppxPackage -Package $existing.PackageFullName -PreserveApplicationData -ErrorAction Stop
    Write-Host "Existing package removed"
    Start-Sleep -Seconds 2
}

# Register from manifest using Add-AppxPackage -Register (reliable on all Windows 10/11)
Write-Host "Registering package from manifest..."
Add-AppxPackage -Register -Path $manifest -ForceApplicationShutdown -ErrorAction Stop
Write-Host "Registration complete"
`, manifestPath)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psCommand)
	prepareHiddenCommand(cmd)

	// Emit "registering" step before the potentially long PS operation
	runtime.EventsEmit(a.ctx, "asset:register-progress", map[string]interface{}{
		"step": "registering", "percent": 50, "message": "Registering package...",
	})

	out, err := cmd.CombinedOutput()
	outputStr := string(out)

	if err != nil {
		a.logToFrontend(fmt.Sprintf("APPX registration failed: %v\nOutput: %s", err, outputStr), "error")
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("%s", outputStr)}
	}

	// Check output for error keywords even if exit code was 0
	lower := strings.ToLower(outputStr)
	if strings.Contains(lower, "error") || strings.Contains(lower, "fail") {
		a.logToFrontend(fmt.Sprintf("APPX registration may have failed:\n%s", outputStr), "error")
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("%s", outputStr)}
	}

	runtime.EventsEmit(a.ctx, "asset:register-progress", map[string]interface{}{
		"step": "complete", "percent": 100, "message": "Registration complete",
	})
	a.logToFrontend(fmt.Sprintf("APPX registration successful: %s", outputStr), "success")
	return map[string]interface{}{"success": true, "output": outputStr}
}

// ExtractTexturePackFromAPK extracts texture pack files from an APK to ImportedPacks folder
func (a *App) ExtractTexturePackFromAPK(apkPath string) map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return map[string]interface{}{"success": false, "error": "APPDATA environment variable not found"}
	}
	baseLauncherDir := filepath.Join(appData, "AmatayakulLauncher")
	importedPacksDir := filepath.Join(baseLauncherDir, "ImportedPacks")

	// The pack name is the APK filename without extension
	fileName := filepath.Base(apkPath)
	packName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	destPackDir := filepath.Join(importedPacksDir, packName)

	// Open APK as ZIP
	r, err := zip.OpenReader(apkPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to open APK as ZIP: " + err.Error()}
	}
	defer r.Close()

	// Check if assets folder exists
	hasAssets := false
	for _, f := range r.File {
		if strings.HasPrefix(f.Name, "assets/") {
			hasAssets = true
			break
		}
	}

	if !hasAssets {
		return map[string]interface{}{"success": false, "error": "Invalid APK package! Failed to extract assets/ folder from apk."}
	}

	// Prepare progress variables
	var filesToExtract []*zip.File
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if !strings.HasPrefix(f.Name, "assets/") {
			continue
		}
		nameStripped := strings.TrimPrefix(f.Name, "assets/")
		
		// We only want resourcepacks/vanilla and images/gui
		if strings.HasPrefix(nameStripped, "resourcepacks/vanilla/") || strings.HasPrefix(nameStripped, "images/gui/") || strings.HasPrefix(nameStripped, "ui/") {
			filesToExtract = append(filesToExtract, f)
		}
	}

	totalFiles := len(filesToExtract)
	extractedFiles := 0
	startTime := time.Now()
	var totalBytes int64 = 0

	for _, f := range filesToExtract {
		nameStripped := strings.TrimPrefix(f.Name, "assets/")
		destPath := filepath.Join(destPackDir, nameStripped)

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			continue
		}
		
		destFile, err := os.Create(destPath)
		if err != nil {
			rc.Close()
			continue
		}

		bytesCopied, err := io.Copy(destFile, rc)
		
		destFile.Close()
		rc.Close()

		if err == nil {
			extractedFiles++
			totalBytes += bytesCopied
		}

		elapsed := time.Since(startTime).Seconds()
		speed := 0.0
		if elapsed > 0 {
			speed = (float64(totalBytes) / elapsed) / (1024 * 1024) // MB/s
		}

		// Throttle events slightly to avoid overwhelming the frontend
		if extractedFiles%10 == 0 || extractedFiles == totalFiles {
			runtime.EventsEmit(a.ctx, "texture:extract-progress", map[string]interface{}{
				"extracted":  extractedFiles,
				"total":      totalFiles,
				"percentage": float64(extractedFiles) / float64(totalFiles) * 100,
				"speed":      speed,
			})
		}
	}

	return map[string]interface{}{"success": true, "packName": packName}
}

func copyFile(src, dst string) (int64, error) {
	sourceFileStat, err := os.Stat(src)
	if err != nil {
		return 0, err
	}
	if !sourceFileStat.Mode().IsRegular() {
		return 0, fmt.Errorf("%s is not a regular file", src)
	}

	source, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer source.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return 0, err
	}

	destination, err := os.Create(dst)
	if err != nil {
		return 0, err
	}
	defer destination.Close()

	nBytes, err := io.Copy(destination, source)
	return nBytes, err
}

// ApplyTexturePack copies a pack from ImportedPacks to Assets/data/ or Install Location and optionally registers the APPX
func (a *App) ApplyTexturePack(packName string, keepMainMenu bool, keepDefaultGui bool, targetInstallLoc bool, applyCustomUI bool) map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return map[string]interface{}{"success": false, "error": "APPDATA environment variable not found"}
	}
	baseLauncherDir := filepath.Join(appData, "AmatayakulLauncher")
	importedPacksDir := filepath.Join(baseLauncherDir, "ImportedPacks")
	srcPackDir := filepath.Join(importedPacksDir, packName)

	var destDataDir string
	if targetInstallLoc {
		loc, err := getInstallLocation()
		if err != nil || loc == "" {
			return map[string]interface{}{"success": false, "error": "Failed to get Minecraft install location: " + err.Error()}
		}
		destDataDir = filepath.Join(loc, "data")
	} else {
		assetsDir := a.getAssetsDir()
		if assetsDir == "" {
			return map[string]interface{}{"success": false, "error": "Assets directory not found"}
		}
		destDataDir = filepath.Join(assetsDir, "data")
	}

	// Find all files in the source pack dir
	var filesToCopy []string
	filepath.Walk(srcPackDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			filesToCopy = append(filesToCopy, path)
		}
		return nil
	})

	totalFiles := len(filesToCopy)
	copiedFiles := 0
	startTime := time.Now()
	var totalBytes int64 = 0

	for _, srcPath := range filesToCopy {
		relPath, err := filepath.Rel(srcPackDir, srcPath)
		if err != nil {
			continue
		}
		
		// Convert path separators to forward slashes for easier comparison
		relPathForward := filepath.ToSlash(relPath)

		// Ignore items.json and hud_screen.json completely
		if strings.HasSuffix(relPathForward, "items.json") || strings.HasSuffix(relPathForward, "hud_screen.json") {
			copiedFiles++
			continue
		}

		// Filtering logic
		if keepMainMenu {
			if relPathForward == "ui/start_screen.json" || relPathForward == "images/gui/titleOriginal.png" {
				copiedFiles++
				continue
			}
		}
		if keepDefaultGui {
			if relPathForward == "images/gui/gui.png" || relPathForward == "images/gui/icons.png" {
				copiedFiles++
				continue
			}
		}

		destPath := filepath.Join(destDataDir, relPath)
		bytesCopied, err := copyFile(srcPath, destPath)
		if err == nil {
			totalBytes += bytesCopied
		}
		copiedFiles++

		elapsed := time.Since(startTime).Seconds()
		speed := 0.0
		if elapsed > 0 {
			speed = (float64(totalBytes) / elapsed) / (1024 * 1024) // MB/s
		}

		if copiedFiles%10 == 0 || copiedFiles == totalFiles {
			runtime.EventsEmit(a.ctx, "texture:import-progress", map[string]interface{}{
				"extracted":  copiedFiles,
				"total":      totalFiles,
				"percentage": float64(copiedFiles) / float64(totalFiles) * 100,
				"speed":      speed,
			})
		}
	}

	if applyCustomUI {
		uiUrl := "https://raw.githubusercontent.com/AnarchDevelopment/AmatayakulAssets/refs/heads/main/data/ui/start_screen.json"
		titleUrl := "https://github.com/AnarchDevelopment/AmatayakulAssets/blob/main/data/images/gui/titleOriginal.png?raw=true"
		
		err := downloadFile(uiUrl, filepath.Join(destDataDir, "ui", "start_screen.json"))
		if err != nil {
			a.logToFrontend("Failed to download custom UI: " + err.Error(), "warn")
		}
		err = downloadFile(titleUrl, filepath.Join(destDataDir, "images", "gui", "titleOriginal.png"))
		if err != nil {
			a.logToFrontend("Failed to download custom title: " + err.Error(), "warn")
		}
	}

	if !targetInstallLoc {
		// Register APPX only if not already pointing to Assets
		if !a.IsAppxRegisteredToAssets() {
			regRes := a.RegisterAssetsAppx()
			if !regRes["success"].(bool) {
				a.logToFrontend(fmt.Sprintf("Failed to register APPX after applying texture pack: %v", regRes["error"]), "warn")
				return map[string]interface{}{"success": false, "error": fmt.Sprintf("Failed to register APPX: %v", regRes["error"])}
			}
		}
	}

	return map[string]interface{}{"success": true}
}

func downloadFile(url string, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}
	os.MkdirAll(filepath.Dir(destPath), 0755)
	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

// GetImportedPacks returns a list of imported packs and their pack_icon (png or jpg) as base64
func (a *App) GetImportedPacks() []map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return []map[string]interface{}{}
	}
	baseLauncherDir := filepath.Join(appData, "AmatayakulLauncher")
	importedPacksDir := filepath.Join(baseLauncherDir, "ImportedPacks")

	var packs []map[string]interface{}
	entries, err := os.ReadDir(importedPacksDir)
	if err != nil {
		return packs
	}

	for _, entry := range entries {
		if entry.IsDir() {
			packName := entry.Name()
			iconBase64 := ""
			
			// Try PNG first
			iconPathPng := filepath.Join(importedPacksDir, packName, "resourcepacks", "vanilla", "pack_icon.png")
			if iconData, err := os.ReadFile(iconPathPng); err == nil {
				iconBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(iconData)
			} else {
				// Fallback to JPG
				iconPathJpg := filepath.Join(importedPacksDir, packName, "resourcepacks", "vanilla", "pack_icon.jpg")
				if iconData, err := os.ReadFile(iconPathJpg); err == nil {
					iconBase64 = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(iconData)
				}
			}
			
			packs = append(packs, map[string]interface{}{
				"name": packName,
				"icon": iconBase64,
			})
		}
	}
	return packs
}

// CheckAssetsExist returns true when %APPDATA%\AmatayakulLauncher\Assets
// exists AND contains at least one entry (i.e. is not an empty directory).
func (a *App) CheckAssetsExist() bool {
	dir := a.getAssetsDir()
	if dir == "" {
		return false
	}
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return false
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	// Ignore the version file when deciding "non-empty"
	for _, e := range entries {
		if e.Name() != "asset_version.txt" {
			return true
		}
	}
	return false
}

// ApplyAutoGap updates use_duration in items.json
func (a *App) ApplyAutoGap(enabled bool, intensity int) map[string]interface{} {
	assetsDir := a.getAssetsDir()
	if assetsDir == "" {
		return map[string]interface{}{"success": false, "error": "Assets directory not found"}
	}
	
	itemsPath := filepath.Join(assetsDir, "data", "resourcepacks", "vanilla", "items.json")
	contentBytes, err := os.ReadFile(itemsPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to read items.json: " + err.Error()}
	}
	
	content := string(contentBytes)
	
	val := 32
	if enabled {
		val = intensity
	}
	
	// Since items.json contains comments, we use regex to replace use_duration for golden_apple and appleEnchanted
	// Regex looks for "name": "..." and then replaces the first "use_duration": \d+ it encounters inside that object.
	
	targets := []string{"golden_apple", "appleEnchanted"}
	
	for _, target := range targets {
		// Pattern: find "name": "target", then anything until "use_duration": (\d+)
		// We use a lazy match to find the nearest use_duration
		pattern := fmt.Sprintf(`("name"\s*:\s*"%s"(?:[\s\S]*?))("use_duration"\s*:\s*)\d+`, target)
		re := regexp.MustCompile(pattern)
		
		content = re.ReplaceAllString(content, fmt.Sprintf(`${1}${2}%d`, val))
	}
	
	err = os.WriteFile(itemsPath, []byte(content), 0644)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to write items.json: " + err.Error()}
	}
	
	return map[string]interface{}{"success": true, "needs_register": true}
}

// ApplyFullBright modifies the options.txt to set max gamma
func (a *App) ApplyFullBright(enabled bool) map[string]interface{} {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return map[string]interface{}{"success": false, "error": "LOCALAPPDATA environment variable not found"}
	}
	
	optionsPath := filepath.Join(localAppData, "Packages", "Microsoft.MinecraftUWP_8wekyb3d8bbwe", "LocalState", "games", "com.mojang", "minecraftpe", "options.txt")
	
	contentBytes, err := os.ReadFile(optionsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]interface{}{"success": false, "error": "options.txt not found. Have you launched the game at least once?"}
		}
		return map[string]interface{}{"success": false, "error": "Failed to read options.txt: " + err.Error()}
	}
	
	content := string(contentBytes)
	val := "1" // Default gamma
	if enabled {
		val = "1500"
	}
	
	re := regexp.MustCompile(`(?m)^gfx_gamma:.*$`)
	if re.MatchString(content) {
		content = re.ReplaceAllString(content, "gfx_gamma:"+val)
	} else {
		if !strings.HasSuffix(content, "\n") && content != "" {
			content += "\n"
		}
		content += "gfx_gamma:" + val + "\n"
	}
	
	err = os.WriteFile(optionsPath, []byte(content), 0644)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to write options.txt: " + err.Error()}
	}
	
	return map[string]interface{}{"success": true}
}

// ApplyShaders clones or removes shaders
func (a *App) ApplyShaders(enabled bool) map[string]interface{} {
	cfg := a.GetConfig()
	destDataDir := ""
	
	if !cfg.ManageVersions {
		loc, err := getInstallLocation()
		if err != nil || loc == "" {
			return map[string]interface{}{"success": false, "error": "Failed to get Minecraft install location: " + err.Error()}
		}
		destDataDir = filepath.Join(loc, "data")
	} else {
		assetsDir := a.getAssetsDir()
		if assetsDir == "" {
			return map[string]interface{}{"success": false, "error": "Assets directory not found"}
		}
		destDataDir = filepath.Join(assetsDir, "data")
	}
	
	shadersDir := filepath.Join(destDataDir, "shaders")
	shadersOldDir := filepath.Join(destDataDir, "shaders.old")
	
	if enabled {
		// Backup original shaders if shaders.old doesn't exist
		if _, err := os.Stat(shadersOldDir); os.IsNotExist(err) {
			if _, err := os.Stat(shadersDir); err == nil {
				os.Rename(shadersDir, shadersOldDir)
			}
		}
		
		os.RemoveAll(shadersDir)
		os.MkdirAll(shadersDir, 0755)
		
		tempZip := filepath.Join(os.TempDir(), "shaders_temp.zip")
		downloadUrl := "https://github.com/AnarchDevelopment/shaders/archive/refs/tags/shaders.zip"
		
		err := downloadFile(downloadUrl, tempZip)
		if err != nil {
			return map[string]interface{}{"success": false, "error": "Failed to download shaders: " + err.Error()}
		}
		defer os.Remove(tempZip)
		
		r, err := zip.OpenReader(tempZip)
		if err != nil {
			return map[string]interface{}{"success": false, "error": "Failed to open zip: " + err.Error()}
		}
		defer r.Close()

		for _, f := range r.File {
			parts := strings.Split(f.Name, "/")
			if len(parts) <= 1 {
				continue // skip root folder itself
			}
			
			relPath := strings.Join(parts[1:], string(filepath.Separator))
			if relPath == "" {
				continue 
			}
			
			fpath := filepath.Join(shadersDir, relPath)
			
			if f.FileInfo().IsDir() {
				os.MkdirAll(fpath, 0755)
				continue
			}

			os.MkdirAll(filepath.Dir(fpath), 0755)
			
			outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				return map[string]interface{}{"success": false, "error": "Failed to extract file: " + err.Error()}
			}
			
			rc, err := f.Open()
			if err != nil {
				outFile.Close()
				return map[string]interface{}{"success": false, "error": "Failed to read zip file: " + err.Error()}
			}
			
			_, err = io.Copy(outFile, rc)
			
			outFile.Close()
			rc.Close()
			
			if err != nil {
				return map[string]interface{}{"success": false, "error": "Failed to write extracted file: " + err.Error()}
			}
		}
	} else {
		// Disabling shaders: restore shaders.old to shaders
		if _, err := os.Stat(shadersOldDir); err == nil {
			os.RemoveAll(shadersDir)
			err = os.Rename(shadersOldDir, shadersDir)
			if err != nil {
				return map[string]interface{}{"success": false, "error": "Failed to restore original shaders: " + err.Error()}
			}
		}
	}
	
	return map[string]interface{}{"success": true, "needs_register": cfg.ManageVersions}
}

// SaveInstalledAssetVersion persists the installed asset version to disk.
func (a *App) SaveInstalledAssetVersion(version string) map[string]interface{} {
	path := a.getAssetVersionFilePath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to create assets directory: " + err.Error()}
	}
	if err := os.WriteFile(path, []byte(version), 0644); err != nil {
		return map[string]interface{}{"success": false, "error": "Failed to save version file: " + err.Error()}
	}
	return map[string]interface{}{"success": true}
}

func main() {
	isDebug := false
	for _, arg := range os.Args {
		lowerArg := strings.ToLower(arg)
		if lowerArg == "-v" || lowerArg == "-version" || lowerArg == "--version" {
			AttachConsole()
			fmt.Println(appVersion)
			os.Exit(0)
		}
		if lowerArg == "-debug" || lowerArg == "--debug" {
			isDebug = true
		}
	}

	app := NewApp()
	if isDebug {
		app.OpenConsole()
	}

	var webviewUserDataPath string
	if appData := os.Getenv("APPDATA"); appData != "" {
		// Save webview things at AmatayakulLauncher/WebView2
		webviewDir := filepath.Join(appData, "AmatayakulLauncher", "WebView2")
		_ = os.MkdirAll(webviewDir, 0755)
		webviewUserDataPath = webviewDir

		// Ensure config directory exists
		configDir := filepath.Join(appData, "AmatayakulLauncher", "config")
		_ = os.MkdirAll(configDir, 0755)
	}

	err := wails.Run(&options.App{
		Title:     "Amatayakul Launcher",
		Width:     900,
		Height:    600,
		WindowStartState: options.Maximised,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 5, G: 5, B: 5, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			BackdropType:         windows.Mica,
			DisableWindowIcon:    false,
			WebviewUserDataPath:  webviewUserDataPath,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
