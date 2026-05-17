document.addEventListener('DOMContentLoaded', () => {
    // ── Splash ─────────────────────────────────────────────
    const splash = document.getElementById('loadingSplash');
    const hideSplash = () => {
        if (splash && !splash.classList.contains('fade-out')) {
            splash.classList.add('fade-out');
        }
    };
    setTimeout(hideSplash, 2500);

    // ── Element Refs ────────────────────────────────────────
    const btnLaunch          = document.getElementById('btnLaunch');
    const btnCancelLaunch    = document.getElementById('btnCancelLaunch');
    const btnLaunchTitle     = btnLaunch ? btnLaunch.querySelector('.launch-title') : null;
    const btnLaunchSub       = btnLaunch ? btnLaunch.querySelector('.launch-subtitle') : null;
    const btnKill            = document.getElementById('btnKill');
    const btnSettings        = document.getElementById('btnSettings');
    const btnMinimize        = document.getElementById('btnMinimize');
    const btnMaximize        = document.getElementById('btnMaximize');
    const btnClose           = document.getElementById('btnClose');
    const settingsModal      = document.getElementById('settingsModal');
    const closeSettings      = document.getElementById('closeSettings');
    const btnBrowse          = document.getElementById('btnBrowse');
    const btnSaveSettings    = document.getElementById('btnSaveSettings');
    const btnResetSettings   = document.getElementById('btnResetSettings');
    const customDllPath      = document.getElementById('customDllPath');
    const versionText        = document.getElementById('versionText');
    const statusDot          = document.getElementById('statusDot');
    const progressContainer  = document.getElementById('progressContainer');
    const progressFill       = document.getElementById('progressFill');
    const progressText       = document.getElementById('progressText');
    const statusMessage      = document.getElementById('statusMessage');
    const playerNameDisplay  = document.getElementById('playerNameDisplay');
    const skinContainer      = document.getElementById('skinContainer');

    // Debug Console
    const consoleModal       = document.getElementById('consoleModal');
    const closeConsole       = document.getElementById('closeConsole');
    const btnOpenConsole     = document.getElementById('btnOpenConsole');
    const btnClearConsole    = document.getElementById('btnClearConsole');
    const consoleLogContainer = document.getElementById('consoleLogContainer');

    // Kill confirm
    const killConfirmModal   = document.getElementById('killConfirmModal');
    const btnConfirmKill     = document.getElementById('btnConfirmKill');
    const btnCancelKill      = document.getElementById('btnCancelKill');
    
    // Auto inject refs
    const autoInjectToggle   = document.getElementById('autoInjectToggle');
    const injectCooldown     = document.getElementById('injectCooldown');
    const autoInjectOptions  = document.getElementById('autoInjectOptions');

    if (autoInjectToggle && autoInjectOptions) {
        autoInjectToggle.addEventListener('change', () => {
            if (autoInjectToggle.checked) autoInjectOptions.classList.add('active');
            else autoInjectOptions.classList.remove('active');
        });
    }

    // Game detected popup
    const gameDetectedModal  = document.getElementById('gameDetectedModal');
    const btnInjectAnyways   = document.getElementById('btnInjectAnyways');
    const btnRestartAndInject = document.getElementById('btnRestartAndInject');
    
    // Manual Inject Warning
    const manualInjectModal  = document.getElementById('manualInjectModal');
    const btnContinueInject  = document.getElementById('btnContinueInject');
    const btnWaitInject      = document.getElementById('btnWaitInject');
    const skipInjectWarning  = document.getElementById('skipInjectWarning');
    
    const newVersionTag      = document.getElementById('newVersionTag');
    
    // Update checker refs
    const btnExpandUpdates   = document.getElementById('btnExpandUpdates');
    const updateCheckerField = document.getElementById('updateCheckerField');
    const checkMaraUpdate    = document.getElementById('checkMaraUpdate');
    const checkDllUpdate     = document.getElementById('checkDllUpdate');
    const languageSelect     = document.getElementById('languageSelect');
    
    // ── State ───────────────────────────────────────────────
    const REQUIRED_VERSION = '0.1510.0.0';
    let isValidVersion = true;
    let isLaunching    = false;
    let isInjected     = false;
    let manualLaunchWaiting = false;
    let launchBlocker = false; // Prevents process watcher from resetting state during startup

    // ── Internationalization (i18n) ─────────────────────────
    const translations = {
        es: {
            nav_dashboard: "PANEL",
            nav_settings: "AJUSTES",
            btn_enter: "INYECTAR",
            btn_enter_sub: " ",
            btn_manual_launch: "JUGAR",
            btn_manual_launch_sub: " ",
            btn_ready_inject: "¿INYECTAR AHORA?",
            btn_ready_inject_sub: "JUEGO DETECTADO",
            btn_kill: "CERRAR",
            btn_kill_sub: "CERRAR MINECRAFT",
            btn_cancel: "CANCELAR",
            settings_title: "Ajustes",
            settings_language: "Idioma",
            settings_auto_inject: "Inyección Automática",
            settings_cooldown: "Tiempo de espera (s)",
            settings_cooldown_warn: "No recomendado para PCs lentos, use solo si su PC carga el juego en menos de 10 segundos, o establezca un tiempo personalizado para asegurar la estabilidad.",
            settings_payload: "Carga Inyectada",
            settings_browse: "Examinar",
            settings_payload_info: "Seleccione una DLL personalizada para inyectar en Minecraft.",
            settings_update_checker: "Comprobador de Actualizaciones",
            settings_check_mara: "Verificar Mara Injector",
            settings_check_dll: "Verificar Amatayakul DLL",
            settings_update_info: "Alternar actualizaciones automáticas para componentes principales.",
            settings_save: "Guardar Cambios",
            settings_reset: "Restablecer por Defecto",
            kill_title: "Confirmar Cierre",
            kill_desc: "¿Estás seguro? Cerrar el proceso del juego puede causar <strong>pérdida de progreso</strong>.",
            kill_confirm: "Cerrar Juego",
            kill_cancel: "Cancelar",
            detected_title: "Juego Detectado",
            detected_desc: "Proceso del juego detectado y listo para inyectar. Pero recomendamos iniciar el juego a través del lanzador.",
            detected_restart: "↺ Reiniciar e inyectar",
            detected_recommended: "Recomendado",
            detected_inject_anyways: "Inyectar de todos modos",
            warning_title: "Nota",
            warning_desc: "Solo haz clic en \"inyectar\" después de que el juego haya cargado completamente en el menú principal. ¿Continuar?",
            warning_wait: "Esperar",
            warning_continue: "Continuar",
            warning_never_show: "No volver a mostrar esto",
            status_ready: "LISTO",
            status_running: "EN EJECUCIÓN",
            status_injecting: "INYECTANDO...",
            status_injected: "INYECTADO",
            status_ready_launch: "Listo para iniciar",
            status_unsupported: "¡Versión no soportada!",
            status_required: "Versión requerida",
            process_error_title: "Error",
            process_error_desc: "¡El proceso de Minecraft se ha cerrado externamente debido a un bloqueo o cierre manual!<br>¿Quieres intentarlo de nuevo?",
            btn_retry: "Reintentar",
            "Launching Minecraft...": "Iniciando Minecraft...",
            "Game opened. Click Inject to load DLL.": "Juego abierto. Haz clic en Inyectar para cargar la DLL.",
            "Killing existing process...": "Cerrando proceso existente...",
            "Restarting Minecraft...": "Reiniciando Minecraft...",
            "Relaunching Minecraft...": "Reiniciando Minecraft...",
            "Initializing injection...": "Inicializando inyección...",
            "Preparing injector...": "Preparando inyector...",
            "Preparing Injection...": "Preparando Inyección...",
            "Injecting DLL into Minecraft...": "Inyectando DLL en Minecraft...",
            "Injection complete!": "¡Inyección completa!",
            "Injection cancelled": "Inyección cancelada",
            "Injection cancelled.": "Inyección cancelada.",
            "Minecraft process not found": "Proceso de Minecraft no encontrado",
            "Focusing game window...": "Enfocando ventana del juego...",
            "Injection successful!": "¡Inyección exitosa!"
        },
        en: {
            nav_dashboard: "DASHBOARD",
            nav_settings: "SETTINGS",
            btn_enter: "INJECT",
            btn_enter_sub: " ",
            btn_manual_launch: "LAUNCH",
            btn_manual_launch_sub: " ",
            btn_ready_inject: "INJECT NOW?",
            btn_ready_inject_sub: "GAME DETECTED",
            btn_kill: "KILL",
            btn_kill_sub: "TERMINATE MINECRAFT",
            btn_cancel: "CANCEL",
            settings_title: "Settings",
            settings_language: "Language",
            settings_auto_inject: "Auto Inject",
            settings_cooldown: "Injection Cooldown (s)",
            settings_cooldown_warn: "Not recommended for slower PCs, only use if your pc loads the game faster than 10 seconds, or set a custom cooldown matching your PC's loading speed to ensure stability.",
            settings_payload: "Injected Payload",
            settings_browse: "Browse",
            settings_payload_info: "Select a custom DLL to inject into Minecraft.",
            settings_update_checker: "Update Checker",
            settings_check_mara: "Check for Mara Injector",
            settings_check_dll: "Check for Amatayakul DLL",
            settings_update_info: "Toggle automatic updates for core components.",
            settings_save: "Save Changes",
            settings_reset: "Reset to Default",
            kill_title: "Confirm Kill",
            kill_desc: "Are you sure? Killing the game process can cause <strong>progress loss</strong>.",
            kill_confirm: "Kill Game",
            kill_cancel: "Cancel",
            detected_title: "Game Detected",
            detected_desc: "Game process detected and ready to inject. But we recommend you to launch the game via the launcher.",
            detected_restart: "↺ Restart and inject",
            detected_recommended: "Recommended",
            detected_inject_anyways: "Inject anyways",
            warning_title: "Note",
            warning_desc: "Only click \"inject\" after the game already fully loaded to the main menu. Continue?",
            warning_wait: "Wait",
            warning_continue: "Continue",
            warning_never_show: "Never show this again",
            status_ready: "READY",
            status_running: "RUNNING",
            status_injecting: "INJECTING...",
            status_injected: "INJECTED",
            status_ready_launch: "Ready to launch",
            status_unsupported: "Unsupported version!",
            status_required: "Required version",
            process_error_title: "Error",
            process_error_desc: "Minecraft process has been closed externally due to a crash or manual closing!<br>Do you want to try again?",
            btn_retry: "Retry"
        },
        pt: {
            nav_dashboard: "PAINEL",
            nav_settings: "CONFIGURAÇÕES",
            btn_enter: "INJETAR",
            btn_enter_sub: " ",
            btn_manual_launch: "JOGAR",
            btn_manual_launch_sub: " ",
            btn_ready_inject: "INJETAR AGORA?",
            btn_ready_inject_sub: "JOGO DETECTADO",
            btn_kill: "FECHAR",
            btn_kill_sub: "FECHAR MINECRAFT",
            btn_cancel: "CANCELAR",
            settings_title: "Configurações",
            settings_language: "Idioma",
            settings_auto_inject: "Injeção Automática",
            settings_cooldown: "Tempo de espera (s)",
            settings_cooldown_warn: "Não recomendado para PCs lentos, use apenas se o seu PC carregar o jogo em menos de 10 segundos, ou defina um tempo personalizado para garantir a estabilidade.",
            settings_payload: "Carga Injetada",
            settings_browse: "Procurar",
            settings_payload_info: "Selecione uma DLL personalizada para injetar no Minecraft.",
            settings_update_checker: "Verificador de Atualizações",
            settings_check_mara: "Verificar Mara Injector",
            settings_check_dll: "Verificar Amatayakul DLL",
            settings_update_info: "Alternar atualizações automáticas para componentes principais.",
            settings_save: "Salvar Alterações",
            settings_reset: "Restaurar Padrões",
            kill_title: "Confirmar Encerramento",
            kill_desc: "Tem certeza? Encerrar o processo do jogo pode causar <strong>perda de progresso</strong>.",
            kill_confirm: "Encerrar Jogo",
            kill_cancel: "Cancelar",
            detected_title: "Jogo Detectado",
            detected_desc: "Processo do jogo detectado e pronto para injetar. Mas recomendamos iniciar o jogo através do iniciador.",
            detected_restart: "↺ Reiniciar e injetar",
            detected_recommended: "Recomendado",
            detected_inject_anyways: "Injetar de todos modos",
            warning_title: "Nota",
            warning_desc: "Só clique em \"injetar\" depois que o jogo já tiver carregado totalmente no menu principal. Continuar?",
            warning_wait: "Esperar",
            warning_continue: "Continuar",
            warning_never_show: "Não mostrar isso novamente",
            status_ready: "PRONTO",
            status_running: "EM EXECUÇÃO",
            status_injecting: "INJETANDO...",
            status_injected: "INJETADO",
            status_ready_launch: "Pronto para iniciar",
            status_unsupported: "Versão não suportada!",
            status_required: "Versão necessária",
            process_error_title: "Erro",
            process_error_desc: "O processo do Minecraft foi fechado externamente devido a um travamento ou fechamento manual!<br>Deseja tentar novamente?",
            btn_retry: "Tentar novamente",
            "Launching Minecraft...": "Iniciando Minecraft...",
            "Game opened. Click Inject to load DLL.": "Jogo aberto. Clique em Injetar para carregar a DLL.",
            "Killing existing process...": "Encerrando processo existente...",
            "Restarting Minecraft...": "Reiniciando Minecraft...",
            "Relaunching Minecraft...": "Reiniciando Minecraft...",
            "Initializing injection...": "Inicializando injeção...",
            "Preparing injector...": "Preparando injetor...",
            "Preparing Injection...": "Preparando Injeção...",
            "Injecting DLL into Minecraft...": "Injetando DLL no Minecraft...",
            "Injection complete!": "Injeção concluída!",
            "Injection cancelled": "Injeção cancelada",
            "Injection cancelled.": "Injeção cancelada.",
            "Minecraft process not found": "Processo do Minecraft não encontrado",
            "Focusing game window...": "Focando janela do jogo...",
            "Injection successful!": "Injeção bem sucedida!"
        }
    };

    function getTranslation(key) {
        const lang = localStorage.getItem('amatayakul_language') || 'en';
        const dict = translations[lang] || translations['en'];
        let trans = dict[key] || key;
        
        // Handle dynamic backend messages
        if (key.startsWith("Waiting for ") && key.includes(" seconds before injection...")) {
            const secs = key.replace(/[^0-9]/g, '');
            if (lang === 'es') trans = `Esperando ${secs} segundos antes de la inyección...`;
            else if (lang === 'pt') trans = `Esperando ${secs} segundos antes da injeção...`;
        } else if (key.startsWith("Injecting with Mara:")) {
            const path = key.split("Injecting with Mara: ")[1];
            if (lang === 'es') trans = `Inyectando con Mara: ${path}`;
            else if (lang === 'pt') trans = `Injetando com Mara: ${path}`;
        } else if (key.startsWith("Failed to launch: ")) {
            const err = key.split("Failed to launch: ")[1];
            if (lang === 'es') trans = `Fallo al iniciar: ${err}`;
            else if (lang === 'pt') trans = `Falha ao iniciar: ${err}`;
        }
        
        return trans;
    }

    function updateI18nKey(el, key) {
        if (el) el.textContent = getTranslation(key);
    }

    function setLanguage(lang) {
        localStorage.setItem('amatayakul_language', lang);
        if (!translations[lang]) lang = 'en';
        const dict = translations[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                if (el.tagName.toLowerCase() === 'p' && dict[key].includes('<')) {
                    el.innerHTML = dict[key];
                } else {
                    el.textContent = dict[key];
                }
            }
        });
        
        if (isValidVersion) {
            if (isInjected) {
                if (versionText) versionText.textContent = `Minecraft 0.15.10 - ${getTranslation('status_running')}`;
            } else if (isLaunching) {
                // Keep current text
            } else {
                if (versionText) versionText.textContent = `Minecraft 0.15.10 - ${getTranslation('status_ready')}`;
                
                // Fix button texts based on state without resetting UI
                const autoInjectEnabled = autoInjectToggle && autoInjectToggle.checked;
                if (autoInjectEnabled || manualLaunchWaiting) {
                    updateI18nKey(btnLaunchTitle, 'btn_enter');
                    updateI18nKey(btnLaunchSub, 'btn_enter_sub');
                } else {
                    updateI18nKey(btnLaunchTitle, 'btn_manual_launch');
                    updateI18nKey(btnLaunchSub, 'btn_manual_launch_sub');
                }
            }
        }
        
        if (languageSelect) {
            const selectedContent = languageSelect.querySelector('.select-content');
            const itemsList = languageSelect.querySelector('.select-items');
            
            const targetItem = Array.from(itemsList.children).find(el => el.getAttribute('data-value') === lang);
            if (targetItem && selectedContent) {
                selectedContent.innerHTML = targetItem.innerHTML;
            }
        }
        
        // Re-translate current status and progress messages
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage && statusMessage.dataset.currentMsg) {
            statusMessage.textContent = getTranslation(statusMessage.dataset.currentMsg);
        }
        const progressText = document.getElementById('progressText');
        if (progressText && progressText.dataset.currentMsg) {
            progressText.textContent = getTranslation(progressText.dataset.currentMsg);
        }
    }

    const savedLang = localStorage.getItem('amatayakul_language') || 'es';
    setLanguage(savedLang);

    if (languageSelect) {
        const selected = languageSelect.querySelector('.select-selected');
        const itemsList = languageSelect.querySelector('.select-items');

        selected.addEventListener('click', (e) => {
            e.stopPropagation();
            languageSelect.classList.toggle('active');
            itemsList.classList.toggle('select-hide');
        });

        Array.from(itemsList.children).forEach(item => {
            item.addEventListener('click', (e) => {
                const lang = item.getAttribute('data-value');
                setLanguage(lang);
                languageSelect.classList.remove('active');
                itemsList.classList.add('select-hide');
            });
        });

        document.addEventListener('click', () => {
            languageSelect.classList.remove('active');
            itemsList.classList.add('select-hide');
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
        originalLog(...args);
        const msg = args.join(' ');
        if (window.go && window.go.main && window.go.main.App) {
            window.go.main.App.LogJS(msg, 'info');
        }
    };
    console.warn = (...args) => {
        originalWarn(...args);
        const msg = args.join(' ');
        if (window.go && window.go.main && window.go.main.App) {
            window.go.main.App.LogJS(msg, 'warn');
        }
    };
    console.error = (...args) => {
        originalError(...args);
        const msg = args.join(' ');
        if (window.go && window.go.main && window.go.main.App) {
            window.go.main.App.LogJS(msg, 'error');
        }
    };

    // Listen for backend logs
    window.runtime.EventsOn('app:log', (msg, level = 'system') => {
        showStatus(msg, level);
    });

    btnOpenConsole.addEventListener('click', () => {
        window.go.main.App.OpenConsole();
    });

    function showStatus(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;

        statusMessage.dataset.currentMsg = message;
        statusMessage.textContent = getTranslation(message);
        
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.opacity = '1';
        
        if (window.statusTimeout) clearTimeout(window.statusTimeout);
        if (type !== 'error' && type !== 'system' && !message.includes("Waiting for")) {
            window.statusTimeout = setTimeout(() => {
                statusMessage.style.opacity = '0';
            }, 3000);
        }
    }

    function updateProgress(percent, text) {
        if (!progressContainer || !progressFill || !progressText) return;
        progressContainer.style.display = 'block';
        progressFill.style.width = `${percent}%`;
        
        progressText.dataset.currentMsg = text;
        progressText.textContent = getTranslation(text);
    }

    function hideProgress() {
        progressContainer.style.display = 'none';
    }

    function setInjectedMode() {
        isInjected = true;
        btnLaunch.style.display = 'none';
        if (btnCancelLaunch) btnCancelLaunch.style.display = 'none';
        btnKill.style.display   = 'flex';
        showStatus('Running!', 'success');
        if (statusDot) statusDot.className = 'status-dot running';
    }

    function setReadyMode() {
        isInjected = false;
        isLaunching = false;
        manualLaunchWaiting = false;
        btnLaunch.style.display = 'flex';
        btnKill.style.display = 'none';
        if (btnCancelLaunch) btnCancelLaunch.style.display = 'none';
        
        const autoInjectEnabled = autoInjectToggle && autoInjectToggle.checked;
        if (autoInjectEnabled) {
            updateI18nKey(btnLaunchTitle, 'btn_enter');
            updateI18nKey(btnLaunchSub, 'btn_enter_sub');
        } else {
            updateI18nKey(btnLaunchTitle, 'btn_manual_launch');
            updateI18nKey(btnLaunchSub, 'btn_manual_launch_sub');
        }
        
        btnLaunch.classList.remove('btn-ready-to-inject');
        btnLaunch.disabled = !isValidVersion;
        if (isValidVersion) {
            showStatus(getTranslation('status_ready_launch'), 'success');
            if (statusDot) statusDot.className = 'status-dot valid';
        }
    }

    async function checkMinecraftVersion() {
        try {
            const version = await window.go.main.App.GetMinecraftVersion();
            if (!version) {
                if (versionText) versionText.textContent = 'Minecraft UWP not found';
                isValidVersion = false;
                btnLaunch.disabled = true;
                showStatus('Minecraft UWP is not installed', 'error');
                return false;
            }
            if (version.includes(REQUIRED_VERSION)) {
                if (versionText) versionText.textContent = `Minecraft 0.15.10 - ${getTranslation('status_ready')}`;
                if (statusDot) statusDot.className = 'status-dot valid';
                isValidVersion = true;
                setReadyMode();
                return true;
            } else {
                if (versionText) versionText.textContent = `Minecraft ${version} - ${getTranslation('status_unsupported')}`;
                if (statusDot) statusDot.className = 'status-dot invalid';
                isValidVersion = false;
                btnLaunch.disabled = true;
                showStatus(`${getTranslation('status_required')}: ${REQUIRED_VERSION}`, 'error');
                return false;
            }
        } catch (e) {
            console.error('Init Error:', e);
            if (versionText) versionText.textContent = 'Minecraft not detected (Bridge Error)';
            if (statusDot) statusDot.className = 'status-dot invalid';
            return false;
        }
    }

    async function performInject(skipLaunch = false) {
        if (isLaunching && !skipLaunch) return;

        // If we are injecting manually, check if process is still running right away
        if (skipLaunch) {
            const isRunning = await window.go.main.App.IsMinecraftRunning();
            if (!isRunning) {
                openModal(processNotFoundModal);
                return;
            }
        }

        isLaunching = true;
        btnLaunch.style.display = 'none';
        if (btnCancelLaunch) btnCancelLaunch.style.display = 'flex';

        if (!skipLaunch) {
            launchBlocker = true;
            setTimeout(() => { launchBlocker = false; }, 10000);
        }

        try {
            updateProgress(40, 'Preparing Injection...');
            showStatus('Injecting DLL into Minecraft...', 'info');

            const dllValue = customDllPath ? customDllPath.value.trim() : '';
            const cooldownVal = parseInt(injectCooldown.value) || 10;
            
            const result = await window.go.main.App.PerformInjection(
                dllValue, 
                skipLaunch, 
                checkMaraUpdate.checked, 
                checkDllUpdate.checked,
                cooldownVal
            );

            if (result.success) {
                updateProgress(100, 'Injection complete!');
                await new Promise(resolve => setTimeout(resolve, 1500));
                hideProgress();
                setInjectedMode();
                window.go.main.App.SetRPCIngame();
            } else {
                if (result.error === 'cancelled') {
                    showStatus('Injection cancelled', 'info');
                    setReadyMode();
                } else if (result.error === 'process_not_found') {
                    showStatus('Minecraft process not found', 'error');
                    setReadyMode();
                    openModal(processNotFoundModal);
                } else {
                    throw new Error(result.error || 'Injection failed');
                }
            }
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            hideProgress();
            setReadyMode();
        } finally {
            isLaunching = false;
        }
    }

    if (btnCancelLaunch) {
        btnCancelLaunch.addEventListener('click', () => {
            window.go.main.App.CancelInjection();
        });
    }

    btnLaunch.addEventListener('click', async () => {
        if (isLaunching) return;

        // Manual Injection Confirmation
        if (manualLaunchWaiting) {
            const skip = localStorage.getItem('amatayakul_skip_inject_warning') === 'true';
            if (skip) {
                manualLaunchWaiting = false;
                await performInject(true);
            } else {
                openModal(manualInjectModal);
            }
            return;
        }

        const autoInjectEnabled = autoInjectToggle && autoInjectToggle.checked;
        
        if (autoInjectEnabled) {
            // Auto-Inject Flow: Launch -> Wait Cooldown -> Inject
            await performInject(false);
        } else {
            // Manual Flow: Launch -> Change to Inject
            isLaunching = true;
            btnLaunch.style.display = 'none';
            if (btnCancelLaunch) btnCancelLaunch.style.display = 'flex';
            updateProgress(30, 'Launching Minecraft...');
            showStatus('Launching Minecraft...', 'info');

            try {
                const res = await window.go.main.App.LaunchMinecraft();
                if (!res.success) throw new Error(res.error);

                launchBlocker = true;
                updateProgress(60, 'Game starting...');
                
                isLaunching = false;
                manualLaunchWaiting = true;
                if (btnCancelLaunch) btnCancelLaunch.style.display = 'none';
                btnLaunch.style.display = 'flex';
                btnLaunch.classList.add('btn-ready-to-inject');
                
                updateI18nKey(btnLaunchTitle, 'btn_enter');
                updateI18nKey(btnLaunchSub, 'btn_enter_sub');
                
                showStatus('Game opened. Click Inject to load DLL.', 'success');
                hideProgress();
                
                // Keep blocker active for a bit longer to ensure it doesn't flip back
                setTimeout(() => { launchBlocker = false; }, 5000);
            } catch (e) {
                showStatus(`Failed to launch: ${e.message}`, 'error');
                setReadyMode();
            }
        }
    });

    btnContinueInject.addEventListener('click', async () => {
        if (skipInjectWarning && skipInjectWarning.checked) {
            localStorage.setItem('amatayakul_skip_inject_warning', 'true');
        }
        closeModal(manualInjectModal);
        manualLaunchWaiting = false;
        await performInject(true);
    });

    btnWaitInject.addEventListener('click', () => closeModal(manualInjectModal));

    // ── Process Not Found Modal ───────────────────────────────
    const processNotFoundModal = document.getElementById('processNotFoundModal');
    const btnRetryInject = document.getElementById('btnRetryInject');
    const btnCancelRetry = document.getElementById('btnCancelRetry');

    btnRetryInject.addEventListener('click', async () => {
        closeModal(processNotFoundModal);
        // We simulate a manual click on "Launch" so it restarts the whole flow if needed
        // Or we can just call performInject(false) to restart the game
        const autoInjectEnabled = autoInjectToggle && autoInjectToggle.checked;
        if (autoInjectEnabled) {
            await performInject(false);
        } else {
            // For manual mode, reset UI to ready and let them click Launch again
            setReadyMode();
            btnLaunch.click();
        }
    });

    btnCancelRetry.addEventListener('click', () => {
        closeModal(processNotFoundModal);
        setReadyMode();
    });

    // ── Kill Button ──────────────────────────────────────────
    btnKill.addEventListener('click', () => {
        openModal(killConfirmModal);
    });

    btnConfirmKill.addEventListener('click', async () => {
        closeModal(killConfirmModal);
        const result = await window.go.main.App.KillMinecraft();
        if (!result.success) {
            showStatus('Failed to kill Minecraft: ' + result.error, 'error');
        }
        // setReadyMode will be called naturally by the process watcher event
    });

    btnCancelKill.addEventListener('click', () => closeModal(killConfirmModal));

    // ── Game-Detected Popup ──────────────────────────────────
    btnInjectAnyways.addEventListener('click', async () => {
        closeModal(gameDetectedModal);
        await performInject(true /* skipLaunch */);
    });

    btnRestartAndInject.addEventListener('click', async () => {
        closeModal(gameDetectedModal);
        if (isLaunching) return;
        isLaunching = true;
        btnLaunch.disabled = true;

        try {
            updateProgress(20, 'Killing existing process...');
            showStatus('Restarting Minecraft...', 'info');
            await window.go.main.App.KillMinecraft();
            await new Promise(resolve => setTimeout(resolve, 1500));
            updateProgress(50, 'Relaunching Minecraft...');
            isLaunching = false;
            await performInject(false /* launch fresh */);
        } catch (e) {
            showStatus(`Error: ${e.message}`, 'error');
            hideProgress();
            isLaunching = false;
            btnLaunch.disabled = !isValidVersion;
        }
    });

    // ── Process Watcher (events from Go) ─────────────────────
    // Go emits "minecraft:running" every second
    window.runtime.EventsOn('minecraft:running', (running) => {
        if (running) {
            if (!isInjected && !isLaunching) {
                // Check for Auto-Inject
                const autoInjectEnabled = autoInjectToggle && autoInjectToggle.checked;
                if (autoInjectEnabled) {
                    console.log("Auto-Inject: Game detected, starting injection...");
                    performInject(true /* skipLaunch since it's already running */);
                }
            }
        } else {
            // Process gone
            if (!launchBlocker && (isInjected || isLaunching || manualLaunchWaiting)) {
                setReadyMode();
                isLaunching = false;
                hideProgress();
                window.go.main.App.SetRPCLauncher();
            }
        }
    });

    // ── Update Logic ─────────────────────────────────────────
    let latestUpdateUrl = '';

    window.runtime.EventsOn('update:available', (data) => {
        let version = '0.0.0';
        if (typeof data === 'object' && data !== null) {
            version = data.version;
            latestUpdateUrl = data.url;
        } else {
            version = data;
        }
        if (newVersionTag) newVersionTag.textContent = `v${version}`;
        openModal(updateModal);
    });

    if (btnUpdateNow) {
        btnUpdateNow.addEventListener('click', () => {
            closeModal(updateModal);
            showStatus('Launching updater...', 'info');
            
            const lang = localStorage.getItem('amatayakul_language') || 'es';
            
            window.go.main.App.StartUpdate(latestUpdateUrl, lang)
                .then((res) => {
                    if (res && !res.success) {
                        showStatus('Failed to start update: ' + res.error, 'error');
                    }
                })
                .catch((err) => {
                    showStatus('Error starting updater: ' + err, 'error');
                });
        });
    }

    if (btnUpdateLater) {
        btnUpdateLater.addEventListener('click', () => {
            closeModal(updateModal);
        });
    }

    // ── Modal Helpers ────────────────────────────────────────
    function openModal(el) { el.classList.add('active'); }
    function closeModal(el) { el.classList.remove('active'); }

    // Settings
    function openSettings() { openModal(settingsModal); }
    function closeSettingsModal() { closeModal(settingsModal); }

    btnSettings.addEventListener('click', openSettings);
    if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
    if (settingsModal) settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettingsModal();
    });

    // Expansion logic
    if (btnExpandUpdates) {
        btnExpandUpdates.addEventListener('click', () => {
            updateCheckerField.classList.toggle('field--open');
        });
    }

    // ── Window Controls ──────────────────────────────────────
    if (btnMinimize) btnMinimize.addEventListener('click', () => window.runtime.WindowMinimize());
    if (btnMaximize) btnMaximize.addEventListener('click', () => {
        window.runtime.WindowIsMaximised().then(isMax => {
            if (isMax) window.runtime.WindowUnmaximise();
            else window.runtime.WindowMaximise();
        });
    });
    if (btnClose) btnClose.addEventListener('click', () => window.runtime.Quit());

    // ── Settings Persistence ─────────────────────────────────
    const savedDll = localStorage.getItem('amatayakul_custom_dll');
    if (savedDll) customDllPath.value = savedDll;

    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            try {
                const fp = await window.go.main.App.SelectDLL();
                if (fp) customDllPath.value = fp;
            } catch (e) {
                console.error('Failed to select DLL:', e);
            }
        });
    }

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const val = customDllPath.value.trim();
            if (val) localStorage.setItem('amatayakul_custom_dll', val);
            else localStorage.removeItem('amatayakul_custom_dll');
            
            localStorage.setItem('amatayakul_check_mara', checkMaraUpdate.checked);
            localStorage.setItem('amatayakul_check_dll', checkDllUpdate.checked);
            localStorage.setItem('amatayakul_auto_inject', autoInjectToggle.checked);
            localStorage.setItem('amatayakul_inject_cooldown', injectCooldown.value);
            
            closeSettingsModal();
        });
    }

    if (btnResetSettings) {
        btnResetSettings.addEventListener('click', () => {
            customDllPath.value = '';
            checkMaraUpdate.checked = true;
            checkDllUpdate.checked = true;
            autoInjectToggle.checked = false;
            injectCooldown.value = 10;
            
            localStorage.removeItem('amatayakul_custom_dll');
            localStorage.setItem('amatayakul_check_mara', 'true');
            localStorage.setItem('amatayakul_check_dll', 'true');
            localStorage.setItem('amatayakul_auto_inject', 'false');
            localStorage.setItem('amatayakul_inject_cooldown', '10');
        });
    }

    // Load extra settings
    const savedMaraCheck = localStorage.getItem('amatayakul_check_mara');
    if (savedMaraCheck !== null && checkMaraUpdate) checkMaraUpdate.checked = savedMaraCheck === 'true';
    
    const savedDllCheck = localStorage.getItem('amatayakul_check_dll');
    if (savedDllCheck !== null && checkDllUpdate) checkDllUpdate.checked = savedDllCheck === 'true';

    const savedAutoInject = localStorage.getItem('amatayakul_auto_inject');
    if (savedAutoInject !== null && autoInjectToggle) {
        autoInjectToggle.checked = savedAutoInject === 'true';
        if (autoInjectToggle.checked && autoInjectOptions) autoInjectOptions.classList.add('active');
    }

    const savedCooldown = localStorage.getItem('amatayakul_inject_cooldown');
    if (savedCooldown !== null && injectCooldown) injectCooldown.value = savedCooldown;

    // ── Cinematic Flicker ────────────────────────────────────
    setInterval(() => {
        if (Math.random() > 0.96) {
            document.body.classList.add('flicker');
            setTimeout(() => document.body.classList.remove('flicker'), 120);
        }
    }, 2000);

    // ── Skin Viewer & Boot ───────────────────────────────────
    async function initSkinViewer() {
        if (!window.skinview3d || !skinContainer) return;
        
        let viewer;
        try {
            viewer = new skinview3d.SkinViewer({
                canvas: document.createElement("canvas"),
                width: skinContainer.clientWidth || 300,
                height: skinContainer.clientHeight || 400
            });
        } catch (err) {
            console.error("initSkinViewer: CRASHED during constructor:", err);
            return;
        }
        
        skinContainer.innerHTML = ''; 
        try {
            skinContainer.appendChild(viewer.canvas);
            if (viewer.camera) viewer.camera.position.z = 60;
            
            // Brighten up the character
            if (viewer.globalLight) viewer.globalLight.intensity = 0.7;
            if (viewer.cameraLight) viewer.cameraLight.intensity = 0.7;
            
            const animObj = viewer.animations || viewer.animation;
            if (animObj && animObj.add && skinview3d.IdleAnimation) {
                animObj.add(skinview3d.IdleAnimation);
            }
        } catch (e) {
            console.error("initSkinViewer: Error during setup:", e);
        }

        // Fetch custom skin from backend IMMEDIATELY
        try {
            if (!window.go || !window.go.main || !window.go.main.App) {
                console.error("initSkinViewer: Wails API not ready, falling back to default.");
                await viewer.loadSkin("fallback-skin.png");
                return;
            }
            
            const base64Skin = await window.go.main.App.GetMinecraftSkinBase64();
            if (base64Skin && base64Skin.length > 200) {
                await viewer.loadSkin(base64Skin);
            } else {
                console.log("initSkinViewer: Custom skin not found, using fallback.");
                await viewer.loadSkin("fallback-skin.png");
            }
        } catch(e) {
            console.error("initSkinViewer: Error loading skin, using fallback:", e);
            await viewer.loadSkin("fallback-skin.png");
        }

        // Handle resize
        window.addEventListener('resize', () => {
            if (viewer) {
                viewer.width = skinContainer.clientWidth;
                viewer.height = skinContainer.clientHeight;
            }
        });
    }

    async function boot() {
        try {
            const ver = await window.go.main.App.GetAppVersion();
            // Optional: put version somewhere
        } catch (e) {
            console.error('Failed to get app version:', e);
        }

        try {
            const username = await window.go.main.App.GetMinecraftUsername();
            if (username && playerNameDisplay) {
                playerNameDisplay.textContent = username;
                const topUserName = document.querySelector('.user-name');
                if (topUserName) topUserName.textContent = username;
            }
        } catch(e) {
            console.error('Failed to get username:', e);
        }

        initSkinViewer();
        setTimeout(checkMinecraftVersion, 500);
    }

    boot();
});
