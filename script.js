import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

let ErrorCount = new Counter("errors");
let ErrorRate = new Rate("error_rate");

export let options = {
  //   stages: [
  //     { duration: "5m", target: 60 }, // simulate ramp-up of traffic from 1 to 60 users over 5 minutes.
  //     { duration: "10m", target: 60 }, // stay at 60 users for 10 minutes
  //     { duration: "3m", target: 100 }, // ramp-up to 100 users over 3 minutes (peak hour starts)
  //     { duration: "2m", target: 100 }, // stay at 100 users for short amount of time (peak hour)
  //     { duration: "3m", target: 60 }, // ramp-down to 60 users over 3 minutes (peak hour ends)
  //     { duration: "10m", target: 60 }, // continue at 60 for additional 10 minutes
  //     { duration: "5m", target: 0 }, // ramp-down to 0 users
  //   ],
  //   noConnectionReuse: true,
  //   thresholds: {
  //     http_req_duration: ["p(99)<1500"], // 99% of requests must complete below 1.5s
  //   },
};

export function setup() {
  // register a new user and authenticate via a Bearer token.

  const params = {
    headers: {
      authorization: "Basic cGxhbmt0b246b2lFbjg1azROdERMM0RQMko=",
      "cache-control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  let res = http.post(
    "https://am-iam.xs.ocean.com/openam/oauth2/access_token?realm=ocean%2Fguests",
    "grant_type=client_credentials&scope=ocean",
    params
  );

  check(res, { "created user": (r) => r.status === 200 });
  let authToken = res.json("access_token");
  return authToken;
}

export default function (authToken) {
  //
  var params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  };
  let res = http.get(
    "https://passengerservices.xs.ocean.com:8443/passenger/list?propertyCode=PC-GP&journeyDate=2021-09-14T00:00:00",
    params
  );
  let success = check(res, {
    "status is 200": (r) => r.status === 200,
    "have valid length": (r) => r.json().length > 0,
  });

  if (!success) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  }

  if (res.json().length > 0) {
    res.json().some((passenger, index) => {
      console.log(`Passenger ${index}`);
      if (index === 4) {
        return true;
      }
      const { firstName, lastName, bookingNumberList, birthDate } = passenger;

      let loginWithReservationData = {
        firstName,
        lastName,
        reservationNumber:
          bookingNumberList.length > 0 ? bookingNumberList[0] : "",
        birthDate,
      };

      let loginWithReservationResponse = http.post(
        `https://oceannow.xs.ocean.com/api/loginWithReservation`,
        JSON.stringify(loginWithReservationData),
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      let isLoginWithReservationSuccess = check(loginWithReservationResponse, {
        "created user": (r) => r.status === 200,
      });

      if (!isLoginWithReservationSuccess) {
        ErrorCount.add(1);
        ErrorRate.add(1);
      } else {
        console.log(
          JSON.stringify(loginWithReservationResponse.json(), null, "  ")
        );
      }
    });
  }

  sleep(0.5);
}

function randomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}