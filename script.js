import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";
let ErrorCount = new Counter("errors");
let ErrorRate = new Rate("error_rate");

export let options = {};

export function setup() {
  return openImLogin();
}

function openImLogin() {
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
  let passengerList = getPassengerList(authToken);

  if (passengerList && passengerList.length > 0) {
    passengerList.some((passenger, index) => {
      console.log(`Passenger ${index}`);
      if (index === 2) {
        return true;
      }
      const { firstName, lastName, bookingNumberList, birthDate } = passenger;

      const loginWithReservationResponse = loginWithReservation(
        firstName,
        lastName,
        bookingNumberList,
        birthDate
      );
      const reservationToken = loginWithReservationResponse.json("authToken");
      console.log("resrvationToken", reservationToken);
      const menus = getMenuItems(reservationToken);

      const beerAndCiders = menus.categories
        .filter((category) => category.name === "Beverages")
        .subcategories.filter(
          (subcategory) => subcategory.name === "Beer & Cider"
        );
      console.log(JSON.stringify(beerAndCiders, null, "  "));
    });
  }

  sleep(0.5);
}

function loginWithReservation(
  firstName,
  lastName,
  bookingNumberList,
  birthDate
) {
  let data = {
    firstName,
    lastName,
    reservationNumber: bookingNumberList.length > 0 ? bookingNumberList[0] : "",
    birthDate,
  };

  let res = http.post(
    `https://oceannow.xs.ocean.com/api/loginWithReservation`,
    JSON.stringify(data),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  let isLoginWithReservationSuccess = check(res, {
    "created user": (r) => r.status === 200,
  });

  if (!isLoginWithReservationSuccess) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  }
  return res;
}

function getPassengerList(authToken) {
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
  } else {
    return res.json();
  }
}

function getMenuItems(authToken) {
  const url = new URL("https://oceannow.xs.ocean.com:8443/api/getMenuByPoiId");
  url.searchParams.append("poiid", "staterooms");
  url.searchParams.append("locale", "en");
  const params = {
    headers: {
      authorization: authToken,
      "Content-Type": "application/json",
    },
  };
  let res = http.get(url.toString(), params);
  let isMenuFetchedSuccess = check(res, {
    "Menu Fetched": (r) => r.status === 200,
  });
  if (!isMenuFetchedSuccess) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  } else {
    return res.json();
  }
}

function randomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}