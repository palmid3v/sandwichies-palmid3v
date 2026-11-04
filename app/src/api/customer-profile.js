import { auth } from "../firebase";
import { workerRequest } from "./worker";

export const getCustomerProfile = () => workerRequest("/v1/customer/profile", { auth });
export const saveCustomerProfile = (profile) => workerRequest("/v1/customer/profile", {
  auth, method: "POST", body: profile,
});
export const listCustomerAddresses = () => workerRequest("/v1/customer/addresses", { auth });
export const saveCustomerAddress = (address) => workerRequest("/v1/customer/addresses", {
  auth, method: "POST", body: address,
});
export const deleteCustomerAddress = (id) => workerRequest(
  "/v1/customer/addresses/" + encodeURIComponent(id) + "/delete",
  { auth, method: "POST", body: {} },
);
