// Endereço da API. Configure em frontend/.env com VITE_API_URL (veja frontend/.env.example).
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3333").replace(/\/+$/, "");
