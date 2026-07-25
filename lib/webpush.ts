import webpush from "web-push";
import { removePushSubscription } from "./firestore";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails("mailto:gregory.kurnia@gmail.com", publicKey, privateKey);
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPushToAll(subscriptions: StoredSubscription[], payload: { title: string; body: string; url?: string }) {
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(sub.endpoint).catch(() => {});
        }
      }
    })
  );
}
