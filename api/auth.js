// Shopify OAuth - Step 1: Redirect to Shopify authorization
module.exports = (req, res) => {
    const shop = process.env.SHOP_DOMAIN; // e.g. w0wti8-t0.myshopify.com
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = `https://${req.headers.host}/api/callback`;
    const scopes = 'write_products,write_purchase_options,read_products';
    const nonce = Date.now().toString(36);

    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

    res.writeHead(302, { Location: authUrl });
    res.end();
};
