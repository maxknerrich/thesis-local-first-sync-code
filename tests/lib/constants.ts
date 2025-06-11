export const NETWORK_PROFILES = {
  "DSL": { latency: 30, download: 25, upload: 5 },
  "Good 4G": { latency: 60, download: 15, upload: 8 },
  "Bad 4G": { latency: 120, download: 5, upload: 2 },
  "3G": { latency: 300, download: 0.75, upload: 0.25 },
};

export const USE_CASES = [
  "UC1: First Load (10 issues)",
  "UC2: Read (10 issues)",
  "UC3: Small Write",
  "UC4: Read -> Update",
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
