const https = require('https');

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  try {
    const { code, shop: shopParam } = req.query;
    const shop = process.env.SHOP_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!code) {
      res.status(400).send('Missing authorization code');
      return;
    }

    const tokenBody = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    });

    const tokenResp = await httpsRequest({
      hostname: shop,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(tokenBody)
      }
    }, tokenBody);

    const tokenData = JSON.parse(tokenResp.body);

    if (!tokenData.access_token) {
      res.status(500).send('<pre>Failed to get access token: ' + JSON.stringify(tokenData, null, 2) + '</pre>');
      return;
    }

    const accessToken = tokenData.access_token;

    const mutation = 'mutation sellingPlanGroupUpdate($id: ID!, $input: SellingPlanGroupInput!) { sellingPlanGroupUpdate(id: $id, input: $input) { sellingPlanGroup { id name sellingPlans(first: 5) { edges { node { id name category } } } } userErrors { field message code } } }';

    const variables = {
      id: "gid://shopify/SellingPlanGroup/6086230228",
      input: {
        sellingPlansToUpdate: [
          {
            id: "gid://shopify/SellingPlan/8916861140",
            category: "OTHER"
          }
        ]
      }
    };

    const gqlBody = JSON.stringify({ query: mutation, variables });

    const gqlResp = await httpsRequest({
      hostname: shop,
      path: '/admin/api/2024-10/graphql.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'Content-Length': Buffer.byteLength(gqlBody)
      }
    }, gqlBody);

    const gqlData = JSON.parse(gqlResp.body);
    const success = gqlData?.data?.sellingPlanGroupUpdate?.userErrors?.length === 0;
    const newCat = gqlData?.data?.sellingPlanGroupUpdate?.sellingPlanGroup?.sellingPlans?.edges?.[0]?.node?.category;

    let html = '<!DOCTYPE html><html><head><title>SP Config Tool</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px}.ok{background:#d4edda;border:1px solid #c3e6cb;padding:20px;border-radius:8px}.err{background:#f8d7da;border:1px solid #f5c6cb;padding:20px;border-radius:8px}pre{background:#f8f9fa;padding:15px;border-radius:6px;overflow-x:auto;font-size:13px}</style></head><body><h1>SP Config Tool</h1>';

    if (success) {
      html += '<div class="ok"><h2>Success</h2><p>Category changed to: <strong>' + newCat + '</strong></p><p>Subscription consent text removed from checkout.</p></div>';
    } else {
      html += '<div class="err"><h2>Mutation returned errors</h2></div>';
    }

    html += '<h3>API Response:</h3><pre>' + JSON.stringify(gqlData, null, 2) + '</pre>';
    html += '<h3>Token Info:</h3><pre>Scopes: ' + (tokenData.scope || 'unknown') + '</pre></body></html>';

    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('<pre>Error: ' + err.message + '</pre>');
  }
};
