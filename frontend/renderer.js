document.addEventListener('DOMContentLoaded', () => {
    // Initial Splash Transition (Fail-safe)
    const splash = document.getElementById('loadingSplash');
    const hideSplash = () => {
        if (splash && !splash.classList.contains('fade-out')) {
            splash.classList.add('fade-out');
        }
    };
    setTimeout(hideSplash, 2500); // Fail-safe after 2.5 seconds

    const btnLaunch = document.getElementById('btnLaunch');
    const btnSettings = document.getElementById('btnSettings');
    const btnMinimize = document.getElementById('btnMinimize');
    const btnMaximize = document.getElementById('btnMaximize');
    const btnClose = document.getElementById('btnClose');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const btnBrowse = document.getElementById('btnBrowse');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const btnResetSettings = document.getElementById('btnResetSettings');
    const customDllPath = document.getElementById('customDllPath');
    const versionText = document.getElementById('versionText');
    const statusDot = document.getElementById('statusDot');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const statusMessage = document.getElementById('statusMessage');

    const REQUIRED_VERSION = '0.1510.0.0';
    let isValidVersion = false;
    let isLaunching = false;

    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }

    function updateProgress(percent, text) {
        progressContainer.style.display = 'block';
        progressFill.style.width = `${percent}%`;
        progressText.textContent = text;
    }

    function hideProgress() {
        progressContainer.style.display = 'none';
    }

    async function checkMinecraftVersion() {
        try {
            console.log("Checking version...");
            const version = await window.go.main.App.GetMinecraftVersion();
            
            if (!version) {
                versionText.textContent = 'Minecraft UWP not found';
                statusDot.className = 'status-dot invalid';
                isValidVersion = false;
                btnLaunch.disabled = true;
                showStatus('Minecraft UWP is not installed', 'error');
                return false;
            }

            if (version.includes(REQUIRED_VERSION)) {
                versionText.textContent = `Minecraft 0.15.10 - Ready`;
                statusDot.className = 'status-dot valid';
                isValidVersion = true;
                btnLaunch.disabled = false;
                showStatus('', 'success');
                return true;
            } else {
                versionText.textContent = `Minecraft ${version} - Unsupported version!`;
                statusDot.className = 'status-dot invalid';
                isValidVersion = false;
                btnLaunch.disabled = true;
                showStatus(`Required version: ${REQUIRED_VERSION}`, 'error');
                return false;
            }
        } catch(e) {
            console.error("Init Error:", e);
            versionText.textContent = "Minecraft not detected (Bridge Error)";
            statusDot.className = 'status-dot invalid';
            return false;
        }
    }

    async function launchGame() {
        if (isLaunching || !isValidVersion) return;
        isLaunching = true;
        btnLaunch.disabled = true;

        try {
            updateProgress(40, 'Preparing Injection...');
            showStatus('Injecting DLL into Minecraft...', 'info');

            const dllValue = customDllPath ? customDllPath.value.trim() : "";
            const result = await window.go.main.App.PerformInjection(dllValue);
            
            if (result.success) {
                updateProgress(100, 'Injection complete!');
                showStatus('Successfully injected! Enjoy Amatayakul!', 'success');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw new Error(result.error || 'Injection failed');
            }
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            hideProgress();
            isLaunching = false;
            btnLaunch.disabled = !isValidVersion;
        }
    }

    function openSettings() {
        settingsModal.classList.add('active');
    }

    function closeSettingsModal() {
        settingsModal.classList.remove('active');
    }

    btnLaunch.addEventListener('click', launchGame);
    btnSettings.addEventListener('click', openSettings);
    
    // Wails Window Controls
    if (btnMinimize) btnMinimize.addEventListener('click', () => window.runtime.WindowMinimize());
    if (btnMaximize) btnMaximize.addEventListener('click', () => {
        window.runtime.WindowIsMaximised().then(isMax => {
            if (isMax) {
                window.runtime.WindowUnmaximise();
            } else {
                window.runtime.WindowMaximise();
            }
        });
    });
    if (btnClose) btnClose.addEventListener('click', () => window.runtime.Quit());

    if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
    if (settingsModal) settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // Settings Logic
    const savedDll = localStorage.getItem('amatayakul_custom_dll');
    if (savedDll) {
        customDllPath.value = savedDll;
    }

    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            try {
                const filepath = await window.go.main.App.SelectDLL();
                if (filepath) {
                    customDllPath.value = filepath;
                }
            } catch (e) {
                console.error("Failed to select DLL:", e);
            }
        });
    }

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const val = customDllPath.value.trim();
            if (val) {
                localStorage.setItem('amatayakul_custom_dll', val);
            } else {
                localStorage.removeItem('amatayakul_custom_dll');
            }
            closeSettingsModal();
        });
    }

    if (btnResetSettings) {
        btnResetSettings.addEventListener('click', () => {
            customDllPath.value = '';
            localStorage.removeItem('amatayakul_custom_dll');
        });
    }

    // Cinematic Disturbance Effect
    setInterval(() => {
        if (Math.random() > 0.96) {
            document.body.classList.add("flicker");
            setTimeout(() => {
                document.body.classList.remove("flicker");
            }, 120);
        }
    }, 2000);

    // Initial Check
    setTimeout(checkMinecraftVersion, 500);
});
