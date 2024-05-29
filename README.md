# AuthN0de

> ⚠️ This is a fork of [`oauth2-firebase`](https://github.com/yoichiro/oauth2-firebase), with additional support for custom login pages, custom authorize routes. The docs have been kept largely the same until I get time to address them.

This library provides an OAuth2 server implementation for Firebase Auth:

- Email and password or passwordless login via your custom Firebase Auth page (this fork)
- Cloud Function for OAuth2 endpoints
- Cloud Firestore to store token information
- OAuth 2.0 Compliant

[![NPM Version](https://img.shields.io/npm/v/oauth2server-firebase)
![npm](https://img.shields.io/npm/dw/oauth2server-firebase)
](https://www.npmjs.org/package/oauth2server-firebase)
[![GitHub repo size](https://img.shields.io/github/repo-size/richkevan/firebase-oauth)
![GitHub Repo stars](https://img.shields.io/github/stars/richkevan/firebase-oauth)
![GitHub forks](https://img.shields.io/github/forks/richkevan/firebase-oauth)
![GitHub tag (with filter)](https://img.shields.io/github/v/tag/richkevan/firebase-oauth)](https://github.com/richkevan/firebase-oauth)
![npm](https://img.shields.io/npm/dw/oauth2server-firebase)
[![Discord](https://img.shields.io/discord/1151892177576788028?l)](https://discord.gg/vKwjwCYN)





# How to install

This section describes how to use this library.

## Prerequisite

You must already have some Firebase project which enables Cloud Functions, Cloud Firestore and Firebase Authentication.
Especially, it is necessary to enable the Google Sign-In or Facebook Login for Federation ID provider on the Firebase Authentication.

## Install this library

This library has been provided as JavaScript library on the npm repository. You can install this library
with the `npm` command. We represent your project directory `${PROJECT_HOME}`.

```bash
$ cd ${PROJECT_HOME}
$ cd functions
$ npm install oauth2server-firebase --save
```

## Define endpoints as Cloud Functions

This library provides some endpoints for OAuth 2.0. Each endpoint is a handler function for the express.

If you use the TypeScript to write your functions, add the following code to your `functions/index.ts` file.

```
$ vi index.ts
```

The code you need to write is the following:

**Custom Login**

```javascript
import * as functions from "firebase-functions";
import {authorize, Configuration, customAuthentication, garbageCollection, token} from "oauth2-firebase-auth";

Configuration.init({
  crypto_auth_token_secret_key_32: functions.config().crypto.auth_token_secret_key_32,
  project_api_key: functions.config().project.api_key
});

exports.token = token();
exports.authorize = customAuthorize("https://region-project.cloudfunctions.net/authentication");
exports.authentication = customAuthentication("https://example.com/login");
exports.garbageCollection = garbageCollection();

...
```

By the code above, the following endpoints are defined:

- `https://.../token` - Token endpoint.
- `https://.../authorize` - Authorization endpoint.
- `https://.../authentication` - Login page for Google Sign-In.

## Redirect your login form

If you're using a custom login, you need to call the API and redirect to the `authentication` function once Firebase auth has logged in.

```js
const redirectToOAuth = async (
  user: firebase.User,
  url: string = process.env.OAUTH_URL // Deployed `authentication` endpoint, hosted on Cloud Functions
) => {
  if (!user) {
    return;
  }

  const authToken = new URLSearchParams(window.location.search).get(
    "authToken"
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_token: authToken,
      id_token: await user.getIdToken(),
      success: "true",
    }),
  });

  const data = await response.json();

  window.location = data.url;
};

firebase
  .auth()
  .onAuthStateChanged((user) => redirectToOAuth(user, process.env.OAUTH_URL));
```

## Generate a shared key

This library uses a shared key for navigating pages. You need to generate a random string for the shared key.
The string must be 32 length. For example:

```bash
$ cat /dev/urandom | base64 | fold -w 32 | head -n 1
```

## Set a configuration value to your project

After generating the random string, you need to set the string as the shared key with the following `firebase` command.

```bash
PROCESS.ENV.OAUTHKEY=<YOUR_RANDOM_STRING>
```

In addition, you need to set the API Key value of your Firebase project. You can retrieve the API Key value by the
following steps:

1. Go to the setting page of your Firebase project: `https://console.firebase.google.com/project/<YOUR_PROJECT_ID>/settings/general/`
1. Get the string of the field labeled `Web API Key`.

Then, register the configuration:

```bash
PROCESS.ENV.API_KEY=<YOUR_API_KEY>
```

## Deploy your project

After writing the code and setting the configuration, deploy your project to the Firebase.

```bash
$ firebase deploy --only functions
```

# Operations

You need to setup the database to operate OAuth2.0 server as like the following:

- Register your client
- Set a description for each scope

## Register your client

In OAuth2.0, each client must be registered in advance. This library uses the Cloud Firestore as the storage
for the client definitions. In the current version, you need to register client definitions with the Firebase Console
manually. To register a client definition, add a new doc in a "oauth2_clients" collection as like the following:

- Collection: `oauth2_clients`
- Doc ID: Auto-generated. This will be used as a Client ID value.
- Fields:
  - `user_id` - The user ID which represents this client as a user.
  - `provider_name` - The provider name who this client provides.
  - `client_secret` - The client secret string. You need to generate this string as the shared key, and need to share the provider.
  - `redirect_uri` - If this client supports Authorization Code grant and Implicit grant, you need to set this redirect_uri string.
  - `grant_type` - This is an object. Each key represents a grant type, and each value is boolean whether the grant type is supported or not. You need to set these entries: `authorization_code`, `password`, `client_credentials` and `refresh_token`.
  - `response_type` - This is an object. Each key represents a response type, and each value is boolean whether the response type is supported or not. You need to set these entries: `code` and `token`.
  - `scope` - This is an object. Each key represents a scope, and each value is boolean whether the scope is supported or not. You need to set the entry: `profile`.
  - `implicit_consent` - If `true`, will skip consent page.
  - `browser_redirect` - If `true`, will tell authentication endpoint to let browser redirect after login, instead of the server/function. You probably want this enabled if using a custom login page to prevent CORS errors.

The following is a sample JSON string which represents the values above:

```json
{
  "user_id": "client@123",
  "provider_name": "Google, Inc.",
  "client_secret": "foobar123456",
  "redirect_uri": "https://foobar.com/foo/bar/baz",
  "grant_type": {
    "authorization_code": true,
    "password": false,
    "client_credentials": true,
    "refresh_token": true
  },
  "response_type": {
    "code": true,
    "token": true
  },
  "scope": {
    "profile": true
  }
}
```

## Set a description for each scope

This library shows a consent page to ask whether they allow or deny scopes. You need to register descriptions for each scope with the Firebase Console manually. To register a scope description, add a new doc in a "oauth2_scopes" collection as like the following:

- Collection: `oauth2_scopes`
- Doc ID: Auto-generated.
- Fields:
  - `name` - Scope name (ex. "profile").
  - `description` - Scope description (ex. "User profile information (User ID and Nickname)").

The following is a sample JSON string which represents the values above:

```json
{
  "name": "profile",
  "description": "User profile information (User ID and Nickname)"
}
```

# Use Additional Endpoints

This library provides some additional endpoints:

- userinfo - Userinfo API endpoint.
- tokeninfo - Tokeninfo API endpoint.

## Userinfo API endpoint

In OpenID Connect specification, the userinfo endpoint is defined. It provides the authenticated user's information.
You can provide the userinfo API endpoint easily by writing the following code:

```javascript
import {userinfo} from "oauth2-firebase-auth";
...
exports.userinfo = userinfo();
```

This userinfo endpoint works as a protected resource endpoint. That is, the access token is necessary to use this endpoint.
For example:

```bash
$ curl -X POST -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" https://.../userinfo
```

If the access token is valid, you will retrieve the following result:

```json
{
  "sub": "<AUTHENTICATED_USER_ID>",
  "first_name": "<AUTHENTICATED_USER_NAME>",
  "last_name": "<AUTHENTICATED_USER_NAME>",
  "email": "<AUTHENTICATED_USER_EMAIL>"
}
```

## Tokeninfo API endpoint

The tokeninfo API endpoint provides the information of the passed access token. By this endpoint, you can confirm
whether the passed access token is issued for your client or not. You can provide the tokeninfo API endpoint easily by
writing the following code:

```javascript
import {tokeninfo} from "oauth2-firebase-auth";
...
exports.tokeninfo = tokeninfo();
```

The tokeninfo API endpoint accepts an access token as a query parameter called "access_token". For example:

```bash
curl https://.../tokeninfo?access_token=<YOUR_ACCESS_TOKEN>
```

If the access token is valid, you will retrieve the following result:

```json
{
  "aud": "<CLIENT_ID>",
  "sub": "<USER_ID>",
  "expires_in": "<EXPIRES_IN_VALUE>",
  "scope": "<SCOPE_VALUES>"
}
```

You can check whether the access token is for your client or not by comparing the `aud` value.

# Configurations

You can configure each behavior of this library.

## Set expires_in values to access tokens

You can set each expires_in values (unit: sec) for access tokens per grant types. For example:

```javascript
const expiresInMap = new Map<string, number>();
expiresInMap.set("authorization_code", 2678400);
expiresInMap.set("implicit", 86400);
expiresInMap.set("password", 86400);
expiresInMap.set("client_credentials", 2678400);
expiresInMap.set("refresh_token", 2678400);
Configuration.init({
  ...
  tokens_expires_in: expiresInMap
});
```

In this library, the default values are:

- Authorization Code Grant: 86400
- Implicit Grant: 3600
- Password: 86400
- Client Credentials: 86400
- Refresh Token: 86400

## Customize the consent page design

This library provides a very simple design of the consent page. But, you can customize the design. For instance, you
can provide your own template string for the consent page from your code.

To customize the page design, you need to create a new class which implements the `ConsentViewTemplate` interface.
For example, the class code will be like the following:

```javascript
import { ConsentViewTemplate } from "oauth2-firebase-auth/dist/endpoint/views/consent_view_template";

export class MyConsentViewTemplate implements ConsentViewTemplate {
  provide(): Promise<string> {
    return (
      new Promise() <
      string >
      ((resolve, reject) => {
        resolve(`<!DOCTYPE html>

<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>Authorization page</title>
</head>
<body>
<p><%= providerName %> requests the following permissions:</p>
<ul>
    <% for (const key of scope.split(" ")) { %>
    <li><%= scopes.get(key) %></li>
    <% } %>
</ul>
<p>Could you allow them?</p>
<form method="post" action="/authorize/consent">
    <input type="hidden" name="auth_token" value="<%= encryptedAuthToken %>">
    <input type="hidden" name="user_id" value="<%= encryptedUserId %>">
    <button type="submit" name="action" value="allow">Allow</button>
    <button type="submit" name="action" value="deny">Deny</button>
</form>
</body>
</html>
`);
      })
    );
  }
}
```

The template string is written as the "ejs" template. This library binds the following values to the template at rendering.

- `providerName: string` - The provider name of the client.
- `scope: string` - The scope string devided by space the client code specifies.
- `scopes: Map<string, string>` - The map object which has a set of the scope name and its description.
- `encryptedAuthToken: string` - The encrypted auth token. You need to set this as the hidden parameter.
- `encryptedUserId: string` - The encrypted user ID. You need to set this as the hidden parameter.

And, you need to set the instance to the Configuration class instance as like the following:

```javascript
import * as functions from "firebase-functions";
import {authorize, Configuration, googleAccountAuthentication, token, userinfo} from "oauth2-firebase-auth";
import {MyConsentViewTemplate} from "./my_consent_view_template"

Configuration.init({
  crypto_auth_token_secret_key_32: functions.config().crypto.auth_token_secret_key_32,
  project_api_key: functions.config().project.api_key,
  views_consent_template: new MyConsentViewTemplate()
});

exports.token = token();
exports.authorize = authorize();
exports.authentication = googleAccountAuthentication();
exports.userinfo = userinfo();

...
```

## Add Your Protected Resource Endpoint

In this library, the `userinfo` protected resource endpoint is provided as default. But, you can add your own protected
resource endpoint. Each protected resource receives the request including the access token issued for users/clients,
checks whether the access token is valid or not against using the protected resource, and actually returns the resources
and/or creates some resource or does something. This library provides a convenience abstract class. You can define your
endpoint by creating a new class which extends the abstract class and implements the following two methods:

- `validateScope()` - Check whether the passed scopes are valid to call this endpoint.
- `handleRequest()` - The code body to access to target resources.

To publish your endpoint on the Cloud Functions, you need to retrieve the endpoint function by the `endpoint` property.
As the result, your code will be like the following:

```javascript
import * as express from "express";
import {AbstractProtectedResourceEndpoint} from "oauth2-firebase-auth";
import {ProtectedResourceEndpointResponse} from "oauth2-nodejs";

class FriendsEndpoint extends AbstractProtectedResourceEndpoint {

  protected validateScope(scopes: string[]): boolean {
    return scopes.indexOf("frields") !== -1;
  }

  protected handleRequest(req: express.Request, endpointInfo: ProtectedResourceResponse): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fetchFrields(endpointInfo.userId).then(friends => {
        resolve(JSON.stringify(friends));
      }).catch(e => {
        reject(e);
      })
    });
  }

}

exports.friends = new FriendsEndpoint().endpoint;
```

If the passed access token is invalid, the `handleRequest()` function will not be called and returns an error response
by the abstract class.

## Garbage Collection

The `garbageCollection` function removes up expired tokens from the `oauth2_access_tokens` collection. It runs on a Firebase scheduled function.

### `garbageCollection(expiry, interval)`

- `expiry`: **number** (default = 86400) - the expiry time for your tokens. Used to limit the firebase query. The token's `expires_in` value is used for deleting.
- `interval`: **string** (default = "every 1 hours") - the [firebase function interval](https://firebase.google.com/docs/functions/schedule-functions#write_a_scheduled_function), determining how often to check for expired tokens.
