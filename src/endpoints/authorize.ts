import * as functions from "firebase-functions";
import * as express from "express";
import { RequestWrapper } from "../models";
import { AuthorizationEndpoint } from "oauth2-nodejs";
import { CloudFirestoreDataHandlerFactory } from "../data";
import { Crypto, Navigation } from "../utils";
const cors = require("cors");
import {
  sendFailureIndicator,
  sendSuccessIndicator,
  cloudLoggingMetadata,
  getProjectId
} from '../utils/sliLogger'

class AuthorizeApp {
  static create(
    providerName: string,
    authenticationUrl: string,
  ): express.Express {
    const authorizeApp = express();
authorizeApp.use(cors({ origin: "*" }));
const authorizeProvider = async (req: express.Request, resp: express.Response) => {
  const request = new RequestWrapper(req);
  const authorizationEndpoint = new AuthorizationEndpoint();
  functions.logger.log(request)
  authorizationEndpoint.dataHandlerFactory = new CloudFirestoreDataHandlerFactory();
  authorizationEndpoint.allowedResponseTypes = ["code", "token"];

  // SLI Logger
  const metadataResourceType = "Firebase Auth";
  const metadataAction = "Authorization";
  const metadataCriticalUserJourney = "SSO";
  const metadata = cloudLoggingMetadata(
    getProjectId(),
    metadataResourceType,
    metadataAction,
    metadataCriticalUserJourney,
  );
      
      functions.logger.info("reqeuest", request);
      functions.logger.info("authorizationEndpoint", authorizationEndpoint);


      try {
        const authorizationEndpointResponse = await authorizationEndpoint.handleRequest(
          request
        );
        functions.logger.info(authorizationEndpointResponse);
        if (authorizationEndpointResponse.isSuccess()) {
          const authToken: { [key: string]: any } = {
            client_id: request.getParameter("client_id"),
            redirect_uri: request.getParameter("redirect_uri"),
            response_type: request.getParameter("response_type"),
            scope: request.getParameter("scope"),
            created_at: Date.now(),
          };

          const state = request.getParameter("state");

          if (state) {
            authToken["state"] = state;
          }

          const authTokenString = Crypto.encrypt(JSON.stringify(authToken));

          // SLI Logger
          sendSuccessIndicator(
            metadata,
            "Successfully authorized user, redirecting to /authentication",
            metadataResourceType,
            metadataAction,
          );

          Navigation.redirect(resp, `${authenticationUrl}`, {
            auth_token: authTokenString,
          });
        } else {
          const error = authorizationEndpointResponse.error;
          functions.logger.error(error.toJson());
          resp.contentType("application/json; charset=UTF-8");
          resp.status(error.code).send(error.toJson());

          // SLI Logger
          sendFailureIndicator(
            metadata,
            "Authorization failure",
            metadataResourceType,
            metadataAction,
          );
        }
      } catch (error) {
        resp.status(500).send(error.toString());

        sendFailureIndicator(
          metadata,
          "Authorization failure",
          metadataResourceType,
          metadataAction,
        );
      }
    };
    authorizeApp.get("/authorize/entry", authorizeProvider);
    authorizeApp.get("/entry", authorizeProvider);
    

    return authorizeApp;
  }
}



export function customAuthorize(authenticationUrl: string) {
  return functions.https.onRequest(
    AuthorizeApp.create("Custom", authenticationUrl),
  );
}
