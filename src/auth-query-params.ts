/** Parse OAuth redirect URLs (query + hash). Mirrors former expo-auth-session QueryParams helper. */
export function getAuthQueryParams(input: string): {
  errorCode: string | null;
  params: Record<string, string>;
} {
  const url = new URL(input, 'https://phony.example');

  const errorCode = url.searchParams.get('errorCode');
  url.searchParams.delete('errorCode');

  const params = Object.fromEntries(url.searchParams);

  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }

  return {
    errorCode,
    params,
  };
}

export function getAuthCallbackErrorMessage(url: string): string | null {
  const { params, errorCode } = getAuthQueryParams(url);
  if (errorCode) {
    return errorCode;
  }

  const description = params.error_description?.trim();
  if (description) {
    return description;
  }

  const error = params.error?.trim();
  if (error) {
    const code = params.error_code?.trim();
    return code ? `${error} (${code})` : error;
  }

  const code = params.error_code?.trim();
  return code ?? null;
}
