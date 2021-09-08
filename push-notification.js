import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

let ErrorCount = new Counter("errors");
let ErrorRate = new Rate("error_rate");

export let options = {
  stages: [
    { duration: "5m", target: 60 }, // simulate ramp-up of traffic from 1 to 60 users over 5 minutes.
    { duration: "10m", target: 60 }, // stay at 60 users for 10 minutes
    { duration: "3m", target: 100 }, // ramp-up to 100 users over 3 minutes (peak hour starts)
    { duration: "2m", target: 100 }, // stay at 100 users for short amount of time (peak hour)
    { duration: "3m", target: 60 }, // ramp-down to 60 users over 3 minutes (peak hour ends)
    { duration: "10m", target: 60 }, // continue at 60 for additional 10 minutes
    { duration: "5m", target: 0 }, // ramp-down to 0 users
  ],
  //   noConnectionReuse: true,
  //   thresholds: {
  //     http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
  //   },
};

export function setup() {
  const url = "https://oceannow.ap.ocean.com/api/loginWithReservation";
  let data = {
    firstName: "Alexander",
    lastName: "Rosa",
    reservationNumber: "2V6DWM",
    birthDate: "1992-09-14",
  };

  let res = http.post(url, JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

  let success = check(res, { "created user": (r) => r.status === 200 });
  if (!success) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  } else {
    let authToken = res.json("authToken");
    return authToken;
  }
}

export default function (authToken) {
  const url = "https://oceannow.ap.ocean.com/api/sendCustomPushMessage";

  let data = {
    userid: "ocean-6ded1097-54fa-4cc2-b53b-c91c64b728c3",
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
