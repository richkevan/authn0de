import * as url from "url";
import * as querystring from "querystring";
import * as express from "express";
import {
  AuthorizationEndpointResponse,
  OAuthError,
  Result,
} from "oauth2-nodejs";

export class Navigation {
  public static buildUrl(
    uri: string,
    parameters?: { [key: string]: string | number },
    fragments?: { [key: string]: string | number }
  ) {
    const targetUrl = url.parse(uri, true);

    if (parameters) {
      const query = targetUrl.query;
      Object.keys(parameters).forEach((key: string): void => {
        const value: string | number = parameters[key];
        query[key] = typeof value === "string" ? value : String(value);
      });
    }

    if (fragments) {
      targetUrl.hash = `#${querystring.stringify(fragments)}`;
    }

    return url.format(targetUrl);
  }

  public static redirect(
    resp: express.Response,
    uri: string,
    parameters?: { [key: string]: string | number },
    fragments?: { [key: string]: string | number }
  ): void {
    const targetUrl = this.buildUrl(uri, parameters, fragments);

    resp.redirect(targetUrl);
  }

  public static backTo(
    resp: express.Response,
    result: Result<AuthorizationEndpointResponse>,
    redirectUri: string
  ): void {
    if (result.isSuccess()) {
      const response = result.value;
      this.redirect(resp, redirectUri, response.query, response.fragment);
    } else {
      this.redirect(resp, redirectUri, { error: result.error.getType() }, {});
    }
  }

  public static sendError(resp: express.Response, error: OAuthError): void {
    resp.contentType("application/json; charset=UTF-8");
    resp.status(error.code).send(error.toJson());
  }
}
