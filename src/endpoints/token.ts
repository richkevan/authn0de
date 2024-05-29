
import * as functions from 'firebase-functions';
import { RequestWrapper } from '../models';
import {
  DefaultClientCredentialFetcherProvider,
  TokenEndpoint,
} from 'oauth2-nodejs';
import { CustomGrantHandlerProvider } from './../granttype';
import { CloudFirestoreDataHandlerFactory } from '../data';
import {
  sendFailureIndicator,
  sendSuccessIndicator,
  cloudLoggingMetadata,
  getProjectId
} from '../utils/sliLogger'


export function token() {

  // SLI Logger
  const metadataResourceType = "Firebase Auth";
  const metadataAction = "Token Registration";
  const metadataCriticalUserJourney = "SSO";
  const metadata = cloudLoggingMetadata(
    getProjectId(),
    metadataResourceType,
    metadataAction,
    metadataCriticalUserJourney,
  );

  return functions.https.onRequest(async (req, resp) => {
    functions.logger.info("token", req.method, req.url);
    if (req.method === "POST") {
      const request = new RequestWrapper(req);
      const tokenEndpoint = new TokenEndpoint();
      const clientCredentialFetcherProvider = new DefaultClientCredentialFetcherProvider();

      tokenEndpoint.grantHandlerProvider = new CustomGrantHandlerProvider(
        clientCredentialFetcherProvider
      );
      tokenEndpoint.clientCredentialFetcherProvider = clientCredentialFetcherProvider;
      tokenEndpoint.dataHandlerFactory = new CloudFirestoreDataHandlerFactory();

      try {
        const tokenEndpointResponse = await tokenEndpoint.handleRequest(request);
        functions.logger.info("token Response", tokenEndpointResponse);
        resp.contentType("application/json; charset=UTF-8");
        functions.logger.info("resp send", resp, resp.status(tokenEndpointResponse.code).send(tokenEndpointResponse.body));
        resp.status(tokenEndpointResponse.code).send(tokenEndpointResponse.body);

        // SLI Logger
        sendSuccessIndicator(
          metadata,
          "Successfully provided token",
          metadataResourceType,
          metadataAction,
        );
      } catch (error) {
        resp.status(500).send(error.toString());

        // SLI Logger
        sendFailureIndicator(
          metadata,
          "Failed to provide token",
          metadataResourceType,
          metadataAction,
        );
      }
    } else {
      resp.status(405).send("Method Not Allowed");

      // SLI Logger
      sendFailureIndicator(
        metadata,
        "Failed to provide token, method not allowed",
        metadataResourceType,
        metadataAction,
      );
    }
  });
}