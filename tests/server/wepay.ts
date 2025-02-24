import { URL } from 'url';
import querystring from 'querystring';
import { wxPaySdk } from '../../src/lib/sdk';
import http, { IncomingMessage as HttpIncomingMessage, ServerResponse } from 'http';

interface IncomingMessage extends HttpIncomingMessage {
  body?: any;
}

// 使用环境变量初始化SDK
const sdk = wxPaySdk({
  appId: process.env.VITE_APP_APPID || '',
  mchId: process.env.VITE_MCH_ID || '',
  publicKey: process.env.VITE_PUBLIC_KEY || '',
  privateKey: process.env.VITE_PRIVATE_KEY || '',
  secretKey: process.env.VITE_API_V3_KEY || ''
});



const routes = {
  // 添加支付通知路由
  'POST /v3/pay/notify': async function handlePaymentNotify(req: IncomingMessage, res: ServerResponse) {
    try {
      const timestamp = req.headers['wechatpay-timestamp'] as string;
      const nonce = req.headers['wechatpay-nonce'] as string;
      const signature = req.headers['wechatpay-signature'] as string;
      const serial = req.headers['wechatpay-serial'] as string;

      // 读取请求体
      let data = req.body
      // 验证和解密通知数据
      const result = await sdk.verifyAndDecrypt({
        headers: {
          'wechatpay-timestamp': timestamp,
          'wechatpay-nonce': nonce,
          'wechatpay-signature': signature,
          'wechatpay-serial': serial,
        },
        body: data
      });
      console.log('Payment notification:', result);
      // 返回成功响应
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: "SUCCESS",
        message: "成功"
      }));
    } catch (error) {
      console.error('Payment notification error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: "FAIL",
        message: "失败"
      }));
    }
  },

  // 添加退款通知路由
  'POST /v3/refund/notify': async function handleRefundNotify(req: IncomingMessage, res: ServerResponse) {
    try {
      const timestamp = req.headers['wechatpay-timestamp'] as string;
      const nonce = req.headers['wechatpay-nonce'] as string;
      const signature = req.headers['wechatpay-signature'] as string;
      const serial = req.headers['wechatpay-serial'] as string;
      // 读取请求体
      let data = req.body
      // 验证和解密通知数据
      const result = await sdk.verifyAndDecrypt({
        headers: {
          'wechatpay-timestamp': timestamp,
          'wechatpay-nonce': nonce,
          'wechatpay-signature': signature,
          'wechatpay-serial': serial,
        },
        body: data
      });

      console.log('Refund notification:', result);

      // 返回成功响应
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: "SUCCESS",
        message: "成功"
      }));
    } catch (error) {
      console.error('Refund notification error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: "FAIL",
        message: "失败"
      }));
    }
  },

  // 添加Native支付测试路由
  'GET /test/native-payment': async function handleNativePayment(req: IncomingMessage, res: ServerResponse) {
    try {
      const nativePaymentResult = await sdk.nativePayment({
        appid: process.env.VITE_APP_APPID,
        mchid: process.env.VITE_MCH_ID,
        description: 'Native支付测试商品',
        out_trade_no: `${Date.now()}`,  // 使用时间戳作为订单号
        notify_url: `http://localhost:${PORT}/v3/pay/notify`,
        amount: {
          total: 1,  // 1分钱
          currency: 'CNY'
        },
        support_fapiao: false,
        attach: 'native_pay_test',  // 附加数据
        goods_tag: 'TEST',
        scene_info: {
          payer_client_ip: req.socket.remoteAddress || '127.0.0.1'
        }
      });

      console.log('Native payment result:', nativePaymentResult);

      // Generate HTML with QR code
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>WeChat Pay QR Code</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/lib/browser.min.js"></script>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
        }
        #qrcode {
            margin: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .amount {
            font-size: 24px;
            color: #333;
            margin: 10px 0;
        }
        .description {
            color: #666;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="amount">支付金额: ¥${(nativePaymentResult.amount?.total || 0) / 100}</div>
    <div class="description">${nativePaymentResult.description || ''}</div>
    <div id="qrcode"></div>
    <div class="description">订单号: ${nativePaymentResult.out_trade_no || ''}</div>
    <script>
        // Generate QR code
        QRCode.toCanvas(document.getElementById('qrcode'), '${nativePaymentResult.code_url}', {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, function(error) {
            if (error) console.error(error);
        });
    </script>
</body>
</html>`;

      // Send HTML response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      console.error('Native payment error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: "FAIL",
        message: error instanceof Error ? error.message : "支付失败"
      }));
    }
  },
}


// Handle incoming requests
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'POST') {
    let body = '';

    // Listen for data
    req.on('data', (chunk) => {
      body += chunk.toString(); // Convert Buffer to string
    });

    // Listen for end of data
    req.on('end', async () => {
      try {
        // Parse data based on Content-Type
        const contentType = req.headers['content-type'];

        let parsedData;
        if (contentType === 'application/json') {
          parsedData = JSON.parse(body);
        } else if (contentType === 'application/x-www-form-urlencoded') {
          parsedData = querystring.parse(body);
        } else {
          parsedData = body; // Return raw string for other types
        }

        // Attach parsed data to req.body
        req.body = parsedData;

        // Route the request
        for (const [key, value] of Object.entries(routes)) {
          const [method, path] = key.split(' ');
          if (req.method === method && req.url?.startsWith(path)) {
            return value(req, res);
          }
        }

        // Handle not found
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } catch (error) {
        // Handle parsing error
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid data format' }));
      }
    });
  } else {
    // Route the request
    for (const [key, value] of Object.entries(routes)) {
      const [method, path] = key.split(' ');
      if (req.method === method && req.url?.startsWith(path)) {
        value(req, res);
        return;
      }
    }

    // Handle not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// Create and start the server
const PORT: number = Number(process.env.PORT) || 3000;
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
