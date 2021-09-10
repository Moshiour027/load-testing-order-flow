import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

let ErrorCount = new Counter("errors");
let ErrorRate = new Rate("error_rate");

export let options = {
  stages: [
    // { duration: "1m", target: 25 },
    // { duration: "1m", target: 40 },
    // 1020 request were made in 2 minutes
  ],

  noConnectionReuse: true,
  //   thresholds: {
  //     http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
  //   },
};

export function setup() {
  const url = `https://oceannow.${__ENV.ENV}.ocean.com/api/loginWithReservation`;
  let data = {
    firstName: "MILES",
    lastName: "CLARK",
    reservationNumber: "2VXH2J",
    birthDate: "1993-07-07",
  };

  let res = http.post(url, JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

  let success = check(res, { "created user": (r) => r.status === 200 });
  if (!success) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  } else {
    const authToken = res.json("authToken");
    const userId = res.json("userId");
    return { authToken, userId };
  }
}

export default function ({ authToken, userId }) {
  const url = `https://oceannow.${__ENV.ENV}.ocean.com/api/sendCustomPushMessage`;

  let data = {
    userid: userId,
    message: "Can you see this",
    title: "Hello",
    data: {
      link: "THIS IS A LINK",
    },
  };

  let res = http.post(url, JSON.stringify(data), {
    headers: {
      authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      "cache-control": "no-cache",
    },
  });

  let success = check(res, { "created user": (r) => r.status === 200 });

  if (!success) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  } else {
    console.log(JSON.stringify(res.json(), null, "  "));
  }

  sleep(0.5);
}
function randomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
