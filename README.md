# CEC Extra Classes — Backend

Express + MongoDB API for https://cecextraclasses.netlify.app

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | 32+ random characters. **Rotate it** if the old one was weak or ever shared — this logs everyone out once. |
| `GOOGLE_CLIENT_ID` | yes | Same ID the frontend uses |
| `CORS_ORIGINS` | no | Comma-separated sites allowed to call the API. Defaults to the Netlify site + `http://localhost:5173`. **Add any custom domain here.** |
| `CLIENT_URL` | no | Where Paystack sends people after paying |
| `CLOUD_NAME`, `API_KEY`, `API_SECRET` | yes | Cloudinary (lesson videos) |
| `MAX_VIDEO_MB` | no | Per-video upload limit, default 200 |
| `EMAIL_USER`, `EMAIL_PASS` | for email sign-up | Gmail address + App Password |
| `PAYSTACK_SECRET_KEY` | for payments | |
| `PAYMENT_PLANS` | for payments | JSON, plan → price in GHS, e.g. `{"premium":50}`. Payments are off until set. |

## Who can call what

- **Public:** browse subjects and lessons, register / log in / verify email, send feedback, payment webhook.
- **Logged in:** your own profile, progress, timetable, unlocks and payments — and those of **your own children** if you are a parent.
- **Admin only:** list/edit/delete users, toggle admin, create/edit/delete subjects, strands and lessons, read feedback.

Admin is the `admin: true` flag on a user. To make someone the first admin:

```bash
npm run make-admin -- you@example.com
```

## Paystack webhook

Set the webhook URL in the Paystack dashboard to:

```
https://<your-render-app>.onrender.com/api/payments/webhook
```
