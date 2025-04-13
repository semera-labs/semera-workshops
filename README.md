This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, initialize the database using the following command:

```bash
npm run init-database
# then
npm run init-workshops
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Run using docker

```bash
docker compose up --build -d
```

## Run locally
Build if necessary
```bash
npm run build
```

Run locally
```bash
npm run init-database
npm run init-workshops
npm run start
```

Find IP
```bash
ipconfig /all
```


admin
gkundergroundpass