import { errAsync, ResultAsync } from 'neverthrow';

type FetchError<E> = NetworkError | HttpError<E> | ParseError;

interface NetworkError {
	type: 'network';
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

export function safeFetch<T = unknown, E = unknown>(
	input: URL | string,
	init?: RequestInit,
): ResultAsync<T, FetchError<E>> {
	// Think of `fromPromise` like an entry point where unsafe code enters
	return ResultAsync.fromPromise(
		fetch(input, init),
		(error): NetworkError => ({
			type: 'network',
			error: error instanceof Error ? error : new Error(String(error)),
		}),
	).andThen((response) => {
		// It's a response but not 2XX
		if (!response.ok) {
			// Parse the JSON as it might contain some useful info
			return ResultAsync.fromSafePromise(
				// Since we don't care about parse errors we can use `fromSafePromise`
				// and just add a catch, which suppresses JSON parse errors
				response
					.json()
					.catch(() => undefined),
			).andThen((json) =>
				errAsync<T, FetchError<E>>({
					type: 'http',
					status: response.status,
					headers: response.headers,
					json: json as E,
				}),
			);
		}

		// Response is 2XX - return the parsed JSON with an assigned optional type
		return ResultAsync.fromPromise(
			response.json() as Promise<T>,
			(error): ParseError => ({
				type: 'parse',
				error: error instanceof Error ? error : new Error(String(error)),
			}),
		);
	});
}
