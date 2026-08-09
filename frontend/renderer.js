document.addEventListener('DOMContentLoaded', () => {
    // ── Splash ─────────────────────────────────────────────
    const splash = document.getElementById('loadingSplash');
    const hideSplash = () => {
        if (splash && !splash.classList.contains('fade-out')) {
            splash.classList.add('fade-out');
            splash.addEventListener('transitionend', () => {
                splash.remove(); // Remove from DOM after fade-out completes
            }, { once: true }); // Ensure this listener runs only once
        }
    };

    // Add a global error handler for better debugging
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("Uncaught JavaScript Error:", { message, source, lineno, colno, error });
        if (window.go && window.go.main && window.go.main.App) {
            window.go.main.App.LogJS(`Uncaught Error: ${message} at ${source}:${lineno}:${colno}`, 'error');
        }
        // Returning true prevents the default browser error handling (e.g., console output, dialogs)
        return true; 
    };

    setTimeout(hideSplash, 2500);


    // ── Element Refs ────────────────────────────────────────
    const btnLaunch          = document.getElementById('btnLaunch');
    const btnCancelLaunch    = document.getElementById('btnCancelLaunch');
    const btnLaunchTitle     = btnLaunch ? btnLaunch.querySelector('.launch-title') : null;
    const btnLaunchSub       = btnLaunch ? btnLaunch.querySelector('.launch-subtitle') : null;
    const btnKill            = document.getElementById('btnKill');
    const btnSettings        = document.getElementById('navSettings');
    const btnMinimize        = document.getElementById('btnMinimize');
    const btnMaximize        = document.getElementById('btnMaximize');
    const btnClose           = document.getElementById('btnClose');
    const settingsModal      = document.getElementById('settingsModal');
    const closeSettings      = document.getElementById('closeSettings');
    const btnBrowse          = document.getElementById('btnBrowse');
    const btnDefaultDll      = document.getElementById('btnDefaultDll');
    const btnSaveSettings    = document.getElementById('btnSaveSettings');
    const btnSaveSettingsAdv = document.getElementById('btnSaveSettingsAdv');
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

    // Invalid DLL modal
    const invalidDllModal      = document.getElementById('invalidDllModal');
    const btnDllErrorSettings  = document.getElementById('btnDllErrorSettings');
    const btnDllErrorRetry     = document.getElementById('btnDllErrorRetry');
    
    const newVersionTag      = document.getElementById('newVersionTag');
    
    // Update checker refs
    const btnExpandUpdates   = document.getElementById('btnExpandUpdates');
    const updateCheckerField = document.getElementById('updateCheckerField');
    const checkMaraUpdate    = document.getElementById('checkMaraUpdate');
    const checkDllUpdate     = document.getElementById('checkDllUpdate');
    const languageSelect     = document.getElementById('languageSelect');
    const manageVersionsToggle = document.getElementById('manageVersionsToggle');
    
    // Manage Versions modals
    const unsupportedVersionModal = document.getElementById('unsupportedVersionModal');
    const btnUnsupportedOk = document.getElementById('btnUnsupportedOk');
    const requiredAssetsModal = document.getElementById('requiredAssetsModal');
    const btnReqAssetsYes = document.getElementById('btnReqAssetsYes');
    const btnReqAssetsNo = document.getElementById('btnReqAssetsNo');
    const assetUpdateModal = document.getElementById('assetUpdateModal');
    const btnAssetUpdateYes = document.getElementById('btnAssetUpdateYes');
    const btnAssetUpdateNo = document.getElementById('btnAssetUpdateNo');
    const assetProgressModal = document.getElementById('assetProgressModal');
    const assetProgressFill = document.getElementById('assetProgressFill');
    const assetProgressTitle = document.getElementById('assetProgressTitle');
    const assetProgressPercent = document.getElementById('assetProgressPercent');
    const assetProgressSpeed = document.getElementById('assetProgressSpeed');
    const assetProgressSize = document.getElementById('assetProgressSize');
    const assetProgressTime = document.getElementById('assetProgressTime');
    const assetInstallPromptModal = document.getElementById('assetInstallPromptModal');
    const btnInstallYes = document.getElementById('btnInstallYes');
    const btnInstallNo = document.getElementById('btnInstallNo');
    const reqAssetsVersion = document.getElementById('reqAssetsVersion');
    const installPromptVersion = document.getElementById('installPromptVersion');
    
    // Minecraft Not Installed modal
    const mcNotInstalledModal = document.getElementById('mcNotInstalledModal');
    const btnInstallMinecraft = document.getElementById('btnInstallMinecraft');
    const btnCancelInstall = document.getElementById('btnCancelInstall');
    
    // ── State ───────────────────────────────────────────────
    const REQUIRED_VERSION = '0.1510.0.0';
    const supportedGameVersion = '0.15.10';
    let isValidVersion = true;
    let isLaunching    = false;
    let isInjected     = false;
    let manualLaunchWaiting = false;
    let launchBlocker = false; // Prevents process watcher from resetting state during startup
    let mcNotInstalledShown = false; // Prevents showing the not-installed modal twice

    // ── Settings Cache & Backend Integration ──────────────────
    let appSettings = {
        language: 'es',
        custom_dll: '',
        auto_inject: false,
        inject_cooldown: 10,
        check_mara: true,
        check_dll: true,
        skip_inject_warning: false,
        manage_versions: false,
        tweaks_autogap: false,
        tweaks_autogap_intensity: 32,
        tweaks_fullbright: false,
        tweaks_shaders: false
    };

    async function loadSettingsFromBackend() {
        try {
            if (window.go && window.go.main && window.go.main.App) {
                const cfg = await window.go.main.App.GetConfig();
                if (cfg) {
                    appSettings = cfg;
                    applySettingsToUI();
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    async function saveSettingsToBackend() {
        try {
            if (window.go && window.go.main && window.go.main.App) {
                await window.go.main.App.SaveConfig(appSettings);
            }
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    function applySettingsToUI() {
        setLanguage(appSettings.language, false);
        if (customDllPath) customDllPath.value = appSettings.custom_dll || '';
        if (checkMaraUpdate) checkMaraUpdate.checked = appSettings.check_mara;
        if (checkDllUpdate) checkDllUpdate.checked = appSettings.check_dll;
        if (autoInjectToggle) {
            autoInjectToggle.checked = appSettings.auto_inject;
            if (autoInjectToggle.checked && autoInjectOptions) {
                autoInjectOptions.classList.add('active');
            } else if (autoInjectOptions) {
                autoInjectOptions.classList.remove('active');
            }
        }
        if (injectCooldown) injectCooldown.value = appSettings.inject_cooldown;
        if (manageVersionsToggle) {
            manageVersionsToggle.checked = appSettings.manage_versions || false;
        }

        const autoGapToggle = document.getElementById('autoGapToggle');
        const autoGapSlider = document.getElementById('autoGapSlider');
        const autoGapIntensityLabel = document.getElementById('autoGapIntensity');
        if (autoGapToggle) autoGapToggle.checked = appSettings.tweaks_autogap || false;
        if (autoGapSlider) {
            autoGapSlider.value = appSettings.tweaks_autogap_intensity || 32;
            if (autoGapIntensityLabel) autoGapIntensityLabel.textContent = autoGapSlider.value;
        }
        
        const fullBrightToggle = document.getElementById('fullBrightToggle');
        if (fullBrightToggle) fullBrightToggle.checked = appSettings.tweaks_fullbright || false;

        const shadersToggle = document.getElementById('shadersToggle');
        if (shadersToggle) shadersToggle.checked = appSettings.tweaks_shaders || false;
    }

    // ── Internationalization (i18n) ─────────────────────────
    const translations = {
        es: {
            nav_dashboard: "PANEL",
            nav_settings: "Ajustes",
            nav_textures: "Texturas",
            welcome_msg: "Bien venido(a), ",
            btn_enter: "INYECTAR",
            btn_enter_sub: "",
            btn_manual_launch: "JUGAR",
            btn_manual_launch_sub: "",
            btn_ready_inject: "¿INYECTAR AHORA?",
            btn_ready_inject_sub: "JUEGO DETECTADO",
            btn_kill: "CERRAR",
            btn_kill_sub: "CERRAR MINECRAFT",
            btn_cancel: "CANCELAR",
            textures_subtitle: "Personaliza tu experiencia de Minecraft.",
            textures_imported_title: "Paquetes Importados",
            textures_empty: "Aún no hay paquetes de texturas importados.",
            drag_drop_title: "Arrastra APKs de MCPE 0.15.10 para extraer el paquete de texturas",
            drag_drop_subtitle: "o haz clic para buscar archivos",
            coming_soon_title: "Próximamente",
            coming_soon_desc: "La gestión de paquetes de texturas está en camino. Estate atento a las actualizaciones.",
            settings_title: "Ajustes",
            settings_subtitle: "Configura el launcher a tu gusto.",
            settings_language: "Idioma",
            settings_auto_inject: "Inyección Automática",
            dll_error_title: "Camino inválido",
            dll_error_desc: "¡Camino inválido de DLL! Por favor usa una DLL válida e intenta de nuevo.",
            dll_error_settings: "Ajustes",
            dll_error_retry: "Reintentar",
            settings_cooldown: "Tiempo de espera (s)",
            settings_cooldown_warn: "No recomendado para PCs lentos, use solo si su PC carga el juego en menos de 10 segundos, o establezca un tiempo personalizado para asegurar la estabilidad.",
            settings_payload: "Carga Inyectada",
            settings_browse: "Examinar",
            settings_default_dll: "Usar Predeterminada",
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
            "Injection successful!": "¡Inyección exitosa!",
            btn_yes: "Sí",
            btn_no: "No",
            btn_ok: "OK",
            btn_install: "Instalar",
            btn_later: "Después",
            mc_not_installed_title: "Minecraft No Instalado",
            mc_not_installed_body: "Minecraft 0.15.10 no está instalado en este sistema.<br><br>¿Quieres descargar e instalar los assets desde GitHub?",
            mv_unsupported_title: "Versión no compatible",
            mv_unsupported_body: "Tu versión instalada no es compatible con la gestión de versiones.<br><br><strong>Versión soportada:</strong><br>{version}<br><br>Por favor instala la versión soportada antes de usar esta función.",
            mv_required_title: "Activos Requeridos",
            mv_required_body: "¿Quieres descargar los activos para la versión <strong>{version}</strong>?<br><br>Estos activos son necesarios para:<br>&bull; Gestión de paquetes de texturas<br>&bull; Interfaz de juego personalizada<br><br>¿Continuar?",
            mv_update_title: "Activos Actualizados",
            mv_update_body: "Los activos del lanzador se han actualizado.<br><br>¿Quieres descargarlos ahora?<br><br>Tu paquete de texturas importado se revertirá al paquete de texturas por defecto, y tendrás que importarlo de nuevo.<br><br>¿Continuar?",
            mv_progress_download: "Descargando activos para {version}...",
            mv_progress_extract: "Extrayendo activos...",
            mv_install_title: "Instalar Activos",
            mv_install_body: "Activos descargados correctamente para la versión <strong>{version}</strong>.<br><br>¿Quieres instalarlos ahora?",
            mv_error_title: "Error de Conexión",
            mv_error_body: "No se pudo contactar con el repositorio de activos.<br><br>Asegúrate de estar conectado a internet.<br><br><strong>Error:</strong> {error}"
        },
        en: {
            nav_dashboard: "DASHBOARD",
            nav_settings: "Settings",
            nav_textures: "Textures",
            welcome_msg: "Welcome, ",
            btn_enter: "INJECT",
            btn_enter_sub: "",
            btn_manual_launch: "LAUNCH",
            btn_manual_launch_sub: "",
            btn_ready_inject: "INJECT NOW?",
            btn_ready_inject_sub: "GAME DETECTED",
            btn_kill: "KILL",
            btn_kill_sub: "TERMINATE MINECRAFT",
            btn_cancel: "CANCEL",
            textures_subtitle: "Customize your Minecraft experience.",
            textures_imported_title: "Imported Packs",
            textures_empty: "No texture packs imported yet.",
            drag_drop_title: "Drag MCPE 0.15.10 APKs to extract texture pack from",
            drag_drop_subtitle: "or click to browse files",
            coming_soon_title: "Coming Soon",
            coming_soon_desc: "Texture pack management is on the way. Stay tuned for updates.",
            settings_title: "Settings",
            settings_subtitle: "Configure the launcher to your liking.",
            settings_language: "Language",
            dll_error_title: "Invalid DLL Path",
            dll_error_desc: "Invalid DLL path! Please set a valid DLL and try again.",
            dll_error_settings: "Settings",
            dll_error_retry: "Try Again",
            settings_auto_inject: "Auto Inject",
            settings_cooldown: "Injection Cooldown (s)",
            settings_cooldown_warn: "Not recommended for slower PCs, only use if your pc loads the game faster than 10 seconds, or set a custom cooldown matching your PC's loading speed to ensure stability.",
            settings_payload: "Injected Payload",
            settings_browse: "Browse",
            settings_default_dll: "Use Default",
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
            btn_retry: "Retry",
            btn_yes: "Yes",
            btn_no: "No",
            btn_ok: "OK",
            btn_install: "Install",
            btn_later: "Later",
            mc_not_installed_title: "Minecraft Not Installed",
            mc_not_installed_body: "Minecraft 0.15.10 is not installed on this system.<br><br>Would you like to download and install the assets from GitHub?",
            mv_unsupported_title: "Unsupported Version",
            mv_unsupported_body: "Your installed version is not supported by Manage Versions.<br><br><strong>Supported version:</strong><br>{version}<br><br>Please install the supported version before using this feature.",
            mv_required_title: "Required Assets",
            mv_required_body: "Do you want to download assets for version <strong>{version}</strong>?<br><br>These assets are required for:<br>&bull; Texture Pack Management<br>&bull; Custom Game UI<br><br>Continue?",
            mv_update_title: "Assets Updated",
            mv_update_body: "The launcher assets have been updated.<br><br>Do you want to download them now?<br><br>Your imported texture pack will be reverted to the default texture pack, and you will need to import it again.<br><br>Continue?",
            mv_progress_download: "Downloading assets for {version}...",
            mv_progress_extract: "Extracting assets...",
            mv_install_title: "Install Assets",
            mv_install_body: "Successfully downloaded assets for version <strong>{version}</strong>.<br><br>Do you want to install them now?",
            mv_error_title: "Connection Error",
            mv_error_body: "Could not reach the asset repository.<br><br>Make sure you are connected to the internet.<br><br><strong>Error:</strong> {error}"
        },
        pt: {
            nav_dashboard: "PAINEL",
            nav_settings: "Configurações",
            nav_textures: "Texturas",
            welcome_msg: "Bem vindo(a), ",
            btn_enter: "INJETAR",
            btn_enter_sub: "",
            btn_manual_launch: "JOGAR",
            btn_manual_launch_sub: "",
            btn_ready_inject: "INJETAR AGORA?",
            btn_ready_inject_sub: "JOGO DETECTADO",
            btn_kill: "FECHAR",
            btn_kill_sub: "FECHAR MINECRAFT",
            btn_cancel: "CANCELAR",
            textures_subtitle: "Personalize sua experiência no Minecraft.",
            textures_imported_title: "Pacotes Importados",
            textures_empty: "Nenhum pacote de texturas importado ainda.",
            drag_drop_title: "Arraste APKs do MCPE 0.15.10 para extrair o pacote de texturas",
            drag_drop_subtitle: "ou clique para procurar arquivos",
            coming_soon_title: "Em Breve",
            coming_soon_desc: "O gerenciamento de pacotes de texturas está a caminho. Fique atento às atualizações.",
            settings_title: "Configurações",
            settings_subtitle: "Configure o launcher do seu jeito.",
            settings_language: "Idioma",
            dll_error_title: "Caminho inválido",
            dll_error_desc: "Caminho de DLL inválido! Por favor use uma DLL válida e tente novamente.",
            dll_error_settings: "Configurações",
            dll_error_retry: "Tentar novamente",
            settings_auto_inject: "Injeção Automática",
            settings_cooldown: "Tempo de espera (s)",
            settings_cooldown_warn: "Não recomendado para PCs lentos, use apenas se o seu PC carregar o jogo em menos de 10 segundos, ou defina um tempo personalizado para garantir a estabilidade.",
            settings_payload: "Carga Injetada",
            settings_browse: "Procurar",
            settings_default_dll: "Usar Padrão",
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
            "Injection successful!": "Injeção bem sucedida!",
            btn_yes: "Sim",
            btn_no: "Não",
            btn_ok: "OK",
            btn_install: "Instalar",
            btn_later: "Depois",
            mc_not_installed_title: "Minecraft Não Instalado",
            mc_not_installed_body: "Minecraft 0.15.10 não está instalado neste sistema.<br><br>Deseja baixar e instalar os assets do GitHub?",
            mv_unsupported_title: "Versão não suportada",
            mv_unsupported_body: "Sua versão instalada não é compatível com Gerenciar Versões.<br><br><strong>Versão suportada:</strong><br>{version}<br><br>Por favor, instale a versão suportada antes de usar este recurso.",
            mv_required_title: "Ativos Necessários",
            mv_required_body: "Deseja baixar os ativos para a versão <strong>{version}</strong>?<br><br>Estes ativos são necessários para:<br>&bull; Gerenciamento de pacotes de texturas<br>&bull; Interface de jogo personalizada<br><br>Continuar?",
            mv_update_title: "Ativos Atualizados",
            mv_update_body: "Os ativos do lançador foram atualizados.<br><br>Deseja baixá-los agora?<br><br>Seu pacote de texturas importado será revertido para o pacote padrão e você precisará importá-lo novamente.<br><br>Continuar?",
            mv_progress_download: "Baixando ativos para {version}...",
            mv_progress_extract: "Extraindo ativos...",
            mv_install_title: "Instalar Ativos",
            mv_install_body: "Ativos baixados com sucesso para a versão <strong>{version}</strong>.<br><br>Deseja instalá-los agora?",
            mv_error_title: "Erro de Conexão",
            mv_error_body: "Não foi possível acessar o repositório de ativos.<br><br>Certifique-se de que está conectado à internet.<br><br><strong>Erro:</strong> {error}"
        }
    };

    function getTranslation(key) {
        const lang = appSettings.language || 'en';
        const dict = translations[lang] || translations['en'];
        let trans = dict[key] !== undefined ? dict[key] : key;
        
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

    function setLanguage(lang, shouldSave = true) {
        appSettings.language = lang;
        if (shouldSave) {
            saveSettingsToBackend();
        }
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
        
        const playerNameDisplay = document.getElementById('playerNameDisplay');
        if (playerNameDisplay && playerNameDisplay.dataset.username) {
            const name = playerNameDisplay.dataset.username;
            playerNameDisplay.innerHTML = `<span class="greeting-prefix">${getTranslation('welcome_msg').replace('{username}', '')}</span><span class="player-name-bold">${name}</span>`;
        }
        
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

    setLanguage(appSettings.language, false);

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

    // Sidebar Navigation page switching logic
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.getAttribute('data-page');
            document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById(`page-${pageId}`);
            if (targetPage) targetPage.classList.add('active');
        });
    });

    // Settings Sub-tab switching logic
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-stab');
            document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.stab-content').forEach(c => c.classList.remove('active'));
            const targetTab = document.getElementById(`stab-${tabId}`);
            if (targetTab) targetTab.classList.add('active');
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
                if (versionText) versionText.textContent = 'Minecraft not installed';
                isValidVersion = false;
                btnLaunch.disabled = true;
                showStatus('Minecraft is not installed', 'error');
                // Show install prompt modal only if not already shown
                if (mcNotInstalledModal && !mcNotInstalledShown) {
                    mcNotInstalledShown = true;
                    openModal(mcNotInstalledModal);
                }
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

    // ── DLL Validation Guard ─────────────────────────────────
    async function validateDLLBeforeLaunch() {
        const dllVal = customDllPath ? customDllPath.value.trim() : '';
        // Empty = use default DLL, always valid
        if (!dllVal) return true;
        try {
            const ok = await window.go.main.App.ValidateDLLPath(dllVal);
            return ok;
        } catch (e) {
            console.error('DLL validation error:', e);
            return false; // fail-safe: block on error
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

    // ── Manage Versions Asset Workflow ────────────────────────
    // Returns true if the asset workflow was completed (or skipped), false if cancelled
    async function manageVersionsFlow() {
        if (!(manageVersionsToggle && manageVersionsToggle.checked)) {
            return true; // not enabled, continue
        }

        showStatus('Checking assets...', 'info');
        try {
            // Verify Go methods are bound
            if (!window.go || !window.go.main || !window.go.main.App || typeof window.go.main.App.GetLatestAssetRelease !== 'function') {
                showStatus('Manage Versions is not available. Rebuild the app to enable it.', 'error');
                return false;
            }

            // 1. Get latest release from GitHub
            const release = await window.go.main.App.GetLatestAssetRelease();
            if (!release.success) {
                const errMsg = release.error || 'Unknown error';
                console.error('GetLatestAssetRelease failed:', errMsg);
                // Show a modal so the user knows why nothing happened
                const titleEl = document.querySelector('#requiredAssetsModal .modal-top h3');
                const msgEl = document.querySelector('#requiredAssetsModal .dialog-body');
                if (titleEl) titleEl.textContent = getTranslation('mv_error_title');
                if (msgEl) msgEl.innerHTML = getTranslation('mv_error_body').replace('{error}', errMsg);
                // Single "OK" button for the error dialog
                if (btnReqAssetsYes) { btnReqAssetsYes.textContent = getTranslation('btn_ok'); btnReqAssetsYes.style.display = ''; }
                if (btnReqAssetsNo) btnReqAssetsNo.style.display = 'none';
                openModal(requiredAssetsModal);
                await new Promise(resolve => {
                    btnReqAssetsYes.onclick = () => { closeModal(requiredAssetsModal); resolve(true); };
                    btnReqAssetsNo.onclick = () => { closeModal(requiredAssetsModal); resolve(false); };
                });
                return false; // cancel launch
            }

            const latestTag = release.tag_name;
            const zipballUrl = release.zipball_url;

            // 2. Always check the actual filesystem first
            const assetsExist = await window.go.main.App.CheckAssetsExist();
            const installedVersion = await window.go.main.App.GetInstalledAssetVersion();

            if (assetsExist && installedVersion === latestTag) {
                // Assets are present and up to date
                const isRegistered = await window.go.main.App.IsAppxRegisteredToAssets();
                if (isRegistered) {
                    showStatus('Assets ready. Launching...', 'success');
                    return true;
                } else {
                    // Prompt to re-register
                    const installChoice = await new Promise(resolve => {
                        if (installPromptVersion) installPromptVersion.textContent = latestTag;
                        const installBodyEl = document.getElementById('assetInstallPromptText');
                        if (installBodyEl) installBodyEl.innerHTML = "Minecraft is currently not registered to the launcher's Assets folder.<br><br>Do you want to re-register it now?";
                        btnInstallYes.onclick = () => { closeModal(assetInstallPromptModal); resolve(true); };
                        btnInstallNo.onclick = () => { closeModal(assetInstallPromptModal); resolve(false); };
                        openModal(assetInstallPromptModal);
                    });
                    if (!installChoice) return false;

                    showStatus('Registering APPX...', 'info');
                    const registerResult = await registerWithProgress();
                    if (!registerResult.success) {
                        showStatus('Failed to register APPX: ' + (registerResult.error || 'Unknown error'), 'error');
                        if (mcNotInstalledModal) openModal(mcNotInstalledModal);
                        return false;
                    }
                    showStatus('Assets ready. Launching...', 'success');
                    return true;
                }
            }

            let shouldDownload = false;

            if (!assetsExist || !installedVersion || installedVersion === '') {
                // Assets folder is missing or empty — first-time install prompt
                const titleEl = document.querySelector('#requiredAssetsModal .modal-top h3');
                if (titleEl) titleEl.textContent = getTranslation('mv_required_title');
                // Restore both buttons
                if (btnReqAssetsYes) { btnReqAssetsYes.textContent = getTranslation('btn_yes'); btnReqAssetsYes.style.display = ''; }
                if (btnReqAssetsNo) btnReqAssetsNo.style.display = '';
                if (reqAssetsVersion) reqAssetsVersion.textContent = latestTag;
                const bodyEl = document.querySelector('#requiredAssetsModal .dialog-body');
                if (bodyEl) bodyEl.innerHTML = getTranslation('mv_required_body').replace('{version}', latestTag);
                const userChoice = await new Promise(resolve => {
                    btnReqAssetsYes.onclick = () => { closeModal(requiredAssetsModal); resolve(true); };
                    btnReqAssetsNo.onclick = () => { closeModal(requiredAssetsModal); resolve(false); };
                    openModal(requiredAssetsModal);
                });
                if (!userChoice) return false; // cancelled launch
                shouldDownload = true;
            } else if (installedVersion !== latestTag) {
                // Assets exist but outdated — offer update
                const userChoice = await new Promise(resolve => {
                    btnAssetUpdateYes.onclick = () => { closeModal(assetUpdateModal); resolve(true); };
                    btnAssetUpdateNo.onclick = () => { closeModal(assetUpdateModal); resolve(false); };
                    openModal(assetUpdateModal);
                });
                if (!userChoice) {
                    // User declined update — check if registered and continue
                    const isRegistered = await window.go.main.App.IsAppxRegisteredToAssets();
                    if (isRegistered) {
                        showStatus('Assets ready. Launching...', 'success');
                        return true;
                    } else {
                        // Prompt to re-register
                        const installChoice = await new Promise(resolve => {
                            if (installPromptVersion) installPromptVersion.textContent = installedVersion || "0.15.10";
                            const installBodyEl = document.getElementById('assetInstallPromptText');
                            if (installBodyEl) installBodyEl.innerHTML = "Minecraft is currently not registered to the launcher's Assets folder.<br><br>Do you want to re-register it now?";
                            btnInstallYes.onclick = () => { closeModal(assetInstallPromptModal); resolve(true); };
                            btnInstallNo.onclick = () => { closeModal(assetInstallPromptModal); resolve(false); };
                            openModal(assetInstallPromptModal);
                        });
                        if (!installChoice) return false;
                        
                        showStatus('Registering existing assets...', 'info');
                        const registerResult = await registerWithProgress();
                        if (!registerResult.success) {
                            showStatus('Failed to register APPX: ' + (registerResult.error || 'Unknown error'), 'error');
                            if (mcNotInstalledModal) openModal(mcNotInstalledModal);
                            return false;
                        }
                        showStatus('Assets ready. Launching...', 'success');
                        return true;
                    }
                }
                shouldDownload = true;
            }

            if (!shouldDownload) return true;

            // 3. Download and extract
            if (assetProgressTitle) assetProgressTitle.textContent = getTranslation('mv_progress_download').replace('{version}', latestTag);
            openModal(assetProgressModal);

            const downloadExtractResult = await window.go.main.App.DownloadAndExtractAssets(zipballUrl, latestTag);
            if (!downloadExtractResult.success) {
                closeModal(assetProgressModal);
                showStatus('Failed to download assets: ' + (downloadExtractResult.error || 'Unknown error'), 'error');
                return false;
            }

            // 4. Prompt to install
            closeModal(assetProgressModal);
            if (installPromptVersion) installPromptVersion.textContent = latestTag;
            const installBodyEl = document.getElementById('assetInstallPromptText');
            if (installBodyEl) installBodyEl.innerHTML = getTranslation('mv_install_body').replace('{version}', latestTag);
            const installChoice = await new Promise(resolve => {
                btnInstallYes.onclick = () => { closeModal(assetInstallPromptModal); resolve(true); };
                btnInstallNo.onclick = () => { closeModal(assetInstallPromptModal); resolve(false); };
                openModal(assetInstallPromptModal);
            });

            if (!installChoice) return false; // user chose not to install, stop launch

            // 5. Register APPX
            showStatus('Registering APPX...', 'info');
            const registerResult = await registerWithProgress();
            if (!registerResult.success) {
                showStatus('Failed to register APPX: ' + (registerResult.error || 'Unknown error'), 'error');
                // Registration failure may have uninstalled the game — offer to reinstall from Store
                if (mcNotInstalledModal) openModal(mcNotInstalledModal);
                return false;
            }

            // 6. Update version tracking
            const saved = await window.go.main.App.SaveInstalledAssetVersion(latestTag);
            if (!saved.success) {
                console.error('Failed to save installed asset version');
            }

            showStatus('Assets ready. Launching...', 'success');
            return true;
        } catch (e) {
            console.error('Manage versions error:', e);
            showStatus('Asset management error: ' + e.message, 'error');
            return false;
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
            const skip = appSettings.skip_inject_warning === true;
            if (skip) {
                manualLaunchWaiting = false;
                // Validate DLL even in this path
                if (!await validateDLLBeforeLaunch()) { openModal(invalidDllModal); return; }
                await performInject(true);
            } else {
                openModal(manualInjectModal);
            }
            return;
        }

        // Validate DLL before any launch flow
        if (!await validateDLLBeforeLaunch()) {
            openModal(invalidDllModal);
            return;
        }

        // Manage Versions workflow (if enabled)
        if (manageVersionsToggle && manageVersionsToggle.checked) {
            const canProceed = await manageVersionsFlow();
            if (!canProceed) return; // cancelled or failed
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
            appSettings.skip_inject_warning = true;
            saveSettingsToBackend();
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
                    validateDLLBeforeLaunch().then(ok => {
                        if (!ok) { openModal(invalidDllModal); return; }
                        performInject(true /* skipLaunch since it's already running */);
                    });
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
            
            const lang = appSettings.language || 'es';
            
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

    // ── Minecraft Not Installed Dialog ──────────────────────
    // Install directly from GitHub assets (reuses the asset download + register flow)
    async function installMinecraftFromAssets() {
        showStatus('Checking assets...', 'info');
        try {
            if (!window.go || !window.go.main || !window.go.main.App || typeof window.go.main.App.GetLatestAssetRelease !== 'function') {
                showStatus('Asset management is not available. Rebuild the app to enable it.', 'error');
                return false;
            }

            const release = await window.go.main.App.GetLatestAssetRelease();
            if (!release.success) {
                const errMsg = release.error || 'Unknown error';
                showStatus('Failed to get asset release: ' + errMsg, 'error');
                return false;
            }

            const latestTag = release.tag_name;
            const zipballUrl = release.zipball_url;

            // Download and extract
            if (assetProgressTitle) assetProgressTitle.textContent = getTranslation('mv_progress_download').replace('{version}', latestTag);
            openModal(assetProgressModal);

            const downloadResult = await window.go.main.App.DownloadAndExtractAssets(zipballUrl, latestTag);
            if (!downloadResult.success) {
                closeModal(assetProgressModal);
                showStatus('Failed to download assets: ' + (downloadResult.error || 'Unknown error'), 'error');
                return false;
            }

            closeModal(assetProgressModal);

            // Register APPX
            showStatus('Registering APPX...', 'info');
            const registerResult = await registerWithProgress();
            if (!registerResult.success) {
                showStatus('Failed to register APPX: ' + (registerResult.error || 'Unknown error'), 'error');
                return false;
            }

            // Save installed version
            await window.go.main.App.SaveInstalledAssetVersion(latestTag);

            showStatus('Minecraft 0.15.10 installed successfully!', 'success');
            return true;
        } catch (e) {
            console.error('Install from assets error:', e);
            showStatus('Install error: ' + e.message, 'error');
            return false;
        }
    }

    if (btnInstallMinecraft) {
        btnInstallMinecraft.addEventListener('click', async () => {
            closeModal(mcNotInstalledModal);
            const success = await installMinecraftFromAssets();
            if (success) {
                checkMinecraftVersion();
            }
        });
    }
    if (btnCancelInstall) {
        btnCancelInstall.addEventListener('click', () => {
            closeModal(mcNotInstalledModal);
        });
    }

    // ── Manage Versions – Unsupported Version Dialog ──────────
    if (btnUnsupportedOk) {
        btnUnsupportedOk.addEventListener('click', () => {
            closeModal(unsupportedVersionModal);
        });
    }

    // ── Manage Versions – Asset Progress Events ──────────────
    window.runtime.EventsOn('asset:download-progress', (data) => {
        if (!assetProgressFill || !assetProgressPercent || !assetProgressSpeed || !assetProgressSize || !assetProgressTime) return;
        const pct = data.percentage || 0;
        assetProgressFill.style.width = `${pct}%`;
        assetProgressPercent.textContent = `${Math.round(pct)}%`;
        assetProgressSpeed.textContent = `${data.speed ? data.speed.toFixed(1) : '0.0'} Mbps`;

        if (data.total > 0) {
            const downloadedMB = (data.downloaded / (1024 * 1024)).toFixed(1);
            const totalMB = (data.total / (1024 * 1024)).toFixed(1);
            assetProgressSize.textContent = `${downloadedMB} / ${totalMB} MB`;
        }

        // Estimate remaining time
        if (data.speed > 0 && data.total > 0) {
            const remainingBytes = data.total - data.downloaded;
            const remainingSecs = remainingBytes / (data.speed * 1000000 / 8);
            if (remainingSecs > 0 && remainingSecs < 3600) {
                const mins = Math.floor(remainingSecs / 60);
                const secs = Math.floor(remainingSecs % 60);
                assetProgressTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            } else {
                assetProgressTime.textContent = '--:--';
            }
        }
    });

    window.runtime.EventsOn('asset:extract-progress', (data) => {
        if (!assetProgressFill || !assetProgressPercent || !assetProgressSize) return;
        const pct = data.percentage || 0;
        assetProgressFill.style.width = `${pct}%`;
        assetProgressPercent.textContent = `${Math.round(pct)}%`;
        if (assetProgressTitle) assetProgressTitle.textContent = getTranslation('mv_progress_extract');
        assetProgressSize.textContent = `${data.extracted} / ${data.total} files`;
        if (assetProgressSpeed && data.speed) {
            assetProgressSpeed.textContent = `${data.speed.toFixed(1)} files/s`;
        }
    });

    window.runtime.EventsOn('asset:register-progress', (data) => {
        if (!assetProgressFill || !assetProgressPercent) return;
        const pct = data.percent || 0;
        assetProgressFill.style.width = `${pct}%`;
        assetProgressPercent.textContent = `${Math.round(pct)}%`;
        if (assetProgressTitle) assetProgressTitle.textContent = data.message || 'Registering...';
        if (assetProgressSpeed) assetProgressSpeed.textContent = '';
        if (assetProgressSize) assetProgressSize.textContent = '';
        if (assetProgressTime) assetProgressTime.textContent = '';
    });

    // ── Register APPX with visible progress modal ────────────
    // Shows the assetProgressModal with a smooth fake progress bar while
    // the PowerShell registration runs (which can take 5–20 s).
    async function registerWithProgress() {
        if (assetProgressTitle) assetProgressTitle.textContent = 'Registering package...';
        if (assetProgressFill) assetProgressFill.style.width = '0%';
        if (assetProgressPercent) assetProgressPercent.textContent = '0%';
        if (assetProgressSpeed) assetProgressSpeed.textContent = '';
        if (assetProgressSize) assetProgressSize.textContent = '';
        if (assetProgressTime) assetProgressTime.textContent = '';
        openModal(assetProgressModal);

        // Smooth fake progress: creep from 0 → 45% while waiting for the backend
        // Real events from Go will override this once they arrive.
        let fakeProgress = 0;
        const fakeInterval = setInterval(() => {
            if (fakeProgress < 45) {
                fakeProgress += 1;
                if (assetProgressFill) assetProgressFill.style.width = `${fakeProgress}%`;
                if (assetProgressPercent) assetProgressPercent.textContent = `${fakeProgress}%`;
            }
        }, 300);

        try {
            const result = await window.go.main.App.RegisterAssetsAppx();
            clearInterval(fakeInterval);
            // Jump to 100% briefly so the user sees completion
            if (assetProgressFill) assetProgressFill.style.width = '100%';
            if (assetProgressPercent) assetProgressPercent.textContent = '100%';
            await new Promise(resolve => setTimeout(resolve, 600));
            closeModal(assetProgressModal);
            return result;
        } catch (e) {
            clearInterval(fakeInterval);
            closeModal(assetProgressModal);
            throw e;
        }
    }

    // ── Modal Helpers ────────────────────────────────────────
    function openModal(el) { el.classList.add('active'); }
    function closeModal(el) { el.classList.remove('active'); }

    // ── Invalid DLL Modal Buttons ────────────────────────────
    if (btnDllErrorSettings) {
        btnDllErrorSettings.addEventListener('click', () => {
            closeModal(invalidDllModal);
            openSettings();
        });
    }
    if (btnDllErrorRetry) {
        btnDllErrorRetry.addEventListener('click', async () => {
            closeModal(invalidDllModal);
            // Re-validate; if now OK, resume the launch
            if (await validateDLLBeforeLaunch()) {
                btnLaunch.click();
            } else {
                openModal(invalidDllModal);
            }
        });
    }

    // Settings
    function openSettings() {
        document.querySelectorAll('.sidebar-nav-item').forEach(b => {
            if (b.getAttribute('data-page') === 'settings') {
                b.click();
            }
        });
    }
    function closeSettingsModal() { /* Modal is now a page, no-op */ }

    // Expansion logic
    if (btnExpandUpdates) {
        btnExpandUpdates.addEventListener('click', () => {
            updateCheckerField.classList.toggle('field--open');
        });
    }

    // ── Window Controls ──────────────────────────────────────
    if (btnMinimize) btnMinimize.addEventListener('click', () => window.runtime.WindowMinimise());
    if (btnMaximize) btnMaximize.addEventListener('click', () => {
        window.runtime.WindowIsMaximised().then(isMax => {
            if (isMax) window.runtime.WindowUnmaximise();
            else window.runtime.WindowMaximise();
        });
    });
    if (btnClose) btnClose.addEventListener('click', () => window.runtime.Quit());

    // ── Settings Persistence ─────────────────────────────────
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

    if (btnDefaultDll) {
        btnDefaultDll.addEventListener('click', () => {
            customDllPath.value = '';
            showStatus('Default DLL selected. Save to apply.', 'info');
        });
    }

    function saveAllSettings() {
        appSettings.custom_dll = customDllPath.value.trim();
        appSettings.check_mara = checkMaraUpdate.checked;
        appSettings.check_dll = checkDllUpdate.checked;
        appSettings.auto_inject = autoInjectToggle.checked;
        appSettings.inject_cooldown = parseInt(injectCooldown.value) || 10;
        if (manageVersionsToggle) {
            appSettings.manage_versions = manageVersionsToggle.checked;
        }
        
        const autoGapToggle = document.getElementById('autoGapToggle');
        const autoGapSlider = document.getElementById('autoGapSlider');
        const fullBrightToggle = document.getElementById('fullBrightToggle');
        const shadersToggle = document.getElementById('shadersToggle');
        
        if (autoGapToggle) appSettings.tweaks_autogap = autoGapToggle.checked;
        if (autoGapSlider) appSettings.tweaks_autogap_intensity = parseInt(autoGapSlider.value, 10) || 32;
        if (fullBrightToggle) appSettings.tweaks_fullbright = fullBrightToggle.checked;
        if (shadersToggle) appSettings.tweaks_shaders = shadersToggle.checked;
        
        saveSettingsToBackend();
        showStatus('Settings saved!', 'success');
    }

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', saveAllSettings);
    }
    if (btnSaveSettingsAdv) {
        btnSaveSettingsAdv.addEventListener('click', saveAllSettings);
    }

    if (btnResetSettings) {
        btnResetSettings.addEventListener('click', () => {
            customDllPath.value = '';
            checkMaraUpdate.checked = true;
            checkDllUpdate.checked = true;
            autoInjectToggle.checked = false;
            injectCooldown.value = 10;
            if (manageVersionsToggle) {
                manageVersionsToggle.checked = false;
            }
            
            appSettings.custom_dll = '';
            appSettings.check_mara = true;
            appSettings.check_dll = true;
            appSettings.auto_inject = false;
            appSettings.inject_cooldown = 10;
            appSettings.manage_versions = false;
            
            saveSettingsToBackend();
            showStatus('Settings reset to default!', 'success');
        });
    }

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
        // Load settings from backend before initializing other views
        await loadSettingsFromBackend();

        try {
            const ver = await window.go.main.App.GetAppVersion();
            // Optional: put version somewhere
        } catch (e) {
            console.error('Failed to get app version:', e);
        }

        try {
            const username = await window.go.main.App.GetMinecraftUsername();
            if (username && playerNameDisplay) {
                playerNameDisplay.dataset.username = username;
                playerNameDisplay.innerHTML = `<span class="greeting-prefix">${getTranslation('welcome_msg').replace('{username}', '')}</span><span class="player-name-bold">${username}</span>`;
                const topUserName = document.querySelector('.user-name');
                if (topUserName) topUserName.textContent = username;
            }
        } catch(e) {
            console.error('Failed to get username:', e);
        }

        // Manage Versions – check game version on startup
        if (manageVersionsToggle && manageVersionsToggle.checked) {
            try {
                const verCheck = await window.go.main.App.CheckGameVersionSupported();
                if (!verCheck.supported) {
                    setTimeout(() => {
                        if (verCheck.not_installed) {
                            mcNotInstalledShown = true;
                            openModal(mcNotInstalledModal);
                        } else {
                            const body = document.querySelector('#unsupportedVersionModal .dialog-body');
                            if (body) body.innerHTML = getTranslation('mv_unsupported_body').replace('{version}', supportedGameVersion || '0.15.10');
                            openModal(unsupportedVersionModal);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error('Failed to check game version:', e);
            }
        }

        initSkinViewer();
        setTimeout(checkMinecraftVersion, 500);
    }

    // ── Texture Packs Logic ──────────────────────────────────
    const dragDropZone = document.getElementById('dragDropZone');
    const apkFileInput = document.getElementById('apkFileInput');
    const btnBrowseApk = document.getElementById('btnBrowseApk');
    const textureOptionsModal = document.getElementById('textureOptionsModal');
    const btnImportTexture = document.getElementById('btnImportTexture');
    const btnCancelTexture = document.getElementById('btnCancelTexture');
    const keepMainMenuToggle = document.getElementById('keepMainMenuToggle');
    const keepDefaultGuiToggle = document.getElementById('keepDefaultGuiToggle');
    
    const textureProgressModal = document.getElementById('textureProgressModal');
    const textureProgressFill = document.getElementById('textureProgressFill');
    const textureProgressPercent = document.getElementById('textureProgressPercent');
    const textureProgressSpeed = document.getElementById('textureProgressSpeed');
    const textureProgressSize = document.getElementById('textureProgressSize');

    const textureErrorModal = document.getElementById('textureErrorModal');
    const textureErrorText = document.getElementById('textureErrorText');
    const btnTextureErrorOk = document.getElementById('btnTextureErrorOk');
    const texturesList = document.getElementById('texturesList');

    let pendingApkPath = null;
    let pendingPackName = null;

    function openTextureOptions(packName) {
        pendingPackName = packName;
        pendingApkPath = packName ? null : pendingApkPath; // Keep apk path if packName is null
        
        const unmanagedWarning = document.getElementById('textureUnmanagedWarning');
        const customUIContainer = document.getElementById('applyCustomUIToggleContainer');
        const keepMainMenuContainer = keepMainMenuToggle ? keepMainMenuToggle.closest('.setting-item') : null;
        const keepDefaultGuiContainer = keepDefaultGuiToggle ? keepDefaultGuiToggle.closest('.setting-item') : null;
        
        if (appSettings.manage_versions === false) {
            if (unmanagedWarning) unmanagedWarning.style.display = 'block';
            if (customUIContainer) customUIContainer.style.display = 'flex';
            if (keepMainMenuContainer) keepMainMenuContainer.style.display = 'none';
            if (keepDefaultGuiContainer) keepDefaultGuiContainer.style.display = 'none';
        } else {
            if (unmanagedWarning) unmanagedWarning.style.display = 'none';
            if (customUIContainer) customUIContainer.style.display = 'none';
            if (keepMainMenuContainer) keepMainMenuContainer.style.display = 'flex';
            if (keepDefaultGuiContainer) keepDefaultGuiContainer.style.display = 'flex';
        }
        
        openModal(textureOptionsModal);
    }

    // Load imported packs into sidebar
    async function refreshImportedPacks() {
        if (!texturesList || !window.go || !window.go.main || !window.go.main.App || !window.go.main.App.GetImportedPacks) return;
        
        try {
            const packs = await window.go.main.App.GetImportedPacks();
            texturesList.innerHTML = '';
            
            if (!packs || packs.length === 0) {
                texturesList.innerHTML = '<li class="textures-list-empty">' + getTranslation('textures_empty') + '</li>';
                return;
            }

            packs.forEach(pack => {
                const li = document.createElement('li');
                
                // Add icon if it exists
                if (pack.icon) {
                    const img = document.createElement('img');
                    img.src = pack.icon;
                    img.className = 'pack-icon';
                    li.appendChild(img);
                } else {
                    const div = document.createElement('div');
                    div.className = 'pack-icon';
                    li.appendChild(div);
                }
                
                const span = document.createElement('span');
                span.textContent = pack.name;
                li.appendChild(span);
                
                // Click to apply
                li.addEventListener('click', () => {
                    openTextureOptions(pack.name);
                });
                
                texturesList.appendChild(li);
            });
        } catch (e) {
            console.error("Failed to load imported packs", e);
        }
    }

    function handleApkPath(path) {
        if (!path) return;
        if (path.toLowerCase().endsWith('.apk')) {
            pendingApkPath = path;
            openTextureOptions(null);
        } else {
            showTextureError("Please select a valid .apk file");
        }
    }

    if (dragDropZone) {
        dragDropZone.addEventListener('click', async (e) => {
            // Ignore clicks that originate from the inner browse button (handled separately)
            if (e.target.closest('#btnBrowseApk')) return;
            if (!window.go || !window.go.main || !window.go.main.App) return;
            try {
                const path = await window.go.main.App.SelectAPK();
                if (path) handleApkPath(path);
            } catch (err) {
                showTextureError("Could not get file path.");
            }
        });

        dragDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            dragDropZone.classList.add('dragover');
        });

        dragDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDropZone.classList.remove('dragover');
        });

        dragDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDropZone.classList.remove('dragover');
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length > 0) {
                handleApkPath(files[0].path || files[0].name);
            } else if (window.go && window.go.main && window.go.main.App) {
                // Fallback to backend dialog if browser DnD yields no path
                window.go.main.App.SelectAPK().then(p => p && handleApkPath(p)).catch(() => {});
            }
        });
    }

    if (btnBrowseApk && apkFileInput) {
        btnBrowseApk.addEventListener('click', (e) => {
            e.stopPropagation();
            apkFileInput.click();
        });
        apkFileInput.addEventListener('change', () => {
            if (apkFileInput.files && apkFileInput.files.length > 0) {
                handleApkPath(apkFileInput.files[0].path || apkFileInput.files[0].name);
            }
            apkFileInput.value = '';
        });
    }

    if (btnCancelTexture) {
        btnCancelTexture.addEventListener('click', () => {
            closeModal(textureOptionsModal);
            pendingApkPath = null;
            pendingPackName = null;
        });
    }

    if (btnImportTexture) {
        btnImportTexture.addEventListener('click', async () => {
            closeModal(textureOptionsModal);
            
            if (!pendingApkPath && !pendingPackName) return;

            const keepMainMenu = keepMainMenuToggle ? keepMainMenuToggle.checked : true;
            const keepDefaultGui = keepDefaultGuiToggle ? keepDefaultGuiToggle.checked : true;

            // Reset progress UI
            if (textureProgressFill) textureProgressFill.style.width = '0%';
            if (textureProgressPercent) textureProgressPercent.textContent = '0%';
            if (textureProgressSpeed) textureProgressSpeed.textContent = '0 MB/s';
            if (textureProgressSize) textureProgressSize.textContent = '0 / 0 files';
            
            const titleEl = document.getElementById('textureProgressTitle');
            if (titleEl) {
                titleEl.textContent = pendingApkPath ? 'Extracting texture pack...' : 'Applying texture pack...';
            }
            
            openModal(textureProgressModal);

            try {
                let packNameToApply = pendingPackName;
                
                // If importing a new APK, extract it first
                if (pendingApkPath) {
                    const extractResult = await window.go.main.App.ExtractTexturePackFromAPK(pendingApkPath);
                    if (!extractResult.success) {
                        throw new Error(extractResult.error || "Extraction failed");
                    }
                    packNameToApply = extractResult.packName;
                    
                    // Refresh sidebar to show newly imported pack
                    await refreshImportedPacks();
                    
                    // Reset progress for the next phase
                    if (titleEl) titleEl.textContent = 'Applying texture pack...';
                    if (textureProgressFill) textureProgressFill.style.width = '0%';
                    if (textureProgressPercent) textureProgressPercent.textContent = '0%';
                }
                
                const targetInstallLoc = (appSettings.manage_versions === false);
                const applyCustomUIToggle = document.getElementById('applyCustomUIToggle');
                const applyCustomUI = (targetInstallLoc && applyCustomUIToggle) ? applyCustomUIToggle.checked : false;

                // Apply the pack
                const applyResult = await window.go.main.App.ApplyTexturePack(packNameToApply, keepMainMenu, keepDefaultGui, targetInstallLoc, applyCustomUI);
                
                closeModal(textureProgressModal);
                
                if (applyResult && applyResult.success) {
                    showStatus("Texture pack applied successfully!", "success");
                } else {
                    showTextureError(applyResult.error || "Unknown error during apply");
                }
            } catch (err) {
                closeModal(textureProgressModal);
                showTextureError(err.message || err);
            }
            
            pendingApkPath = null;
            pendingPackName = null;
        });
    }

    function showTextureError(msg) {
        if (textureErrorText) textureErrorText.innerHTML = msg;
        openModal(textureErrorModal);
    }

    if (btnTextureErrorOk) {
        btnTextureErrorOk.addEventListener('click', () => {
            closeModal(textureErrorModal);
        });
    }

    // Progress event listener for texture extracting/applying
    function handleTextureProgress(data) {
        if (!textureProgressFill || !textureProgressPercent) return;
        
        const pct = data.percentage || 0;
        textureProgressFill.style.width = `${pct}%`;
        textureProgressPercent.textContent = `${Math.round(pct)}%`;
        
        if (textureProgressSize) {
            textureProgressSize.textContent = `${data.extracted || 0} / ${data.total || 0} files`;
        }
        
        if (textureProgressSpeed && data.speed !== undefined) {
            textureProgressSpeed.textContent = `${data.speed.toFixed(2)} MB/s`;
        }
    }
    
    window.runtime.EventsOn('texture:extract-progress', handleTextureProgress);
    window.runtime.EventsOn('texture:import-progress', handleTextureProgress);

    // Parallax background effect
    const bgImage = document.querySelector('.bg-image');
    if (bgImage) {
        document.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth / 2 - e.pageX) / 40;
            const y = (window.innerHeight / 2 - e.pageY) / 40;
            bgImage.style.setProperty('--px', `${x}px`);
            bgImage.style.setProperty('--py', `${y}px`);
        });
    }

    // --- Tweaks Logic ---
    const autoGapHeader = document.getElementById('autoGapHeader');
    const autoGapToggle = document.getElementById('autoGapToggle');
    const autoGapSettings = document.getElementById('autoGapSettings');
    const autoGapSlider = document.getElementById('autoGapSlider');
    const autoGapIntensityLabel = document.getElementById('autoGapIntensityLabel');

    if (autoGapHeader && autoGapToggle && autoGapSettings && autoGapSlider) {
        autoGapHeader.addEventListener('click', (e) => {
            if (e.target !== autoGapToggle) {
                autoGapToggle.checked = !autoGapToggle.checked;
                autoGapToggle.dispatchEvent(new Event('change'));
            }
        });

        autoGapToggle.addEventListener('change', async () => {
            if (autoGapToggle.checked) {
                autoGapSettings.classList.add('active');
            } else {
                autoGapSettings.classList.remove('active');
            }
        });

        // Slider real-time update label
        autoGapSlider.addEventListener('input', () => {
            autoGapIntensityLabel.textContent = autoGapSlider.value;
        });

        const shadersHeader = document.getElementById('shadersHeader');
        const shadersToggle = document.getElementById('shadersToggle');

        if (shadersHeader && shadersToggle) {
            shadersHeader.addEventListener('click', (e) => {
                if (e.target !== shadersToggle) {
                    shadersToggle.checked = !shadersToggle.checked;
                    shadersToggle.dispatchEvent(new Event('change'));
                }
            });
        }

        const fullBrightHeader = document.getElementById('fullBrightHeader');
        const fullBrightToggle = document.getElementById('fullBrightToggle');

        if (fullBrightHeader && fullBrightToggle) {
            fullBrightHeader.addEventListener('click', (e) => {
                if (e.target !== fullBrightToggle) {
                    fullBrightToggle.checked = !fullBrightToggle.checked;
                    fullBrightToggle.dispatchEvent(new Event('change'));
                }
            });
        }

        function showToast(message, type = "success") {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            const icon = type === 'success' 
                ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
            
            toast.innerHTML = `
                ${icon}
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: white; font-size: 15px;">${type === 'success' ? 'Success!' : 'Error'}</strong>
                    <span style="color: rgba(255,255,255,0.7); font-size: 13px;">${message}</span>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.transform = 'translateY(0) translateX(-50%)';
                toast.style.opacity = '1';
            }, 10);
            
            setTimeout(() => {
                toast.style.transform = 'translateY(-20px) translateX(-50%)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        const btnApplyTweaks = document.getElementById('btnApplyTweaks');
        if (btnApplyTweaks) {
            btnApplyTweaks.addEventListener('click', async () => {
                const prevHtml = btnApplyTweaks.innerHTML;
                btnApplyTweaks.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Applying...`;
                btnApplyTweaks.disabled = true;
                
                let success = false;
                try {
                    success = await applyTweaks();
                } finally {
                    if (success) {
                        btnApplyTweaks.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Applied!`;
                    } else {
                        btnApplyTweaks.innerHTML = prevHtml;
                    }
                    setTimeout(() => {
                        btnApplyTweaks.innerHTML = prevHtml;
                        btnApplyTweaks.disabled = false;
                    }, 2000);
                }
            });
        }

        async function applyTweaks() {
            try {
                showStatus("Applying tweaks...", "running");
                
                // Apply AutoGap
                const agEnabled = autoGapToggle.checked;
                const agIntensity = parseInt(autoGapSlider.value, 10);
                const agRes = await window.go.main.App.ApplyAutoGap(agEnabled, agIntensity);
                
                // Apply Full Bright
                let fbRes = {success: true};
                if (fullBrightToggle && window.go.main.App.ApplyFullBright) {
                    const fbEnabled = fullBrightToggle.checked;
                    fbRes = await window.go.main.App.ApplyFullBright(fbEnabled);
                } else if (!window.go.main.App.ApplyFullBright) {
                    console.warn("ApplyFullBright is not available in the backend.");
                }

                // Apply Shaders
                let shRes = {success: true};
                if (shadersToggle && window.go.main.App.ApplyShaders) {
                    const shEnabled = shadersToggle.checked;
                    shRes = await window.go.main.App.ApplyShaders(shEnabled);
                } else if (!window.go.main.App.ApplyShaders) {
                    console.warn("ApplyShaders is not available in the backend.");
                }

                if (agRes && agRes.success && fbRes && fbRes.success && shRes && shRes.success) {
                    
                    let needsRegister = (agRes.needs_register || shRes.needs_register) && appSettings.manage_versions;
                    if (needsRegister) {
                        const isRegistered = await window.go.main.App.IsAppxRegisteredToAssets();
                        if (!isRegistered) {
                            showStatus("Registering changes...", "running");
                            const reg = await registerWithProgress();
                            if (!reg.success) {
                                showStatus("Tweaks applied but registration failed: " + reg.error, "error");
                                showToast("Registration failed", "error");
                                return false;
                            }
                        }
                    }

                    // Save tweak states to backend
                    appSettings.tweaks_autogap = agEnabled;
                    appSettings.tweaks_autogap_intensity = agIntensity;
                    if (fullBrightToggle) appSettings.tweaks_fullbright = fullBrightToggle.checked;
                    if (shadersToggle) appSettings.tweaks_shaders = shadersToggle.checked;
                    saveSettingsToBackend();

                    showStatus("Tweaks applied successfully!", "success");
                    showToast("Tweaks applied successfully!", "success");
                    return true;
                } else {
                    let errs = [];
                    if (agRes && !agRes.success) errs.push("AutoGap: " + agRes.error);
                    if (fbRes && !fbRes.success) errs.push("FullBright: " + fbRes.error);
                    if (shRes && !shRes.success) errs.push("Shaders: " + shRes.error);
                    showStatus("Failed to apply tweaks: " + errs.join(", "), "invalid");
                    showToast("Failed to apply tweaks", "error");
                    return false;
                }
            } catch(e) {
                showStatus("Error applying tweaks: " + e, "invalid");
                showToast(e.toString(), "error");
                return false;
            }
        }
    }

    boot();
    // Also load imported packs on boot
    refreshImportedPacks();
});
