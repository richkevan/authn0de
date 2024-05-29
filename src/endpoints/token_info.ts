import * as functions from 'firebase-functions';
import { RequestWrapper } from '../models';
import { TokeninfoEndpoint } from 'oauth2-nodejs';
import { CloudFirestoreDataHandlerFactory } from '../data';
import {
  sendFailureIndicator,
  sendSuccessIndicator,
  cloudLoggingMetadata,
  getProjectId
} from '../utils/sliLogger'

export function tokeninfo() {

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
  
  return functions.https.onRequest( async ( req, resp) => {
    if (req.method === "GET") {
      const request = new RequestWrapper( req );
      const tokeninfoEndpoint = new TokeninfoEndpoint();


      tokeninfoEndpoint.dataHandlerFactory = new CloudFirestoreDataHandlerFactory();

      try {
        const tokeninfoEndpointResponse = await tokeninfoEndpoint.handleRequest( request );
        resp.contentType( "application/json; charset=UTF-8" );
        resp.status( tokeninfoEndpointResponse.code ).send( tokeninfoEndpointResponse.body );

        // SLI Logger
        sendSuccessIndicator(
          metadata,
          "Successfully provided token",
          metadataResourceType,
          metadataAction,
        );
      } catch ( error ) {
        resp.status( 500 ).send( error.toString() );

        // SLI Logger
        sendFailureIndicator(
          metadata,
          "Failed to provide token info",
          metadataResourceType,
          metadataAction,
        );
      }
    } else {
      resp.status( 405 ).send( "Method Not Allowed" );

      // SLI Logger
      sendFailureIndicator(
        metadata,
        "Failed to provide token info, method not allowed",
        metadataResourceType,
        metadataAction,
      );
    }
  })
}