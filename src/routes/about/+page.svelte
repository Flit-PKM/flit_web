<script lang="ts">
	import { resolve } from '$app/paths';
	// About page - generic content
</script>

<svelte:head>
	<title>About - Flit Web</title>
</svelte:head>

<h1>About Flit-PKM</h1>
<div class="card">
	<div class="prose">
		<p class="section-title">Your Private Second Brain — Secure, Connected, Enhanced.</p>
		<section>
			<h2>What is Flit?</h2>
			<p>
				Flit is your modern Personal Knowledge Management (PKM) ecosystem — a private, secure space
				where your notes, insights, and daily reflections come together with powerful AI to help you
				think deeper and discover more.
				<br />Imagine your thoughts no longer scattered: Flit blends effortless note-taking with
				smart AI that summarizes, connects ideas, and uncovers hidden patterns and fresh insights
				you might never have spotted on your own. It's built for people who want their knowledge to
				feel alive, organized, and truly theirs.
			</p>
		</section>

		<section>
			<h2>Our Mission</h2>
			<p>
				We believe your knowledge should be connected, effortless to navigate, and completely under
				your control. Flit empowers you to build a growing personal knowledge base with intuitive
				tools for linking ideas, organizing thoughts, and revealing meaningful insights — all while
				keeping everything 100% private.<br />
				Our connected apps make it even better:
			</p>
			<ul class="card__meta">
				<li>Flit-App — Capture notes and ideas anytime, anywhere.</li>
				<li>
					Still — Elegant meditation timer and journaling to track sessions, set intentions, and
					reflect deeply.
				</li>
				<li>And more on the way soon...</li>
			</ul>
			<br />
			<p>
				Together, they bridge the different parts of your life — work, wellness, creativity — into
				one unified, private second brain that evolves with you.
			</p>
		</section>

		<section>
			<h2>Features</h2>
			<ul class="card__meta">
				<li>
					<svg class="icon_sm link--primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Fortress-Level Security</span>
				</li>
				<li>
					<svg class="icon_sm link--primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Connected Knowledge Graph</span>
				</li>
				<li>
					<svg class="icon_sm link--primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>AI-Powered Insights</span>
				</li>
				<li>
					<svg class="icon_sm link--primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Export & Import Freedom</span>
				</li>
				<li>
					<svg class="icon_sm link--primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Seamless Sync & Backup</span>
				</li>
			</ul>
		</section>

		<section>
			<h2>Contact</h2>
			<p>
				Questions, feedback, ideas, or just want to say hi?<br />
				Visit us at
				<a href="https://bmd-studios.com" target="_blank" rel="noopener noreferrer">BMD-Studios</a>
				or drop an email to admin @ bmd-studios . com<br />
				We'd love to hear from you!
			</p>
		</section>
		<br />
		<hr />
		<div>
			<a href={resolve('/')} class="link">← Back to Home</a>
		</div>
	</div>
</div>
