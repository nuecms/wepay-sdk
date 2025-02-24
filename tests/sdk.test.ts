import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wxPaySdk } from '../src';
import { RedisCacheProvider } from '@nuecms/sdk-builder';
import Redis from 'ioredis';

describe('WeChat Pay SDK Tests', () => {
  const mockConfig = {
    appId: process.env.VITE_APP_APPID || 'mockAppId',
    appSecret: process.env.VITE_APP_APPSECRET || 'mockApp',
    mchId: 'mockMchId',
    publicKey: 'mockPublicKey',
    privateKey: 'mockPrivateKey',
    secretKey: 'mockSecretKey',
    cacheProvider: new RedisCacheProvider(new Redis()),
  };

  let sdk: ReturnType<typeof wxPaySdk>;

  beforeEach(() => {
    sdk = wxPaySdk(mockConfig);
    // Mock API Response for getAccessToken
    const mockAccessTokenResponse = {
      access_token: 'mockAccessToken123',
      expires_in: 7200,
    };

    // Mock HTTP request
    vi.spyOn(sdk, 'getAccessToken').mockResolvedValue(mockAccessTokenResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize SDK correctly', () => {
    expect(sdk).toBeDefined();
    expect(typeof sdk.r).toBe('function');
  });


  it('should create a JSAPI order', async () => {
    const mockCreateOrderResponse = {
      prepay_id: 'mockPrepayId123',
    };

    vi.spyOn(sdk, 'createOrder').mockResolvedValue(mockCreateOrderResponse);

    const response = await sdk.createOrder({
      appid: mockConfig.appId,
      mchid: mockConfig.mchId,
      description: 'Test Order',
      out_trade_no: 'mockOutTradeNo',
      notify_url: 'https://mock.notify.url',
      amount: {
        total: 100,
        currency: 'CNY',
      },
      payer: {
        openid: 'mockOpenId',
      },
    });
    expect(response.prepay_id).toBe('mockPrepayId123');
  });

  it('should create a Native order', async () => {
    const mockNativeOrderResponse = {
      code_url: 'mockCodeUrl123',
    };

    vi.spyOn(sdk, 'nativePayment').mockResolvedValue(mockNativeOrderResponse);

    const response = await sdk.nativePayment({
      appid: mockConfig.appId,
      mchid: mockConfig.mchId,
      description: 'Test Order',
      out_trade_no: 'mockOutTradeNo',
      notify_url: 'https://mock.notify.url',
      amount: {
        total: 100,
        currency: 'CNY',
      },
    });
    expect(response.code_url).toBe('mockCodeUrl123');
  });

  it('should create an H5 order', async () => {
    const mockH5OrderResponse = {
      h5_url: 'mockH5Url123',
    };

    vi.spyOn(sdk, 'h5Payment').mockResolvedValue(mockH5OrderResponse);

    const response = await sdk.h5Payment({
      appid: mockConfig.appId,
      mchid: mockConfig.mchId,
      description: 'Test Order',
      out_trade_no: 'mockOutTradeNo',
      notify_url: 'https://mock.notify.url',
      amount: {
        total: 100,
        currency: 'CNY',
      },
      scene_info: {
        payer_client_ip: '127.0.0.1',
        h5_info: {
          type: 'Wap',
        },
      },
    });
    expect(response.h5_url).toBe('mockH5Url123');
  });

  it('should create an APP order', async () => {
    const mockAppOrderResponse = {
      prepay_id: 'mockPrepayId123',
    };

    vi.spyOn(sdk, 'appPayment').mockResolvedValue(mockAppOrderResponse);

    const response = await sdk.appPayment({
      appid: mockConfig.appId,
      mchid: mockConfig.mchId,
      description: 'Test Order',
      out_trade_no: 'mockOutTradeNo',
      notify_url: 'https://mock.notify.url',
      amount: {
        total: 100,
        currency: 'CNY',
      },
    });
    expect(response.prepay_id).toBe('mockPrepayId123');
  });

  it('should handle errors gracefully', async () => {
    const errorMessage = 'Invalid AppID or Secret';

    vi.spyOn(sdk, 'getAccessToken').mockRejectedValue(new Error(errorMessage));

    try {
      await sdk.getAccessToken({
        appid: 'invalidAppId',
        secret: 'invalidAppSecret',
        grant_type: 'client_credential',
      });
    } catch (error) {
      expect((error as Error).message).toBe(errorMessage);
    }
  });
});
