export const NETWORK_PROFILES = {
	"Fiber FTTC": { latency: 15, download: 100, upload: 10 },
	"4G": { latency: 60, download: 15, upload: 8 },
	"3G": { latency: 300, download: 0.75, upload: 0.25 },
};

export const ISSUE_COUNTS = [10, 50, 250];

export const RUNS_PER_TEST = 5;

export const APPS = [
	{
		name: "local-first",
		use: {
			baseURL: "http://localhost:5173", // Port for local-first app
		},
	},
	{
		name: "ssr",
		use: {
			baseURL: "http://localhost:4173", // Port for SSR app
		},
	},
];

export function getNetworkProfile(name: keyof typeof NETWORK_PROFILES) {
	const profile = NETWORK_PROFILES[name];
	return {
		offline: false,
		downloadThroughput: (profile.download * 1024 * 1024) / 8,
		uploadThroughput: (profile.upload * 1024 * 1024) / 8,
		latency: profile.latency,
	};
}
