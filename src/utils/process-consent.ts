import * as express from "express";
import { RequestMap } from "../models";
import { AuthorizationEndpoint } from "oauth2-nodejs";
import { CloudFirestoreDataHandlerFactory } from "../data";
import { Navigation } from ".";

export const processConsent = async (
  resp: express.Response,
  {
    action,
    authToken,
    userId,
  }: { action?: string; authToken: any; userId: string },
  options: { redirect: boolean } = { redirect: true }
) => {
  const requestMap = new RequestMap();

  requestMap.setParameter("user_id", userId);
  requestMap.setParameter("state", authToken["state"]);
  requestMap.setParameter("client_id", authToken["client_id"]);
  requestMap.setParameter("redirect_uri", authToken["redirect_uri"]);
  requestMap.setParameter("response_type", authToken["response_type"]);
  requestMap.setParameter("scope", authToken["scope"]);

  const authorizationEndpoint = new AuthorizationEndpoint();

  authorizationEndpoint.dataHandlerFactory = new CloudFirestoreDataHandlerFactory();
  authorizationEndpoint.allowedResponseTypes = ["code", "token"];

  const authenticationResult =
    action === "allow"
      ? await authorizationEndpoint.allow(requestMap)
      : await authorizationEndpoint.deny(requestMap);

  if (options.redirect) {
    return Navigation.backTo(
      resp,
      authenticationResult,
      authToken["redirect_uri"]
    );
  } else {
    const response = authenticationResult.value;

    return {
      url: Navigation.buildUrl(
        authToken["redirect_uri"],
        response.query,
        response.fragment
      ),
    };
  }
};
