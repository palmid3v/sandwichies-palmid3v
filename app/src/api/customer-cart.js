import { auth } from "../firebase";
import { workerRequest } from "./worker";

export const getCustomerCart = () => workerRequest("/v1/customer/cart", { auth });
export const saveCustomerCart = (payload) => workerRequest("/v1/customer/cart", {
  auth, method: "POST", body: payload,
});
