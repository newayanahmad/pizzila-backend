const nodemailer = require('nodemailer');

const sendOrderConfirmation = async (to, order) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
        },
    });

    let itemsList = order.items.map(item => `<tr><td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.price}</td></tr>`).join("");
    let subtotal = order.items.reduce((total, item) => total + item.price * item.quantity, 0);
    let tax = parseInt(subtotal * 0.08);
    let deliveryCharge = subtotal >= 500 ? "Free Delivery" : 49;

    await transport.sendMail({
        from: process.env.MAIL_USERNAME,
        to: to, // send to customer
        subject: "Order Confirmation from Pizzila 🍕",
        html: `<body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
        <div style="background-color: #f4f4f4; padding: 10px;">
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fff; padding: 20px; text-align: center; border-radius: 15px; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #444; font-size: 24px;">Order Confirmation from Pizzila 🍕</h2>
                    <p style="font-size: 16px; color: #666;">
                        Thank you for your order! Here are the items you've ordered:
                    </p>
                    <table style="font-size: 16px; color: #444; padding: 20px; border-radius: 5px; background-color: #f9f9f9; text-align: left; width: 100%; border-collapse: collapse;">
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
                        </tr>
                        ${itemsList}
                    </table>
                    <p style="font-size: 16px; color: #666;">
                        Subtotal: ${subtotal}<br>
                        Tax (8%): ${tax}<br>
                        Delivery Charge: ${deliveryCharge}<br>
                        Total: ${parseInt(order.subtotal)}<br>
                    </p>
                    <p style="font-size: 16px; color: #666;">
                        Your order will be shipped as soon as possible. We'll send you another email when your order has been shipped.
                    </p>
                    <p style="font-size: 16px; color: #666;">
                        Thanks for ordering from Pizzila!<br>Customer Service Team
                    </p>
                </div>
            </div>
        </div>
    </body>`
    })
}

module.exports = sendOrderConfirmation;
