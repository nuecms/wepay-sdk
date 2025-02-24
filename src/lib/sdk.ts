import { sdkBuilder, SdkBuilderConfig, FetchContext, RedisCacheProvider, CacheProvider } from '@nuecms/sdk-builder';
import { checkAndDecrypt } from './sign';
import crypto from 'crypto';


type Endpoint = {
  path: string;
  method: string;
  isEncrypted?: boolean;
};

type WeChatSDKRequestInterceptorOptions = {
  name: string;
  endpoint: Endpoint;
  path: string;
  method: string;
  body: any;
  headers: any;
  params: any;
};

interface WeChatSDKConfig {
  /** 微信支付分配的应用ID */
  appId: string;

  /** 微信支付分配的商户号 */
  mchId: string;

  /** 商户API证书的公钥，用于验证签名 */
  publicKey: string;

  /** 商户API证书的私钥，用于生成签名 */
  privateKey: string;

  /**
   * APIv3密钥
   * 用于解密回调通知、解密证书
   * 在商户平台上设置的32位字符串
   */
  secretKey: string;

  /**
   * 接口域名
   * 默认值: https://api.mch.weixin.qq.com
   */
  baseUrl?: string;

  /** 缓存提供者，用于存储访问令牌等临时数据 */
  cacheProvider?: CacheProvider;

  /**
   * 自定义响应转换器
   * @param response 响应数据
   * @param options 请求配置
   */
  customResponseTransformer?: (response: any, options: any) => any;

  /**
   * 自定义认证状态检查
   * 用于判断是否需要重新获取访问令牌
   * @param status HTTP状态码
   * @param response 响应数据
   */
  authCheckStatus?: (status: number, response: any) => boolean;
}

export {
  RedisCacheProvider,
  type CacheProvider,
  type WeChatSDKConfig,
};

export type WeChatSDK = ReturnType<typeof sdkBuilder>;

const useResponseTransformer = (config: WeChatSDKConfig, customTransformer: Function) => {
  return async (responseData: any, context: FetchContext, response: Response) => {
    // 检查响应头中是否包含微信支付签名相关的头部
    const hasWechatPayHeaders = response.headers.has('Wechatpay-Timestamp') &&
      response.headers.has('Wechatpay-Nonce') &&
      response.headers.has('Wechatpay-Signature') &&
      response.headers.has('Wechatpay-Serial');
    if (hasWechatPayHeaders) {
      try {
        const result = await checkAndDecrypt({
          privateKey: config?.privateKey || '',
          publicKey: config.publicKey,
          secretKey: config.secretKey,
          url: `${config.baseUrl}${context.path}`,
          appId: config.appId,
        }, {
          data: responseData,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (result.errcode === -1) {
          throw new Error(result.errmsg || '验签或解密失败');
        }

        responseData = result;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`微信支付响应处理失败: ${error.message}`);
        } else {
          throw new Error('微信支付响应处理失败: 未知错误');
        }
      }
    }

    return customTransformer(responseData, context);
  };
};

function getSerialNo(publicKey: string): string {
  const cert = crypto.createPublicKey(publicKey);
  const asn1 = cert.export({ format: 'der', type: 'spki' });
  const serialNumber = asn1.slice(-20).toString('hex').toUpperCase();
  return serialNumber;
}

function sign(method: string, url: string, nonce_str: string, timestamp: string, body: any, privateKey: string): string {
  let data = `${method}\n${url}\n${timestamp}\n${nonce_str}\n`;
  data += method !== "GET" && body ? `${JSON.stringify(body)}\n` : "\n";
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  return sign.sign(privateKey, "base64");
}

function generateAuthorizationHeader(config: WeChatSDKConfig, method: string, url: string, body: any): string {
  const nonce_str = Math.random().toString(36).substring(2, 17);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(method, url, nonce_str, timestamp, body, config.privateKey);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce_str}",timestamp="${timestamp}",serial_no="${getSerialNo(config.publicKey)}",signature="${signature}"`;
}

export function wxPaySdk(config: WeChatSDKConfig): WeChatSDK {
  const sdkConfig: SdkBuilderConfig = {
    baseUrl: config.baseUrl || 'https://api.mch.weixin.qq.com',
    cacheProvider: config.cacheProvider,
    placeholders: {},
    config: {
      appId: config.appId,
      mchId: config.mchId,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      secretKey: config.secretKey,
    },
    customResponseTransformer: useResponseTransformer(config, config.customResponseTransformer || ((response: any, options: any) => {
      return response;
    })),
    authCheckStatus: config.authCheckStatus || ((status, response) => {
      return status === 401;
    }),
  };

  const sdk: WeChatSDK = sdkBuilder(sdkConfig);

  sdk.rx('reqInterceptor', async (config: Record<string, any>, params?: {}) => {
    const weChatConfig = config as WeChatSDKConfig;
    const options = params as WeChatSDKRequestInterceptorOptions;
    if (options) {
      const authorization = generateAuthorizationHeader(weChatConfig, options.method, options.path, options.body);
      if (options.name === 'downloadBill') {
        options.params.download_url = options.params.download_url.replace(weChatConfig.baseUrl, '');
        return {
          ...options,
          headers: {
            Authorization: authorization
          }
        }
      }
      const headers = {
        ...options.headers,
        Authorization: authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      return {
        ...options,
        headers,
      };
    }
    return options;
  });

  sdk.rx('verifyAndDecrypt', async (config: Record<string, any>, options: FetchContext) => {
    try {
      const result = await checkAndDecrypt({
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        url: config.baseUrl,
        appId: config.appId,
      }, {
        data: typeof options.body === 'string' ? JSON.parse(options.body) : options.body,
        headers: options.headers
      });

      if (result.errcode === -1) {
        throw new Error(result.errmsg || '验签或解密失败');
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`通知处理失败: ${error.message}`);
      }
      throw new Error('通知处理失败: 未知错误');
    }
  })

  // WeChat Pay Endpoints
  /** JSAPI/小程序下单 */
  sdk.r('createOrder', '/v3/pay/transactions/jsapi', 'POST');

  /** 查询订单 */
  sdk.r('queryOrder', '/v3/pay/transactions/id/{transaction_id}', 'GET');

  /** 关闭订单 */
  sdk.r('closeOrder', '/v3/pay/transactions/out-trade-no/{out_trade_no}/close', 'POST');

  /** 申请退款 */
  sdk.r('refund', '/v3/refund/domestic/refunds', 'POST');

  /** 查询单笔退款 */
  sdk.r('queryRefund', '/v3/refund/domestic/refunds/{out_refund_no}', 'GET');

  /** Native支付下单 */
  sdk.r('nativePayment', '/v3/pay/transactions/native', 'POST');

  /** H5支付下单 */
  sdk.r('h5Payment', '/v3/pay/transactions/h5', 'POST');

  /** APP支付下单 */
  sdk.r('appPayment', '/v3/pay/transactions/app', 'POST');

  /** 小程序支付下单 */
  sdk.r('miniProgramPayment', '/v3/pay/transactions/jsapi', 'POST');

  // 退款相关接口
  /** 异常退款申请 */
  sdk.r('refundException', '/v3/refund/domestic/refunds/exceptional', 'POST');

  /** 查询异常退款 */
  sdk.r('queryRefundException', '/v3/refund/domestic/refunds/exceptional/{out_refund_no}', 'GET');

  // 账单相关接口
  /** 申请交易账单，按天提供交易账单文件 */
  sdk.r('tradeBill', '/v3/bill/tradebill', 'GET');

  /** 申请资金账单，按天提供微信支付账户的资金流水账单文件 */
  sdk.r('fundflowBill', '/v3/bill/fundflowbill', 'GET');

  /** 下载账单，通过下载URL获取账单文件 */
  sdk.r('downloadBill', '{download_url}', 'GET');


  return sdk;
}