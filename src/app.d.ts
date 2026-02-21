// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface TurnstileInstance {
		reset: (widgetId?: string) => void;
	}

	// Injected by Cloudflare Turnstile script
	declare var turnstile: TurnstileInstance | undefined;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
