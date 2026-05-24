# Multi-tenant

The application started as single tenant as I was the sole user.

I now have plans to allow anyone to create an account and use the application.

This will involve many changes:
- sign-up/sign-in flows
- strong security
- emailing feature (password resets, email verifications)

I decided to use a library for the authentication: [better auth](https://better-auth.com).
It seems featureful and without lock-in.

For the emailing, I decided to use [Brevo](https://www.brevo.com) as they have a free tier.
