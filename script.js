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
    const { firstName, lastName, bookingNumberList, birthDate } =
      passengerList[randomNumber(0, passengerList.length - 1)];
    const loginWithReservationResponse = loginWithReservation(
      firstName,
      lastName,
      bookingNumberList,
      birthDate
    );
    const reservationToken = loginWithReservationResponse.json("authToken");
    console.log("resrvationToken", reservationToken);
    const menus = getMenuItems(reservationToken);

    const angry_orchad = getAngryOrchard(menus);
    const order_angry_orchard = {
      items: angry_orchad,
      pmid: "",
      ordertype: null,
      beaconColor: "FF8B00",
      roomNumber: "B520",
      originDevice: "guestappmc",
      customLocation: {
        x: 0,
        y: 0,
        poiid: "RegalPrincess.Deck11.Firezone06.BellBoxBar",
      },
      beaconColor: "",
      roomNumber: null,
      deliveryDateTime: null,
      deviceUuid: "1cabeba853eae1aa5c990e78ba05faceb860a9a8",
    };

    const orderFromBasketResponse = orderFromBasket(
      reservationToken,
      order_angry_orchard
    );
    const guestOrderId = orderFromBasketResponse.orderId;
    console.log("guestOrderId", guestOrderId);

    const crewLoginInfo = crewLogin();
    const crewLoginToken = crewLoginInfo.authToken;
    console.log("crewLoginToken", crewLoginToken);
    const createdOrders = getCrewOrdersByStatus(
      crewLoginToken,
      "created",
      guestOrderId
    );
    console.log(JSON.stringify(createdOrders, null, 2));

    passengerList.some((passenger, index) => {
      console.log(`Passenger ${index}`);
      if (index === 2) {
        return true;
      }
    });
  }

  sleep(0.5);
}

function getCrewOrdersByStatus(crewAuthToken, status, guestOrderId) {
  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: crewAuthToken,
    },
  };
  const url = new URL("https://ordermanager.xs.ocean.com/api/GetCrewOrders");

  url.searchParams.append("status", status);
  url.searchParams.append("role", "manager");

  let res = http.get(url.toString(), params);

  let success = check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (!success) {
    ErrorCount.add(1);
    ErrorRate.add(1);
  } else {
    const createdOrders = res.json();
    const filteredByGuestOrderId = createdOrders.creworders.filter(
      (order) => order.uiid === guestOrderId
    );

    console.log(JSON.stringify(filteredByGuestOrderId, null, 2));
  }
}

function changeOrderStatus() {}

function getAngryOrchard(menus) {
  return menus.categories
    .filter((category) => category.name === "Beverages")[0]
    .subcategories.filter(
      (subcategory) => subcategory.name === "Beer & Cider"
    )[0]
    .items.filter((item) => item.name === "Angry Orchard");
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
  const params = {
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

function crewLogin() {
  const url = new URL("https://oceannow.xs.ocean.com:8443/api/loginCrew");
  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };
  const data = {
    username: "ONowAdmiral",
    password: "ONwelcome1",
  };

  let res = http.post(url.toString(), JSON.stringify(data), params);

  let isOrderSuccessFull = check(res, {
    "Order Placed": (r) => r.status === 200,
  });

  if (!isOrderSuccessFull) {
    ErrorCount.add(1);
    ErrorRate.add(1);
    console.log(JSON.stringify(res.json(), null, "  "));
  } else {
    return res.json();
  }
}

function updateOrderStatus() {}

function orderFromBasket(authToken, data) {
  const url = new URL("https://oceannow.xs.ocean.com:8443/api/orderFromBasket");
  url.searchParams.append("userId", "");
  url.searchParams.append("locale", "en");

  const params = {
    headers: {
      authorization: authToken,
      "Content-Type": "application/json",
      "x-application": "MedallionClass",
    },
  };
  let res = http.post(url.toString(), JSON.stringify(data), params);

  let isOrderSuccessFull = check(res, {
    "Order Placed": (r) => r.status === 200,
  });

  if (!isOrderSuccessFull) {
    ErrorCount.add(1);
    ErrorRate.add(1);
    console.log(JSON.stringify(res.json(), null, "  "));
  } else {
    return res.json();
  }
}


function randomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}