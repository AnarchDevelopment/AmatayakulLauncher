export namespace main {
	
	export class AppConfig {
	    language: string;
	    custom_dll: string;
	    auto_inject: boolean;
	    inject_cooldown: number;
	    check_mara: boolean;
	    check_dll: boolean;
	    skip_inject_warning: boolean;
	    manage_versions: boolean;
	    installed_asset_version: string;
	    tweaks_autogap: boolean;
	    tweaks_autogap_intensity: number;
	    tweaks_fullbright: boolean;
	    tweaks_shaders: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	        this.custom_dll = source["custom_dll"];
	        this.auto_inject = source["auto_inject"];
	        this.inject_cooldown = source["inject_cooldown"];
	        this.check_mara = source["check_mara"];
	        this.check_dll = source["check_dll"];
	        this.skip_inject_warning = source["skip_inject_warning"];
	        this.manage_versions = source["manage_versions"];
	        this.installed_asset_version = source["installed_asset_version"];
	        this.tweaks_autogap = source["tweaks_autogap"];
	        this.tweaks_autogap_intensity = source["tweaks_autogap_intensity"];
	        this.tweaks_fullbright = source["tweaks_fullbright"];
	        this.tweaks_shaders = source["tweaks_shaders"];
	    }
	}

}

