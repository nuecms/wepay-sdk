# **WeChat Pay Node SDK**

>> WIP

A flexible and lightweight SDK for integrating WeChat Pay with dynamic endpoints, caching, and response transformations.

[![npm](https://img.shields.io/npm/v/@nuecms/wepay-sdk)](https://www.npmjs.com/package/@nuecms/wepay-sdk)
[![GitHub](https://img.shields.io/github/license/nuecms/wepay-sdk)](https://www.github.com/nuecms/wepay-sdk)
[![GitHub issues](https://img.shields.io/github/issues/nuecms/wepay-sdk)](https://www.github.com/nuecms/wepay-sdk/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/nuecms/wepay-sdk)](https://www.github.com/nuecms/wepay-sdk/pulls)

---

## **Features**

- Pre-configured API endpoints for WeChat Pay
- Support for Redis and in-memory caching
- Easy extensibility

---

## **Table of Contents**

- [**WeChat Pay Node SDK**](#wechat-pay-node-sdk)
  - [**Features**](#features)
  - [**Table of Contents**](#table-of-contents)
  - [**Installation**](#installation)
  - [**Quick Start**](#quick-start)
    - [1. Import and Initialize the SDK Builder](#1-import-and-initialize-the-sdk-builder)
    - [2. Register API Endpoints](#2-register-api-endpoints)
    - [3. Make API Calls](#3-make-api-calls)
    - [4. Signature with API calls](#4-signature-with-api-calls)
    - [More](#more)
  - [**Usage Examples**](#usage-examples)
    - [Registering Endpoints](#registering-endpoints)
    - [Making API Calls](#making-api-calls)
  - [**Contributing**](#contributing)
  - [**License**](#license)

---

## **Installation**

Install the SDK using `pnpm` or `yarn`:

```bash
pnpm add @nuecms/wepay-sdk
# or
yarn add @nuecms/wepay-sdk
```

---

## **Quick Start**

### 1. Import and Initialize the SDK Builder

```typescript
import { wxPaySdk } from '@nuecms/wepay-sdk';

const sdk = wxPaySdk({
  appId: string;
  appSecret: string;
  mchId: string;
  publicKey: string;
  privateKey: string;
  secretKey: string;
  cacheProvider: CacheProvider;
});
```

### 2. Register API Endpoints

```typescript
sdk.r('createOrder', '/v3/pay/transactions/jsapi', 'POST');
sdk.r('queryOrder', '/v3/pay/transactions/id/{transaction_id}', 'GET');
```

### 3. Make API Calls

```typescript
const order = await sdk.createOrder({ ...orderDetails });
console.log(order);
```

### 4. Signature with API calls

```typescript
const sdk = wxPaySdk({
  appId: string;
  appSecret: string;
  mchId: string;
  publicKey: string;
  privateKey: string;
  secretKey: string;
});
```

### More

See the testing code in `tests` folder

Example:

-  [tests/server/wepay.ts](tests/server/wepay.ts)

---

## **Usage Examples**

### Registering Endpoints

Register endpoints with their HTTP method, path, and dynamic placeholders (e.g., `{transaction_id}`):

```typescript
sdk.r('createOrder', '/v3/pay/transactions/jsapi', 'POST');
sdk.r('queryOrder', '/v3/pay/transactions/id/{transaction_id}', 'GET');
```

### Making API Calls

Call the registered endpoints dynamically with placeholders and additional options:

```typescript
const orderDetails = await sdk.createOrder({ ...orderData });

console.log(orderDetails);
```

---

## **Contributing**

We welcome contributions to improve this SDK! To get started:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m "Add feature X"`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

---

## **License**

This SDK is released under the **MIT License**. You’re free to use, modify, and distribute this project. See the `LICENSE` file for more details.

