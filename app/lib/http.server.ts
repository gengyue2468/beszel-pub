import axios, { AxiosError, type AxiosInstance, type CreateAxiosDefaults } from "axios";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function createHttpClient(
  baseURL: string,
  config?: CreateAxiosDefaults,
): AxiosInstance {
  const client = axios.create({
    baseURL: baseURL.replace(/\/$/, ""),
    headers: { "Content-Type": "application/json" },
    ...config,
  });

  client.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
      const status = error.response?.status;
      const body = error.response?.data;
      const detail =
        typeof body === "string" ? body : body ? JSON.stringify(body) : error.message;
      throw new HttpError(`HTTP ${status ?? "error"}: ${detail}`, status, body);
    },
  );

  return client;
}

export function setAuthToken(client: AxiosInstance, token: string) {
  client.defaults.headers.common.Authorization = token;
}
