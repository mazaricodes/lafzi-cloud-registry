# 🛡️ Lafzi Studio — Cloud Licensing & Hardware-Binding Registry

Serverless licensing and hardware-binding registry engineered for **Lafzi & Lafzi Studio**. Deployed on **Vercel** with **Upstash Serverless Redis**.

---

## ⚡ Core Capabilities
1. **Strict 1-Key = 1-Workstation Hardware Lock**:
   - Maps each Gumroad license key cryptographically to the device's immutable hardware identifier (`IOPlatformUUID` on macOS / `MachineGuid` on Windows).
   - Re-activating on the **same computer** (e.g. after OS reinstall or app update) is always allowed.
   - Attempting to use the same key on a **different computer** is strictly blocked.
2. **Offline Resilience**:
   - Client applications only contact the registry once during initial activation to register the hardware binding and obtain a cryptographic HMAC signature.
   - After activation, the desktop app operates **100% offline and private** forever.
3. **Remote Seat Management & Admin Operations**:
   - **Unbind License**: Release a binding so a customer can migrate their license to a new PC.
   - **Revoke License**: Instantly disable refunded or fraudulent keys.
   - **Live In-App Broadcasts**: Push urgent updates or announcements directly into consumer apps.
4. **Gumroad Webhook Receiver**:
   - Automatically records sales and processes refunds/disputes.

---

## 🚀 Quick Deployment to Vercel (1-Click)

### Step 1: Deploy to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import repository `mazaricodes/lafzi-cloud-registry`
3. Click **Deploy**.

### Step 2: Add Free Upstash Redis Database
1. In your Vercel Project Dashboard, click the **Storage** tab.
2. Select **Upstash Redis** → Click **Connect Database** (Free 10,000 commands/day).
3. Vercel automatically injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`!

### Step 3: Add Environment Variables in Vercel
In **Settings → Environment Variables**, add:
- `GUMROAD_PRODUCT_ID`: `i6F1q10sSYXQrW1UU4PDHQ==`
- `LAFZI_ADMIN_PIN`: `lafzi2025`
- `LAFZI_MASTER_SECRET`: `LAFZI_STUDIO_SECRET_SIGN_SALT_v1_2025`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/license/activate` | Cryptographically binds key to device `machine_id` |
| `POST` | `/api/license/unbind` | Releases hardware binding (Admin PIN required) |
| `POST` | `/api/license/revoke` | Revokes license key (Admin PIN required) |
| `GET` | `/api/admin/licenses` | Returns all active licenses & bound HWIDs |
| `GET` / `POST` | `/api/admin/alert` | Reads or updates in-app broadcast alerts |
| `GET` | `/api/updates` | Public update manifest polled by desktop apps |
| `POST` | `/api/gumroad/webhook` | Receives Gumroad sale & refund webhooks |
