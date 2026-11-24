import { BadRequestError } from './errors';

/** Read a required route param; `noUncheckedIndexedAccess` types them as optional. */
export const param = (
  req: { params: Record<string, string | undefined> },
  name: string,
): string => {
  const value = req.params[name];
  if (!value) throw new BadRequestError(`Missing route parameter: ${name}`);
  return value;
};
