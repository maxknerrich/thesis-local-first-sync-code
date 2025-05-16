import { type } from 'arktype';
import { err, ok } from 'neverthrow';

export function safeParse(schema: type) {
	return (data: unknown) => {
		const out = schema(data);
		if (out instanceof type.errors) {
			return err({ type: 'arktype', errors: out.summary });
		}
		return ok(out);
	};
}
