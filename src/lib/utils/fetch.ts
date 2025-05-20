import { tryCatch } from './index';

type FetchError<E> = NetworkError | HttpError<E> | ParseError;

interface NetworkError {
	type: 'network';
	error: Error;
}
interface DataNotArrayError {
	type: 'data-not-array';
	error: Error;
}

interface HttpError<E = unknown> {
	type: 'http';
	status: number;
	headers: Headers;
	json?: E;
}

interface ParseError {
	type: 'parse';
	error: Error;
}

type Result<T, E> = { data: T; error: null } | { data: null; error: E };

export async function safeFetch<T = unknown, E = unknown>(
	input: URL | string,
	init?: RequestInit,
): Promise<Result<T, FetchError<E>>> {
	const { data, error } = await tryCatch<Response, NetworkError>(
		fetch(input, init),
	);
	if (error) {
		return { data: null, error }; // error is already of type NetworkError
	}
	if (!data.ok) {
		return {
			data: null,
			error: {
				type: 'http',
				status: data.status,
				headers: data.headers,
			} as HttpError<E>,
		};
	}
	const { data: json, error: parseError } = await tryCatch(data.json());
	if (parseError) {
		return {
			data: null,
			error: {
				type: 'parse',
				error: parseError,
			} as ParseError,
		};
	}
	return { data: json as T, error: null };
}

export async function paginatedFetch<T extends unknown[], E = unknown>(
	input: URL | string,
	init?: RequestInit,
	previousData = [] as unknown as T,
): Promise<Result<T, FetchError<E> | DataNotArrayError>> {
	const nextPattern = /(?<=<)([\S]*)(?=>; rel="Next")/i;
	const { data, error } = await tryCatch<Response, NetworkError>(
		fetch(input, init),
	);
	if (error) {
		return { data: null, error }; // error is already of type NetworkError
	}
	if (!data.ok) {
		return {
			data: null,
			error: {
				type: 'http',
				status: data.status,
				headers: data.headers,
			} as HttpError<E>,
		};
	}
	const { data: json, error: parseError } = await tryCatch(data.json());
	if (parseError) {
		return {
			data: null,
			error: {
				type: 'parse',
				error: parseError,
			} as ParseError,
		};
	}
	if (!Array.isArray(json)) {
		return {
			data: null,
			error: {
				type: 'data-not-array',
				error: new Error('Data is not an Array'),
			} as DataNotArrayError,
		};
	}
	const linkHeader = data.headers.get('Link');
	const newData = [...previousData, ...json] as T;
	const url = linkHeader?.match(nextPattern)?.[0];
	if (!url) {
		return { data: newData, error: null };
	}
	return paginatedFetch<T, E>(url, init, newData);
}
