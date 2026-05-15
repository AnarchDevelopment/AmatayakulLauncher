package main

import (
	"bufio"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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

// Current launcher version
const appVersion = "1.0.2"

type App struct {
	ctx          context.Context
	rpcMu        sync.Mutex
	rpcClient    *discordrpc.Client // nil = not connected
	isInjected   bool               // true after a successful injection, reset when process dies
	launchTime   time.Time          // when the launcher started (for RPC timestamp)
	lastPresence string             // "launcher" or "game" to avoid redundant updates
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

// --- Helpers ---

func isMinecraftRunning() bool {
	cmd := exec.Command("tasklist", "/FI", "IMAGENAME eq Minecraft.Win10.DX11.exe", "/NH")
	prepareHiddenCommand(cmd)
	out, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "Minecraft.Win10.DX11.exe")
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

type GitHubRelease struct {
	Assets []struct {
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func downloadGitHubReleaseAsset(repo string, dest string) error {
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

	downloadURL := release.Assets[0].BrowserDownloadURL
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	dlResp, err := http.Get(downloadURL)
	if err != nil {
		return err
	}
	defer dlResp.Body.Close()

	_, err = io.Copy(out, dlResp.Body)
	return err
}

func (a *App) updateChecker() {
	// Check immediately on start
	a.checkForUpdates()

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
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return
	}

	remoteVersion := strings.TrimPrefix(release.TagName, "v")
	if isNewerVersion(appVersion, remoteVersion) {
		runtime.EventsEmit(a.ctx, "update:available", remoteVersion)
	}
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
func (a *App) PerformInjection(customDll string, skipLaunch bool) map[string]interface{} {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return map[string]interface{}{"success": false, "error": "APPDATA not found"}
	}

	launcherDir := filepath.Join(appData, "AmatayakulLauncher", "client-sources")
	os.MkdirAll(launcherDir, 0755)

	maraPath := filepath.Join(launcherDir, "mara.exe")
	var dllPath string

	// 1. Check and download mara.exe if missing
	if _, err := os.Stat(maraPath); os.IsNotExist(err) {
		err := downloadGitHubReleaseAsset("AnarchDevelopment/MaraInjector", maraPath)
		if err != nil {
			return map[string]interface{}{"success": false, "error": "Failed to download mara injector: " + err.Error()}
		}
	}

	// 2. Check and download default DLL if not using custom
	if customDll == "" || customDll == "Default Amatayakul DLL" {
		dllPath = filepath.Join(launcherDir, "amatayakul.dll")
		if _, err := os.Stat(dllPath); os.IsNotExist(err) {
			err := downloadGitHubReleaseAsset("AnarchDevelopment/AmatayakulDLL", dllPath)
			if err != nil {
				return map[string]interface{}{"success": false, "error": "Failed to download default DLL: " + err.Error()}
			}
		}
	} else {
		dllPath = customDll
	}

	// 3. Launch Minecraft (unless skipping)
	if !skipLaunch {
		launchCmd := exec.Command("explorer.exe", "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App")
		prepareHiddenCommand(launchCmd)
		launchCmd.Run()

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

		// 5. Wait 1 second before injecting
		time.Sleep(1 * time.Second)
	}

	// Set ACL permissions for UWP
	icaclsCmd := exec.Command("icacls.exe", dllPath, "/grant", "*S-1-15-2-1:(RX)")
	prepareHiddenCommand(icaclsCmd)
	icaclsCmd.Run()

	cmd := exec.Command(maraPath, "Minecraft.Win10.DX11.exe", dllPath)
	prepareHiddenCommand(cmd)
	out, err := cmd.CombinedOutput()

	success := strings.Contains(strings.ToLower(string(out)), "successfully injected")

	if success {
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
	}

	return map[string]interface{}{
		"success": success,
		"output":  string(out),
		"error":   fmt.Sprintf("%v", err),
	}
}

func main() {
	// Check for version flag
	for _, arg := range os.Args {
		lowerArg := strings.ToLower(arg)
		if lowerArg == "-v" || lowerArg == "-version" || lowerArg == "--version" {
			// In Windows GUI mode, we must attach to the parent console to show output
			AttachConsole()
			fmt.Println(appVersion)
			os.Exit(1)
		}
	}

	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "Amatayakul Launcher",
		Width:     900,
		Height:    600,
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
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
