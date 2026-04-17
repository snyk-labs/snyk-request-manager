class BadInputError extends Error {
  constructor(message: unknown) {
    const text = typeof message === 'string' ? message : String(message ?? '');
    super(text);
    this.name = 'BadInputError';
    this.message = text;
  }
}

export { BadInputError };
