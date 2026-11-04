import { auth } from "../firebase";
import { workerRequest } from "./worker";

export const getCustomerCart = (mutationId = "") => {
  const query = mutationId ? "?mutationId=" + encodeURIComponent(mutationId) : "";
  return workerRequest("/v1/customer/cart" + query, { auth });
};
export const saveCustomerCart = (payload) => workerRequest("/v1/customer/cart", {
  auth, method: "POST", body: payload,
});
