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

	/** Google Identity Services (https://accounts.google.com/gsi/client) */
	interface GoogleCredentialResponse {
		credential: string;
		select_by?: string;
	}

	interface GoogleAccountsId {
		initialize: (config: {
			client_id: string;
			callback: (response: GoogleCredentialResponse) => void;
			auto_select?: boolean;
			cancel_on_tap_outside?: boolean;
		}) => void;
		renderButton: (
			parent: HTMLElement,
			options: Record<string, string | number | boolean | undefined>
		) => void;
		prompt: (momentNotification?: (notification: unknown) => void) => void;
		cancel: () => void;
	}

	interface Window {
		google?: {
			accounts: {
				id: GoogleAccountsId;
			};
		};
	}
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_TURNSTILE_SITE_KEY?: string;
	/** OAuth 2.0 Web client ID for Sign In With Google (GIS); optional */
	readonly VITE_GOOGLE_CLIENT_ID?: string;
}

// Used for Vite client typings (import.meta.env)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export {};
