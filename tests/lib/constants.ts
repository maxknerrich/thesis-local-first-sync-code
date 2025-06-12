export const NETWORK_PROFILES = {
	"Fiber FTTC": { latency: 15, downloadThroughput: 90, uploadThroughput: 10 },
	"4G": { latency: 60, downloadThroughput: 10, uploadThroughput: 5 },
	"3G": { latency: 150, downloadThroughput: 2.5, uploadThroughput: 0.25 },
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
		downloadThroughput: (profile.downloadThroughput * 1024 * 1024) / 8,
		uploadThroughput: (profile.uploadThroughput * 1024 * 1024) / 8,
		latency: profile.latency,
	};
}
