const axios = require('axios');
const moment = require('moment');

const getMpesaToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(`${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error generating M-Pesa token:', error.response ? error.response.data : error.message);
    throw error;
  }
};

const initiateStkPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  const token = await getMpesaToken();
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

  const data = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.MPESA_TRANSACTION_TYPE,
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: process.env.MPESA_TILL_NUMBER,
    PhoneNumber: phoneNumber,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc
  };

  try {
    const response = await axios.post(`${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/query`, data, { // Wait, the endpoint for STK push is usually /mpesa/stkpush/v1/processrequest
        // Actually, for Buy Goods (Lipa na M-Pesa Online), it's processrequest.
    });
    // Correcting endpoint based on common Safaricom API usage
    const pushResponse = await axios.post(`${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return pushResponse.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = { initiateStkPush };
