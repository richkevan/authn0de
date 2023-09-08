import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import * as qs from "qs";
import { RequestWrapper } from "../models";
import { Crypto, Navigation, processConsent } from "../utils";
import { CloudFirestoreClients } from "../data";
import {
  sendFailureIndicator,
  sendSuccessIndicator,
  cloudLoggingMetadata,
  getProjectId
} from '../utils/sliLogger';

class AuthenticationApp {
  static create(
    providerName: string,
    authenticationUrl: string,
  ): express.Express {
    const authenticationApp = express();
    authenticationApp.use(cors({ origin: "*" }));

    const authenticationGet = (
      req: express.Request,
      resp: express.Response,
    ) => {
      const request = new RequestWrapper(req);
      const authToken = request.getParameter("auth_token");

      const payload = {
        authToken: authToken,
      };

      const strippedUrl = authenticationUrl.split("?")[0];
      const urlWithPayload = `${strippedUrl}?${qs.stringify(payload)}`;

      resp.redirect(urlWithPayload);
    };

    authenticationApp.get("/", authenticationGet);
    authenticationApp.get("/authentication", authenticationGet);
    const authenticationPost = async (
      req: express.Request,
      resp: express.Response,
    ) => {
      const request = new RequestWrapper(req);
      const encyptedAuthToken = request.getParameter("auth_token")!;
      const idTokenString = request.getParameter("id_token")!;
      const success = request.getParameter("success");

      // SLI Logger
      const metadataResourceType = "Firebase Auth";
      const metadataAction = "Authentication";
      const metadataCriticalUserJourney = "SSO";
      const metadata = cloudLoggingMetadata(
        getProjectId(),
        metadataResourceType,
        metadataAction,
        metadataCriticalUserJourney,
      );

      const authToken = JSON.parse(
        Crypto.decrypt(request.getParameter("auth_token")!),
      );
      let client;
      if (success === "true") {
        try {
          const idToken = await admin.auth().verifyIdToken(idTokenString);

          if (idToken.aud === process.env.GCLOUD_PROJECT) {
            client = await CloudFirestoreClients.fetch(authToken["client_id"]);

            if (client?.implicitConsent) {
              const payload = await processConsent(
                resp,
                {
                  action: "allow",
                  authToken,
                  userId: idToken.sub,
                },
                { redirect: !client?.browserRedirect },
              );

              // SLI Logger
              sendSuccessIndicator(
                metadata,
                "Browser redirect to avoid CORS",
                metadataResourceType,
                metadataAction,
              );

              return resp.json(payload);
            } else {
              const encryptedUserId = Crypto.encrypt(idToken.sub);

              Navigation.redirect(resp, "/authorize/consent", {
                auth_token: encyptedAuthToken,
                user_id: encryptedUserId,
              });
            }
          }
        } catch (error) {
          // SLI Logger
          sendFailureIndicator(
            metadata,
            "Authentication error",
            metadataResourceType,
            metadataAction,
          );

          return resp.json({error: JSON.stringify(error)})
        }
      }
      if (client?.browserRedirect) {
        // SLI Logger
        sendFailureIndicator(
          metadata,
          "Authentication error",
          metadataResourceType,
          metadataAction,
        );

        return resp.json({
          error: "access_denied",
        });
      }

      Navigation.redirect(resp, authToken["redirect_uri"], {
        error: "access_denied",
      });

      // SLI Logger
      sendFailureIndicator(
        metadata,
        "Authentication error",
        metadataResourceType,
        metadataAction,
      );

      return
    };
    authenticationApp.post("/", authenticationPost);
    authenticationApp.post("/authentication", authenticationPost);
    return authenticationApp;
  }
}

export function customAuthentication(authenticationUrl: string) {
  return functions.https.onRequest(
    AuthenticationApp.create("custom", authenticationUrl),
  );
}
