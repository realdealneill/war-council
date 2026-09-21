import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) throw new Error("VITE_CONVEX_URL is not set — check .env.local");

export const convex = new ConvexReactClient(url);
