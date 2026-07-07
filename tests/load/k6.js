import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const WSYS_SIGNATURE =
  __ENV.WSYS_SIGNATURE ||
  "2qnN13LJrCJbGN8wEV1XzNptjKjKPwF7HjQWzM4CcdcCM1A4HxtppYFyEacV5KTysQZDq7qMnAjq3AQVwKgwJzoJ";

const joinFailureRate = new Rate("join_failures");
const poolFetchDuration = new Trend("pool_fetch_duration");
const joinDuration = new Trend("join_duration");

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 25 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  // Fetch active pools
  const poolStart = Date.now();
  const poolsRes = http.get(`${BASE_URL}/api/pools`, {
    headers: { Accept: "application/json" },
  });
  poolFetchDuration.add(Date.now() - poolStart);

  check(poolsRes, {
    "pools status 200": (r) => r.status === 200,
    "pools has body": (r) => r.body && r.body.length > 0,
  });

  const pools = JSON.parse(poolsRes.body || "{}");
  const poolList = pools.pools || pools;

  // Join a random pool using a simulated signature
  if (poolList.length > 0) {
    const pool = poolList[Math.floor(Math.random() * poolList.length)];
    const joinCode = pool.join_code || pool.joinCode;
    if (joinCode) {
      const joinStart = Date.now();
      const joinRes = http.post(
        `${BASE_URL}/api/pools/${joinCode}/join`,
        JSON.stringify({
          stakeTxSignature: WSYS_SIGNATURE,
          displayName: `loadtest_${__VU}_${Date.now()}`,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer __test_${__VU}`,
          },
        },
      );
      joinDuration.add(Date.now() - joinStart);

      const joinOk = check(joinRes, {
        "join status 2xx": (r) => r.status >= 200 && r.status < 300,
      });
      joinFailureRate.add(!joinOk);

      // Fetch leaderboard after join
      const lbRes = http.get(`${BASE_URL}/api/pools/${joinCode}/leaderboard`, {
        headers: { Accept: "application/json" },
      });
      check(lbRes, {
        "leaderboard status 200": (r) => r.status === 200,
      });
    }
  }

  sleep(Math.random() * 3 + 1);
}
