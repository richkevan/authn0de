import * as express from "express";
import * as functions from "firebase-functions";
import { RequestWrapper } from "../../models";
import {
  AccessDenied,
  DefaultAccessTokenFetcherProvider,
  ProtectedResourceEndpoint,
  UnknownError,
  ProtectedResourceEndpointResponse,
} from "oauth2-nodejs";;
import { Navigation } from "../../utils";
import { CloudFirestoreDataHandlerFactory } from "../../data";

export abstract class AbstractProtectedResourceEndpoint {
  public get endpoint(): functions.HttpsFunction {
    return functions.https.onRequest(
      async (req: express.Request, resp: express.Response) => {
        const request = new RequestWrapper(req);
        const protectedResourceEndpoint = new ProtectedResourceEndpoint();

        protectedResourceEndpoint.accessTokenFetcherProvider =
          new DefaultAccessTokenFetcherProvider();
        protectedResourceEndpoint.dataHandlerFactory =
          new CloudFirestoreDataHandlerFactory();

        const result = await protectedResourceEndpoint.handleRequest(request);

        if (result.isSuccess()) {
          const endpointInfo = result.value;

          if (this.validateScope(endpointInfo.scope.split(" "))) {
            resp.contentType("application/json; charset=UTF-8");

            try {
              const responseBody = await this.handleRequest(req, endpointInfo);
              resp.status(200).send(responseBody);
            } catch (error) {
              Navigation.sendError(resp, new UnknownError(error.toString()));
            }
          } else {
            Navigation.sendError(
              resp,
              new AccessDenied(""),
            );
          }
        } else {
          Navigation.sendError(resp, result.error);
        }
      },
    );
  }

  protected abstract validateScope(scope: string[]): boolean;

  protected abstract handleRequest(
    req: express.Request,
    endpointInfo: ProtectedResourceEndpointResponse,
  ): Promise<string>;
}
