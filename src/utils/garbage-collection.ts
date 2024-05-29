import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export function garbageCollection(expiry = 2592000000, interval = "every 24 hours") {
  return functions.pubsub.schedule(interval).onRun(async () => {
    const db = admin.firestore();

    const now = new Date().getTime();
    const threshold = now - expiry;

    functions.logger.debug("Now", now, "Threshold", threshold)

    const oldTokens = await db
      .collection("oauth2_access_tokens")
      .where("created_on", "<=", threshold)
      .get();

    oldTokens.forEach(async (tokenSnapshot) => {
      const data = tokenSnapshot.data();
      functions.logger.debug(data.oauth_info_id)
      if (now > data.created_on + data.expires_in) {
        await db
          .collection("oauth2_access_tokens")
          .doc(tokenSnapshot.id)
          .delete();
      }
    });
  });
}
