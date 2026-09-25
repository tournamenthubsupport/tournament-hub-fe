type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

const asMessage = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  const candidate = error as {
    message?: unknown;
    response?: { data?: ApiErrorPayload | string };
  };
  const responseData = candidate?.response?.data;

  if (typeof responseData === 'string') {
    return asMessage(responseData) || fallback;
  }

  const responseMessage =
    asMessage(responseData?.error) ||
    asMessage(responseData?.message) ||
    asMessage(responseData?.details);
  if (responseMessage) return responseMessage;

  const directMessage = asMessage(candidate?.message);
  if (!directMessage || directMessage === 'Network Error' || directMessage === 'Failed to fetch') {
    return 'Unable to connect to the server. Check your connection and try again.';
  }

  return directMessage;
}

export async function throwApiResponseError(
  response: Response,
  fallback = 'The request failed. Please try again.',
): Promise<never> {
  let payload: ApiErrorPayload | string | undefined;

  try {
    const responseText = await response.text();
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  } catch {
    payload = undefined;
  }

  const message =
    typeof payload === 'string'
      ? asMessage(payload)
      : asMessage(payload?.error) || asMessage(payload?.message) || asMessage(payload?.details);

  throw new Error(message || fallback);
}

export async function fetchApiJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback?: string,
): Promise<T> {
  try {
    const response = await fetch(input, init);
    if (!response.ok) {
      return await throwApiResponseError(response, fallback);
    }
    return await response.json();
  } catch (error) {
    throw new Error(getApiErrorMessage(error, fallback));
  }
}
