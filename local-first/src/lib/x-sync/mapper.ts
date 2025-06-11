import type { WriteLogEntry } from './entry';

type ToLocalEntry<T> = {
	meta: {
		remote_id: number;
		created_at: Date;
		updated_at: Date;
	};
	data: T;
};

export type Mapper<DB> = {
	to_local: {
		[key: string]: (
			// biome-ignore lint/suspicious/noExplicitAny: <Libary>
			data: any,
		) => Promise<ToLocalEntry<unknown>> | ToLocalEntry<unknown>;
	};
	to_remote: {
		// biome-ignore lint/suspicious/noExplicitAny: <Libary>
		[key: string]: (data: any) => unknown;
	};
	api: Partial<{
		// Now tables are optional - only include the ones we implement
		[K in keyof DB]: {
			// biome-ignore lint/suspicious/noExplicitAny: <Libary>
			[M in WriteLogEntry['method']]: (data: any) => Promise<unknown>;
		};
	}>;
};
