import axios from "axios";

const raw = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const baseURL = raw.replace(/\/+$/, ""); // trim trailing slash

export const api = axios.create({ baseURL });
