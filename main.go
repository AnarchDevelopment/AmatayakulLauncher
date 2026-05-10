package main

import (
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
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend
var assets embed.FS

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
	filepath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
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
	return filepath
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

func (a *App) PerformInjection(customDll string) map[string]interface{} {
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
		err := downloadGitHubReleaseAsset("Aztral-Network/MaraInjector", maraPath)
		if err != nil {
			return map[string]interface{}{"success": false, "error": "Failed to download mara injector: " + err.Error()}
		}
	}

	// 2. Check and download default DLL if not using custom
	if customDll == "" || customDll == "Default Amatayakul DLL" {
		dllPath = filepath.Join(launcherDir, "amatayakul.dll")
		if _, err := os.Stat(dllPath); os.IsNotExist(err) {
			err := downloadGitHubReleaseAsset("Aztral-Network/AmatayakulDLL", dllPath)
			if err != nil {
				return map[string]interface{}{"success": false, "error": "Failed to download default DLL: " + err.Error()}
			}
		}
	} else {
		dllPath = customDll
	}

	// 3. Launch Minecraft
	launchCmd := exec.Command("explorer.exe", "shell:AppsFolder\\Microsoft.MinecraftUWP_8wekyb3d8bbwe!App")
	prepareHiddenCommand(launchCmd)
	launchCmd.Run()

	// 4. Wait for Minecraft to start
	minecraftRunning := false
	for i := 0; i < 10; i++ {
		cmd := exec.Command("tasklist")
		prepareHiddenCommand(cmd)
		out, _ := cmd.Output()
		if strings.Contains(string(out), "Minecraft.Win10.DX11.exe") {
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
	}
	
	return map[string]interface{}{
		"success": success,
		"output":  string(out),
		"error":   fmt.Sprintf("%v", err),
	}
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "Amatayakul Launcher",
		Width:  900,
		Height: 600,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 5, G: 5, B: 5, A: 1},
		OnStartup:        app.startup,
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
