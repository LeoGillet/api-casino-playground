import { serve } from "bun";

import {
  createUser,
  getBalance,
  getGameStats,
  getGlobalStats,
  updateBalanceWithHistory,
  updateStats,
  getAllTimeBalanceRankings,
  getAllTimePlayedRankings
} from "../db/database.js";
import { checkToken, checkValidBet } from "../user/user.js";
import { playCoinflip } from "../games/coinflip.js";

function logRequest(req) {
  const { method, url, headers } = req;
  const ip = headers.get("x-forwarded-for") || req.remoteAddress || "Unknown IP";

  // Parse query params if needed
  const urlObj = new URL(url, `http://${headers.get("host")}`);
  const queryParams = Object.fromEntries(urlObj.searchParams.entries());

  // Log the request details
  console.log(`[${new Date().toISOString()}] [${method}] [${ip}] Sent request to ${url}`);
  console.log(`Query Params:`, queryParams);

  return req;
}

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    logRequest(req);

    if (url.pathname === "/register") {
      const token = createUser();
      return new Response(JSON.stringify({ message: "Welcome!", token }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/balance") {
      const token = url.searchParams.get("token");
      if (!checkToken(token)) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

      return new Response(JSON.stringify({ balance: getBalance(token) }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/coinflip" && req.method === "POST") {
      const body = await req.json();
      const { token, betAmount } = body;
      if (!checkToken(token)) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
      if (!checkValidBet(token, betAmount)) return new Response(JSON.stringify({ error: "Invalid bet amount"}), { status: 400 });

      const { result, change } = playCoinflip(betAmount);
      updateBalanceWithHistory(token, change);
      updateStats(token, "coinflip", result === "win");

      return new Response(
        JSON.stringify({
          result,
          newBalance: getBalance(token),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/stats" && req.method === "GET") {
      const token = url.searchParams.get("token");

      if (!checkToken(token)) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

      return new Response(
        JSON.stringify({
          global: getGlobalStats(token),
          coinflip: getGameStats(token, "coinflip"),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/rankings/balance" && req.method === "GET") {
      return new Response(
        JSON.stringify(getAllTimeBalanceRankings()),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/rankings/gamesPlayed" && req.method === "GET") {
      const gameResult = url.searchParams.get("sort");
      return new Response(
        JSON.stringify(getAllTimePlayedRankings(gameResult)),
        { headers: { "Content-Type": "application/json" } }
      );
    }

  },
});

console.log("API running at http://localhost:3000");