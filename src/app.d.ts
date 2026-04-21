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

// Used for Vite client typings (import.meta.env)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
