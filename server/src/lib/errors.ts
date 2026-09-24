/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const notFound = (message = 'Not found.', code?: string) => new HttpError(404, message, code);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);
