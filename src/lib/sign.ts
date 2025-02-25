import crypto from 'crypto';
import { Buffer } from 'buffer';

type EncryptCtx = {
  privateKey: string;
  appId: string;
  url: string;
  publicKey: string;
  secretKey: string;  // Add secretKey to context
};


/**
 * Check and decrypt the response data using WechatPay v3 API
 * @param ctx encryption context
 * @param resp response data with headers
 * @returns decrypted data or error
 */
export async function checkAndDecrypt(ctx: EncryptCtx, resp: { data: any; headers: Record<string, string> }): Promise<any> {
  const timestamp = resp.headers['wechatpay-timestamp'];
  const nonce = resp.headers['wechatpay-nonce'];
  const signature = resp.headers['wechatpay-signature'];
  const serial = resp.headers['wechatpay-serial'];

  if (!timestamp || !nonce || !signature || !serial) {
    return {
      errcode: -1,
      errmsg: "缺少必要的微信支付签名信息",
      details: {
        timestamp: !!timestamp,
        nonce: !!nonce,
        signature: !!signature,
        serial: !!serial
      }
    };
  }

  // 验证签名
  const isValid = verifySignature(
    { publicKey: ctx.publicKey },
    { timestamp, nonce, body: resp.data, signature }
  );

  if (!isValid) {
    return {
      errcode: -1,
      errmsg: "响应签名验证失败",
      details: { timestamp, nonce, serial }
    };
  }

  // 如果响应包含加密数据则解密
  if (resp.data?.resource) {
    try {
      const decrypted = decrypt(
        { secretKey: ctx.secretKey },
        {
          ciphertext: resp.data.resource.ciphertext,
          associated_data: resp.data.resource.associated_data,
          nonce: resp.data.resource.nonce
        }
      );
      return JSON.parse(decrypted);
    } catch (error) {
      return {
        errcode: -1,
        errmsg: "响应解密失败",
        details: (error as Error).message
      };
    }
  }

  return resp.data;
}

/**
 * verify the signature of the response data
 * @param ctx encryption context including public key
 * @param params verification parameters
 * @returns boolean
 */
export function verifySignature(
  ctx: Pick<EncryptCtx, 'publicKey'>,
  params: {
    timestamp: string;
    nonce: string;
    body: any;
    signature: string;
  }
): boolean {
  const { timestamp, nonce, body, signature } = params;
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const message = `${timestamp}\n${nonce}\n${bodyStr}\n`;

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(message);

  try {
    return verify.verify(ctx.publicKey, signature, "base64");
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

/**
 * decrypt the encrypted data
 * @param ctx encryption context including secret key
 * @param encrypted encrypted data
 * @returns string
 */
export function decrypt(
  ctx: Pick<EncryptCtx, 'secretKey'>,
  encrypted: {
    ciphertext: string;
    associated_data: string;
    nonce: string;
  }
): string {
  const { ciphertext, associated_data, nonce } = encrypted;
  const encryptedBuffer = Buffer.from(ciphertext, "base64");
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  const encryptedData = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ctx.secretKey,
    Buffer.from(nonce)
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associated_data));
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString("utf8");
}