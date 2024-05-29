import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as express from "express";
import { ProtectedResourceEndpointResponse } from "oauth2-nodejs";
import { AbstractProtectedResourceEndpoint } from "./abstract_protected_resource_endpoint";
import { sendSuccessIndicator, getProjectId, cloudLoggingMetadata, sendFailureIndicator } from "../../utils/sliLogger";


export class UserInfoEndpoint extends AbstractProtectedResourceEndpoint {
  protected handleRequest(
    req: express.Request,
    endpointInfo: ProtectedResourceEndpointResponse,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // SLI Logger
      const metadataResourceType = "Firebase Auth";
      const metadataAction = "Get User Info";
      const metadataCriticalUserJourney = "SSO";
      const metadata = cloudLoggingMetadata(
        getProjectId(),
        metadataResourceType,
        metadataAction,
        metadataCriticalUserJourney,
      );


      const auth = admin.auth();
      auth.updateUser(endpointInfo.userId, { emailVerified: true });
      auth
        .getUser(endpointInfo.userId)
        .then((userRecord) => {
          resolve(
            JSON.stringify({
              sub: endpointInfo.userId,
              first_name: userRecord.displayName?.split(" ")[0],
              last_name: userRecord.displayName?.split(" ")[1],
              email: userRecord.email,
            }),
          );
          sendSuccessIndicator(
            metadata,
            "Successfully retrieved user info",
            metadataResourceType,
            metadataAction,
          )
        })
        .catch((error) => {
          reject(error);

          sendFailureIndicator(
            metadata,
            "Failed to retrieve user info",
            metadataResourceType,
            metadataAction,
          );
        });
    });
  }

  protected validateScope(scopes: string[]): boolean {
    return scopes.indexOf("profile") !== -1;
  }
}

export function userinfo(): functions.HttpsFunction {
  return new UserInfoEndpoint().endpoint;
}
